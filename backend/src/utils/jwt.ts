import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string; // userId
  role: "USER" | "ADMIN";
  email: string;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  jti: string; // token id, matches RefreshToken.id in DB
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload, rememberMe: boolean): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: rememberMe ? env.JWT_REFRESH_EXPIRES_IN_REMEMBER_ME : env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/** Refresh & password-reset tokens are stored in the DB as SHA-256 hashes, never in plain text. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface TwoFactorPendingPayload {
  sub: string; // userId
  purpose: "2fa_pending";
}

/** Short-lived token issued after a correct password when the account has 2FA enabled — proves
 * the password step passed, without granting a session, while the user enters their TOTP/backup code. */
export function signTwoFactorPendingToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: "2fa_pending" } as TwoFactorPendingPayload, env.JWT_ACCESS_SECRET, { expiresIn: "5m" });
}

export function verifyTwoFactorPendingToken(token: string): TwoFactorPendingPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TwoFactorPendingPayload;
  if (payload.purpose !== "2fa_pending") throw new Error("Invalid token purpose");
  return payload;
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function msFromDuration(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}
