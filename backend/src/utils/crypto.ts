import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const key = Buffer.from(env.ACCOUNT_NUMBER_ENCRYPTION_KEY, "hex");

/** Encrypts a sensitive string (e.g. bank account number) at rest using AES-256-GCM. */
export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** Decrypts a value previously produced by {@link encrypt}. */
export function decrypt(payload: string): string {
  const [ivHex, authTagHex, encryptedHex] = payload.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Masks an account number, showing only the last 4 digits, e.g. `••••••1234`. */
export function maskAccountNumber(last4: string): string {
  return `••••••${last4}`;
}

/**
 * Encrypts an arbitrary binary buffer (e.g. an uploaded tax document) at rest using AES-256-GCM.
 * Unlike {@link encrypt}, this returns a binary `Buffer` (iv[12] + authTag[16] + ciphertext)
 * rather than a hex string, so it's more compact for storing large files in a `Bytes` column.
 */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

/** Decrypts a buffer previously produced by {@link encryptBuffer}. */
export function decryptBuffer(payload: Buffer): Buffer {
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
