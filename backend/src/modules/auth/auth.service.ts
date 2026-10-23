import { randomUUID } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { comparePassword, hashPassword } from "../../utils/password";
import {
  generateOpaqueToken,
  hashToken,
  msFromDuration,
  signAccessToken,
  signRefreshToken,
  signTwoFactorPendingToken,
  verifyRefreshToken,
  verifyTwoFactorPendingToken,
} from "../../utils/jwt";
import { encrypt, decrypt } from "../../utils/crypto";
import { buildTotpEnrollment, generateBackupCodes, generateTotpSecret, hashBackupCode, verifyTotpCode } from "../../utils/totp.util";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { sendPasswordResetEmail } from "../../utils/password-reset-email";
import {
  ChangePasswordInput,
  DeleteAccountInput,
  ForgotPasswordInput,
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TwoFactorDisableInput,
  TwoFactorEnableInput,
  TwoFactorVerifyLoginInput,
  UpdateProfileInput,
} from "./auth.dto";

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  dateOfBirth: true,
  role: true,
  isActive: true,
  createdAt: true,
  totpEnabled: true,
  planTier: true,
  planExpiresAt: true,
} as const;

/** Strips internal/security fields (password hash, google id, lockout counters) before sending a user to the client. */
function toPublicUser<
  T extends {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    dateOfBirth: Date | null;
    role: "USER" | "ADMIN";
    isActive: boolean;
    createdAt: Date;
    totpEnabled: boolean;
    planTier: "FREE" | "PLUS" | "PRO";
    planExpiresAt: Date | null;
  }
>(user: T) {
  const { id, email, name, avatarUrl, dateOfBirth, role, isActive, createdAt, totpEnabled, planTier, planExpiresAt } = user;
  return { id, email, name, avatarUrl, dateOfBirth, role, isActive, createdAt, totpEnabled, planTier, planExpiresAt };
}

