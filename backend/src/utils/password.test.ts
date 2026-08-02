import { passwordPolicyRegex, hashPassword, comparePassword } from "./password";

describe("password utils", () => {
  it("accepts strong passwords", () => {
    expect(passwordPolicyRegex.test("StrongPass1")).toBe(true);
  });

  it("rejects weak passwords", () => {
    expect(passwordPolicyRegex.test("weak")).toBe(false);
    expect(passwordPolicyRegex.test("alllowercase1")).toBe(false);
    expect(passwordPolicyRegex.test("ALLUPPERCASE1")).toBe(false);
    expect(passwordPolicyRegex.test("NoDigitsHere")).toBe(false);
  });

  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("StrongPass1");
    expect(hash).not.toBe("StrongPass1");
    expect(await comparePassword("StrongPass1", hash)).toBe(true);
    expect(await comparePassword("WrongPass1", hash)).toBe(false);
  });
});
