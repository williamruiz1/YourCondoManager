// Cryptographically-secure numeric OTP generation (A-AUTH-002, CWE-338).
//
// The owner-portal and vendor-portal login OTPs were generated with the
// non-cryptographic `Math.floor(100000 + <prng> * 900000)` approach. This
// helper replaces it with `crypto.randomInt`, extracted so both call sites
// share one implementation and it is directly unit-testable.
import { randomInt } from "node:crypto";

/**
 * A cryptographically-secure 6-digit numeric login OTP.
 * `randomInt(100000, 1000000)` draws uniformly from [100000, 999999] — always
 * six digits, no modulo bias.
 */
export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}
