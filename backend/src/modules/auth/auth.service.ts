import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { comparePassword, hashPassword } from "../../utils/password";
import {
  generateOpaqueToken,
  hashToken,
  msFromDuration,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "./auth.dto";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  dateOfBirth: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

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

    const tokens = await issueTokenPair(user.id, user.email, user.role, false);
    return { user, ...tokens };
  },

  async login({ email, password, rememberMe }: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw AppError.unauthorized("Invalid email or password");
    if (!user.isActive) throw AppError.forbidden("This account has been disabled");

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw AppError.unauthorized("Invalid email or password");

    const tokens = await issueTokenPair(user.id, user.email, user.role, rememberMe ?? false);
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return { user: publicUser, ...tokens };
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
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return { user: publicUser, ...tokens };
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

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });

    // No SMTP provider configured yet — log the reset link and return it in non-production
    // responses so the flow is testable end-to-end. Swap this for a real email send in production.
    logger.info({ userId: user.id }, "Password reset token generated");
    return {
      message: "If that email exists, a reset link has been sent.",
      ...(env.NODE_ENV !== "production" ? { devResetToken: token } : {}),
    };
  },

  async resetPassword({ token, newPassword }: ResetPasswordInput) {
    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.used || record.expiresAt < new Date()) {
      throw AppError.badRequest("Reset link is invalid or has expired");
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
      prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revoked: true } }),
    ]);

    return { message: "Password has been reset successfully. Please log in again." };
  },

  async changePassword(userId: string, { currentPassword, newPassword }: ChangePasswordInput) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw AppError.badRequest("Current password is incorrect");

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { message: "Password changed successfully" };
  },

  async getProfile(userId: string) {
    return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUserSelect });
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    return prisma.user.update({ where: { id: userId }, data: input, select: publicUserSelect });
  },
};
