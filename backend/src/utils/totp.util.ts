import crypto from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { hashToken } from "./jwt";

const ISSUER = "LifeTrack";

/** Generates a new base32 TOTP secret for a user enrolling in 2FA (not yet persisted/enabled). */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI + a scannable QR code data URL for an authenticator app (Google Authenticator, Authy, etc.). */
export async function buildTotpEnrollment(email: string, secret: string): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
  const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { otpauthUrl, qrCodeDataUrl };
}

/** Verifies a 6-digit code against the secret (otplib allows a small clock-drift window by default). */
export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}

/** Generates `count` random human-friendly backup codes (plaintext, shown to the user ONCE) plus their SHA-256 hashes for storage. */
export function generateBackupCodes(count = 8): { plainCodes: string[]; hashedCodes: string[] } {
  const plainCodes = Array.from({ length: count }, () => {
    // 10 hex chars grouped as XXXXX-XXXXX for readability, e.g. "a1b2c-3d4e5".
    const raw = crypto.randomBytes(5).toString("hex");
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
  const hashedCodes = plainCodes.map((code) => hashToken(code.toLowerCase()));
  return { plainCodes, hashedCodes };
}

export function hashBackupCode(code: string): string {
  return hashToken(code.trim().toLowerCase());
}
