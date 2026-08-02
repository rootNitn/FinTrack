import { encrypt, decrypt, maskAccountNumber } from "./crypto";

describe("crypto utils", () => {
  it("encrypts and decrypts round-trip", () => {
    const plain = "1234567890123456";
    const encrypted = encrypt(plain);
    expect(encrypted).not.toBe(plain);
    expect(decrypt(encrypted)).toBe(plain);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plain = "1234567890123456";
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it("masks account numbers", () => {
    expect(maskAccountNumber("1234")).toBe("••••••1234");
  });
});
