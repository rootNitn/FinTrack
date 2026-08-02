import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from "./jwt";

describe("jwt utils", () => {
  it("signs and verifies an access token", () => {
    const token = signAccessToken({ sub: "user-1", role: "USER", email: "a@b.com" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("USER");
  });

  it("signs and verifies a refresh token", () => {
    const token = signRefreshToken({ sub: "user-1", jti: "token-1" }, false);
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.jti).toBe("token-1");
  });

  it("hashes tokens deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
