/**
 * Plaid webhook JWT (JWS) verification — production-grade, zero new dependencies.
 *
 * Plaid signs every webhook with an ES256 (ECDSA P-256) JWS placed in the
 * `Plaid-Verification` HTTP header. The signed payload's body is a JWT whose
 * claims include:
 *   - `iat`                 — issued-at unix seconds (replay window)
 *   - `request_body_sha256` — SHA-256 hex digest of the RAW request body
 *
 * Verification procedure (per https://plaid.com/docs/api/webhooks/webhook-verification/):
 *   1. Decode the JWT header, read `alg` (MUST be ES256) + `kid`.
 *   2. Fetch the JWK public key for that `kid` via /webhook_verification_key/get
 *      (cached; refreshed on cache miss / key rotation).
 *   3. Verify the JWS signature against the cached public key.
 *   4. Verify the JWT is fresh — `iat` within REPLAY_WINDOW_S (default 5 min).
 *   5. Compute SHA-256 of the RAW request body and constant-time-compare it to
 *      the `request_body_sha256` claim.
 *
 * If ANY step fails, verification THROWS — the caller must reject the webhook
 * (do NOT process it). This closes the prior stub that accepted any unsigned
 * body in production.
 *
 * Why no new dependency: Node's builtin `crypto` natively imports a JWK EC key
 * via `createPublicKey({ key, format: "jwk" })` and verifies ES256 with
 * `crypto.verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, sig)`.
 * The JWS signature is the raw 64-byte r||s (ieee-p1363) form, which is exactly
 * what `dsaEncoding: "ieee-p1363"` expects. Keeping zero JWT deps matters for
 * the slimmed production image (devDependencies absent).
 */

import crypto from "node:crypto";
import type { PlaidApi, JWKPublicKey } from "plaid";

// ── Tunables ─────────────────────────────────────────────────────────────────

// Reject webhooks whose `iat` is older than this — replay protection. Plaid's
// own guidance is 5 minutes.
const REPLAY_WINDOW_S = Number(process.env.PLAID_WEBHOOK_REPLAY_WINDOW_S || 5 * 60);

// In-process JWK cache TTL. Keys rarely rotate; a short TTL keeps a rotated key
// from being trusted indefinitely while avoiding a key fetch on every webhook.
const KEY_CACHE_TTL_MS = Number(process.env.PLAID_WEBHOOK_KEY_CACHE_TTL_MS || 24 * 60 * 60 * 1000);

// ── JWK cache ────────────────────────────────────────────────────────────────

type CachedKey = { jwk: JWKPublicKey; fetchedAt: number };
const keyCache = new Map<string, CachedKey>();

/** Test-only: clear the JWK cache between cases. */
export function __clearKeyCacheForTests(): void {
  keyCache.clear();
}

// ── base64url helpers ────────────────────────────────────────────────────────

