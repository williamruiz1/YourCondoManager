import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateOtpCode } from "./otp-code";

describe("generateOtpCode (A-AUTH-002 — CSPRNG OTP)", () => {
  it("is always a 6-digit numeric string", () => {
    for (let i = 0; i < 2000; i++) {
      const otp = generateOtpCode();
      expect(otp).toMatch(/^\d{6}$/);
      const n = Number(otp);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });

  it("uses a CSPRNG (crypto.randomInt), not Math.random", () => {
    const src = readFileSync(join(process.cwd(), "server", "otp-code.ts"), "utf8");
    expect(src).toContain("randomInt");
    expect(src).not.toContain("Math.random");
  });
});
