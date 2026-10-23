import { describe, expect, test } from "@jest/globals";
import { authenticator } from "otplib";
import { buildTotpEnrollment, generateTotpSecret, verifyTotpCode } from "./totp.util";

describe("TOTP utilities", () => {
  test("generates and verifies authenticator codes", () => {
    const secret = generateTotpSecret();
    const token = authenticator.generate(secret);

    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(verifyTotpCode(secret, token)).toBe(true);
    expect(verifyTotpCode(secret, "not-a-code")).toBe(false);
  });

  test("builds an authenticator enrollment URI and QR code", async () => {
    const enrollment = await buildTotpEnrollment("user@example.com", generateTotpSecret());

    expect(enrollment.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(enrollment.otpauthUrl).toContain("issuer=LifeTrack");
    expect(enrollment.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});