function base64UrlDecodeToBuffer(input: string): Buffer {
  // base64url → base64, then Buffer handles padding tolerance.
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function base64UrlDecodeToString(input: string): string {
  return base64UrlDecodeToBuffer(input).toString("utf8");
}

// ── JWT parsing ──────────────────────────────────────────────────────────────

interface JwtHeader {
  alg: string;
  kid?: string;
  typ?: string;
}

interface PlaidWebhookClaims {
  iat?: number;
  request_body_sha256?: string;
}

interface ParsedJws {
  header: JwtHeader;
  claims: PlaidWebhookClaims;
  // The exact bytes that were signed: `${headerB64}.${payloadB64}`.
  signingInput: Buffer;
  // Raw signature bytes (ieee-p1363 r||s for ES256).
  signature: Buffer;
}

function parseJws(token: string): ParsedJws {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Plaid webhook: malformed JWT (expected 3 segments)");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: JwtHeader;
  let claims: PlaidWebhookClaims;
  try {
    header = JSON.parse(base64UrlDecodeToString(headerB64)) as JwtHeader;
  } catch {
    throw new Error("Plaid webhook: JWT header is not valid JSON");
  }
  try {
    claims = JSON.parse(base64UrlDecodeToString(payloadB64)) as PlaidWebhookClaims;
  } catch {
    throw new Error("Plaid webhook: JWT payload is not valid JSON");
  }

  return {
    header,
    claims,
    signingInput: Buffer.from(`${headerB64}.${payloadB64}`, "utf8"),
    signature: base64UrlDecodeToBuffer(signatureB64),
  };
}

// ── Key resolution ───────────────────────────────────────────────────────────

/**
 * Fetch (and cache) the JWK for a given key id. On a cache miss, or when the
 * cached entry is stale, this calls Plaid's /webhook_verification_key/get.
 *
 * Plaid may return a key flagged `expired_at` during rotation — an expired key
 * must never be trusted for new webhooks.
 */
async function getVerificationKey(
  client: PlaidApi,
  keyId: string,
): Promise<JWKPublicKey> {
  const cached = keyCache.get(keyId);
  if (cached && Date.now() - cached.fetchedAt < KEY_CACHE_TTL_MS) {
    if (cached.jwk.expired_at != null) {
      throw new Error(`Plaid webhook: cached verification key ${keyId} is expired`);
    }
    return cached.jwk;
  }

  const resp = await client.webhookVerificationKeyGet({ key_id: keyId });
  const jwk = resp.data.key;
  if (!jwk) {
    throw new Error(`Plaid webhook: no verification key returned for kid ${keyId}`);
  }
  if (jwk.expired_at != null) {
    // A rotated-out key — never trust it for a fresh webhook.
    throw new Error(`Plaid webhook: verification key ${keyId} is expired`);
  }
  keyCache.set(keyId, { jwk, fetchedAt: Date.now() });
  return jwk;
}

/** Import a Plaid EC P-256 JWK into a Node KeyObject (zero JWT deps). */
function importJwk(jwk: JWKPublicKey): crypto.KeyObject {
  // Plaid keys are EC, crv P-256, with x/y on the JWK. The plaid SDK type only
  // declares alg/crv/kid/kty/use/created_at/expired_at, but the wire payload
  // carries x + y. Pull them defensively.
  const anyJwk = jwk as unknown as { kty: string; crv: string; x?: string; y?: string };
  if (anyJwk.kty !== "EC") {
    throw new Error(`Plaid webhook: unsupported key type ${anyJwk.kty} (expected EC)`);
  }
  if (!anyJwk.x || !anyJwk.y) {
    throw new Error("Plaid webhook: verification key missing EC coordinates");
  }
  return crypto.createPublicKey({
    key: {
      kty: "EC",
      crv: anyJwk.crv,
      x: anyJwk.x,
      y: anyJwk.y,
    },
    format: "jwk",
  });
}

// ── Public surface ───────────────────────────────────────────────────────────

/**
 * Verify a Plaid webhook. Throws on ANY verification failure; resolves silently
 * on success.
 *
 * @param client    a configured PlaidApi (used to fetch the JWK)
 * @param jwtToken  the value of the `Plaid-Verification` header
 * @param rawBody   the EXACT raw request body string Plaid POSTed (not re-serialized)
 */
export async function verifyPlaidWebhook(
  client: PlaidApi,
  jwtToken: string,
  rawBody: string,
): Promise<void> {
  if (!jwtToken) {
    throw new Error("Plaid webhook: missing Plaid-Verification header");
  }

  const { header, claims, signingInput, signature } = parseJws(jwtToken);

  // 1. Algorithm must be ES256 — never accept `alg: none` or an RSA downgrade.
  if (header.alg !== "ES256") {
    throw new Error(`Plaid webhook: unexpected JWT alg ${header.alg} (expected ES256)`);
  }
  if (!header.kid) {
    throw new Error("Plaid webhook: JWT header missing kid");
  }

  // 2. Resolve the public key for this kid.
  const jwk = await getVerificationKey(client, header.kid);
  const publicKey = importJwk(jwk);

  // 3. Verify the JWS signature. Plaid emits the raw r||s (ieee-p1363) form.
  const signatureValid = crypto.verify(
    "sha256",
    signingInput,
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    signature,
  );
  if (!signatureValid) {
    throw new Error("Plaid webhook: JWT signature verification failed");
  }

  // 4. Freshness — reject replays. `iat` must be present and recent.
  if (typeof claims.iat !== "number") {
    throw new Error("Plaid webhook: JWT missing iat claim");
  }
  const ageS = Math.floor(Date.now() / 1000) - claims.iat;
  if (ageS > REPLAY_WINDOW_S) {
    throw new Error(
      `Plaid webhook: stale webhook (iat ${ageS}s old, window ${REPLAY_WINDOW_S}s)`,
    );
  }

  // 5. Body integrity — the signed `request_body_sha256` MUST match the raw
  //    body we actually received. This is what binds the signature to THIS
  //    payload and is why the caller must pass the unmodified raw bytes.
  if (!claims.request_body_sha256) {
    throw new Error("Plaid webhook: JWT missing request_body_sha256 claim");
  }
  const actualBodyHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  const expected = Buffer.from(claims.request_body_sha256, "utf8");
  const actual = Buffer.from(actualBodyHash, "utf8");
  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  ) {
    throw new Error("Plaid webhook: request body hash mismatch (tampered or wrong raw body)");
  }
}
