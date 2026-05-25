/**
 * Plaid access-token encryption helpers — shared between the registerRoutes
 * closure (which historically owned them) and the new bank-feed-sync service
 * (founder-os#2478). AES-256-GCM keyed off PLAID_TOKEN_ENCRYPTION_KEY
 * (falling back to PAYMENT_GATEWAY_ENCRYPTION_KEY so existing installs
 * don't need a new env var).
 *
 * The encrypted payload format (JSON: { alg, iv, tag, ciphertext } in base64)
 * is unchanged from the original closure-scoped helpers — tokens encrypted
 * before this extraction continue to decrypt cleanly.
 */
import {
  createCipheriv as cryptoCipheriv,
  createDecipheriv as cryptoDecipheriv,
  createHash as cryptoHash,
  randomBytes as cryptoRandomBytes,
} from "crypto";

function getPlaidTokenEncryptionKey(): Buffer {
  const raw = (
    process.env.PLAID_TOKEN_ENCRYPTION_KEY ??
    process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY
  )?.trim();
  if (!raw) {
    throw new Error(
      "PLAID_TOKEN_ENCRYPTION_KEY (or PAYMENT_GATEWAY_ENCRYPTION_KEY) must be set before storing Plaid access tokens",
    );
  }
  return cryptoHash("sha256").update(raw).digest();
}

export function encryptPlaidToken(token: string): string {
  const key = getPlaidTokenEncryptionKey();
  const iv = cryptoRandomBytes(12);
  const cipher = cryptoCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

export function decryptPlaidToken(encrypted: string): string {
  const parsed = JSON.parse(encrypted) as {
    alg: string;
    iv: string;
    tag: string;
    ciphertext: string;
  };
  if (parsed.alg !== "aes-256-gcm") {
    throw new Error("Unsupported Plaid token encryption algorithm");
  }
  const key = getPlaidTokenEncryptionKey();
  const decipher = cryptoDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