async function issueTokenPair(userId: string, email: string, role: "USER" | "ADMIN", rememberMe: boolean) {
  const accessToken = signAccessToken({ sub: userId, email, role });

  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, jti }, rememberMe);
  const expiresAt = new Date(
    Date.now() + msFromDuration(rememberMe ? env.JWT_REFRESH_EXPIRES_IN_REMEMBER_ME : env.JWT_REFRESH_EXPIRES_IN)
  );

  await prisma.refreshToken.create({
    data: { id: jti, userId, tokenHash: hashToken(refreshToken), expiresAt },
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register({ name, email, password }: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw AppError.conflict("An account with this email already exists");

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        setting: { create: {} },
      },
      select: publicUserSelect,
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "SYSTEM",
        title: "Welcome to LifeTrack",
        message: "Your account is ready. Add your income, expenses, and investments to see your full financial picture.",
      },
    });

    const tokens = await issueTokenPair(user.id, user.email, user.role, false);
    return { user, ...tokens };
  },

  async login({ email, password, rememberMe }: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw AppError.unauthorized("Invalid email or password");
    if (!user.isActive) throw AppError.forbidden("This account has been disabled");
    if (!user.passwordHash) {
      throw AppError.badRequest("This account uses Google Sign-In. Please continue with Google instead.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw AppError.forbidden(
        `Too many failed login attempts. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockingOut = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: lockingOut ? 0 : attempts,
          lockedUntil: lockingOut ? new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS) : null,
        },
      });
      if (lockingOut) {
        throw AppError.forbidden(
          `Too many failed login attempts. Your account is locked for 15 minutes.`
        );
      }
      const remaining = MAX_FAILED_LOGIN_ATTEMPTS - attempts;
      throw AppError.unauthorized(
        `Invalid email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before your account is temporarily locked.`
      );
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    if (user.totpEnabled) {
      return { requiresTwoFactor: true, twoFactorToken: signTwoFactorPendingToken(user.id) };
    }

    const tokens = await issueTokenPair(user.id, user.email, user.role, rememberMe ?? false);
    return { user: toPublicUser(user), ...tokens };
  },

  async loginWithGoogle({ idToken, rememberMe }: GoogleAuthInput) {
    if (!googleClient || !env.GOOGLE_CLIENT_ID) {
      throw AppError.badRequest("Google Sign-In is not configured on this server");
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch {
      throw AppError.unauthorized("Invalid Google credential");
    }
    if (!payload?.email || !payload.sub) throw AppError.unauthorized("Invalid Google credential");
    if (payload.email_verified === false) throw AppError.unauthorized("Google email is not verified");

    let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (!user) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: payload.email } });
      if (existingByEmail) {
        user = await prisma.user.update({ where: { id: existingByEmail.id }, data: { googleId: payload.sub } });
      } else {
        user = await prisma.user.create({
          data: {
            email: payload.email,
            name: payload.name ?? payload.email.split("@")[0],
            avatarUrl: payload.picture ?? null,
            googleId: payload.sub,
            setting: { create: {} },
          },
        });
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "SYSTEM",
            title: "Welcome to LifeTrack",
            message: "Your account is ready. Add your income, expenses, and investments to see your full financial picture.",
          },
        });
      }
    }
    if (!user.isActive) throw AppError.forbidden("This account has been disabled");

    const tokens = await issueTokenPair(user.id, user.email, user.role, rememberMe ?? false);
    return { user: toPublicUser(user), ...tokens };
  },

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized("Invalid or expired refresh token");
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revoked || stored.tokenHash !== hashToken(refreshToken) || stored.expiresAt < new Date()) {
      throw AppError.unauthorized("Refresh token is no longer valid");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw AppError.unauthorized("Account not available");

    // Rotate: revoke old token, issue a new pair.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    const rememberMe = stored.expiresAt.getTime() - stored.createdAt.getTime() > msFromDuration(env.JWT_REFRESH_EXPIRES_IN);
    const tokens = await issueTokenPair(user.id, user.email, user.role, rememberMe);
    return { user: toPublicUser(user), ...tokens };
  },

  async logout(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({ where: { id: payload.jti }, data: { revoked: true } });
    } catch {
      // Already invalid/expired — nothing to revoke, logout is idempotent.
    }
  },

  async forgotPassword({ email }: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always respond success-shaped to avoid leaking which emails are registered.
    if (!user) return { message: "If that email exists, a reset link has been sent." };

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + msFromDuration(env.PASSWORD_RESET_TOKEN_EXPIRES_IN));

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
      });
    });

    const sent = await sendPasswordResetEmail(user.email, user.name, token).catch((error) => {
      logger.error({ error, userId: user.id }, "Password reset email failed");
      return false;
    });
    if (!sent) logger.warn({ userId: user.id }, "Password reset email is not configured or was rejected");
    return { message: "If that email exists, a reset link has been sent." };
  },

  async resetPassword({ token, newPassword }: ResetPasswordInput) {
    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.used || record.expiresAt < new Date()) {
      throw AppError.badRequest("Reset link is invalid or has expired");
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, used: false, expiresAt: { gt: new Date() } },
        data: { used: true },
      });
      if (claimed.count !== 1) throw AppError.badRequest("Reset link is invalid or has expired");
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: record.userId }, data: { revoked: true } });
    });

    return { message: "Password has been reset successfully. Please log in again." };
  },

  async changePassword(userId: string, { currentPassword, newPassword }: ChangePasswordInput) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) {
      throw AppError.badRequest("This account uses Google Sign-In and has no password to change");
    }
    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw AppError.badRequest("Current password is incorrect");

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: "Password changed successfully" };
  },

  /** Step 2 of a 2FA-gated login: verifies the short-lived pending token from step 1 plus a TOTP
   * code (or an unused backup code), then issues the real session tokens. */
  async verifyTwoFactorLogin({ twoFactorToken, code, rememberMe }: TwoFactorVerifyLoginInput) {
    let payload;
    try {
      payload = verifyTwoFactorPendingToken(twoFactorToken);
    } catch {
      throw AppError.unauthorized("Your session expired — please log in again");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecret) {
      throw AppError.unauthorized("Two-factor authentication is not available for this account");
    }

    const normalizedCode = code.trim();
    const isTotpValid = /^\d{6}$/.test(normalizedCode) && verifyTotpCode(decrypt(user.totpSecret), normalizedCode);

    let usedBackupCode: string | null = null;
    if (!isTotpValid) {
      const hashedAttempt = hashBackupCode(normalizedCode);
      if (user.totpBackupCodes.includes(hashedAttempt)) usedBackupCode = hashedAttempt;
    }

    if (!isTotpValid && !usedBackupCode) {
      throw AppError.unauthorized("Invalid authentication code");
    }

    if (usedBackupCode) {
      // Backup codes are single-use — remove it so it can't be replayed.
      await prisma.user.update({
        where: { id: user.id },
        data: { totpBackupCodes: user.totpBackupCodes.filter((c) => c !== usedBackupCode) },
      });
    }

    const tokens = await issueTokenPair(user.id, user.email, user.role, rememberMe ?? false);
    return { user: toPublicUser(user), ...tokens };
  },

  /** Starts 2FA enrollment: generates a new secret (stored encrypted, but NOT yet enabled until
   * confirmed via {@link enableTwoFactor}) and returns a QR code for the user's authenticator app. */
  async setupTwoFactor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw AppError.conflict("Two-factor authentication is already enabled");

    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: userId }, data: { totpSecret: encrypt(secret) } });

    const { otpauthUrl, qrCodeDataUrl } = await buildTotpEnrollment(user.email, secret);
    return { secret, otpauthUrl, qrCodeDataUrl };
  },

  /** Confirms enrollment with a code from the authenticator app, turns 2FA on, and returns
   * one-time backup codes (shown to the user exactly once — only hashes are stored). */
  async enableTwoFactor(userId: string, { code }: TwoFactorEnableInput) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled) throw AppError.conflict("Two-factor authentication is already enabled");
    if (!user.totpSecret) throw AppError.badRequest("Start 2FA setup first to get a QR code");

    if (!verifyTotpCode(decrypt(user.totpSecret), code)) {
      throw AppError.badRequest("Invalid code — check your authenticator app and try again");
    }

    const { plainCodes, hashedCodes } = generateBackupCodes();
    await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true, totpBackupCodes: hashedCodes } });

    return { message: "Two-factor authentication is now enabled", backupCodes: plainCodes };
  },

  /** Requires the account password (not just a click) to turn 2FA off. */
  async disableTwoFactor(userId: string, { password }: TwoFactorDisableInput) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) throw AppError.badRequest("This account uses Google Sign-In and has no password to verify");
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw AppError.badRequest("Incorrect password");

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
    });
    return { message: "Two-factor authentication has been disabled" };
  },

  async getTwoFactorStatus(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totpEnabled: true, totpBackupCodes: true } });
    return { enabled: user.totpEnabled, remainingBackupCodes: user.totpEnabled ? user.totpBackupCodes.length : 0 };
  },

  async getProfile(userId: string) {
    return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect });
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    return prisma.user.update({ where: { id: userId }, data: input, select: publicUserSelect });
  },

  /** Permanently deletes the account and (via `onDelete: Cascade` on every user-owned table) all
   * of its data. Requires the account's password (skipped for Google-only accounts, which have no
   * local password) plus a literal "DELETE" confirmation string as a second safety check. */
  async deleteAccount(userId: string, input: DeleteAccountInput) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.passwordHash) {
      if (!input.password) throw AppError.badRequest("Password is required to delete your account");
      const valid = await comparePassword(input.password, user.passwordHash);
      if (!valid) throw AppError.badRequest("Incorrect password");
    }

    await prisma.$transaction([
      // BusinessServiceTimesheet.userId is onDelete: Restrict (billing-relevant history) — the
      // user's own timesheet rows must be cleared explicitly before the user row can be deleted.
      prisma.businessServiceTimesheet.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return { message: "Account deleted" };
  },
};
