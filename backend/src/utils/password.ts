import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/** Enforces a reasonably strong password: min 8 chars, upper, lower, digit. */
export const passwordPolicyRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
