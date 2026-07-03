/**
 * Plaid webhook JWT verification tests (Plaid production hardening — P-2).
 *
 * Exercises the security-critical verifier with REAL ES256 keys generated in
 * the test, so valid/forged/tampered/replay cases are genuine cryptographic
 * outcomes — not mock asserts.
 *
 * Coverage:
 *   1. valid signed webhook (correct key, fresh iat, matching body hash) → passes
 *   2. forged signature (signed with a DIFFERENT key) → throws
 *   3. tampered body (body hash claim doesn't match raw body) → throws
 *   4. replay (iat older than the window) → throws
 *   5. wrong alg (alg != ES256, e.g. "none") → throws (no downgrade)
 *   6. missing Plaid-Verification header → throws
 *   7. expired verification key returned by Plaid → throws
 *   8. JWK key cache: a second webhook for the same kid does NOT refetch the key
 */

import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  verifyPlaidWebhook,
  __clearKeyCacheForTests,
} from "../services/bank-feed/plaid-webhook-verify";

// ── ES256 key + JWS helpers ──────────────────────────────────────────────────

function genEcKeyPair() {
  return crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
}

/** Export a public KeyObject as a Plaid-shaped JWK (with kid). */
function toPlaidJwk(publicKey: crypto.KeyObject, kid: string, expired = false) {
  const jwk = publicKey.export({ format: "jwk" }) as {
    kty: string;
    crv: string;
    x: string;
    y: string;
  };
  return {
    alg: "ES256",
    crv: jwk.crv,
    kid,
    kty: jwk.kty,
    use: "sig",
    x: jwk.x,
    y: jwk.y,
    created_at: Math.floor(Date.now() / 1000),
    expired_at: expired ? Math.floor(Date.now() / 1000) - 60 : null,
  };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Build + sign a Plaid-style JWS (ES256, ieee-p1363 raw signature). */
function signJws(
  privateKey: crypto.KeyObject,
  kid: string,
  claims: Record<string, unknown>,
): string {
  const header = { alg: "ES256", kid, typ: "JWT" };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = crypto.sign(
    "sha256",
    Buffer.from(signingInput, "utf8"),
    { key: privateKey, dsaEncoding: "ieee-p1363" },
  );
  return `${signingInput}.${b64url(signature)}`;
}

function bodyHash(rawBody: string): string {
  return crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
}

/** A fake PlaidApi whose only used method is webhookVerificationKeyGet. */
function fakeClient(jwkByKid: Record<string, unknown>, onFetch?: () => void) {
  return {
    webhookVerificationKeyGet: async ({ key_id }: { key_id: string }) => {
      onFetch?.();
      const key = jwkByKid[key_id];
      if (!key) throw new Error(`no key for ${key_id}`);
      return { data: { key } };
    },
  } as any;
}

// ── Tests ────────────────────────────────────────────────────────────────────

const RAW_BODY = JSON.stringify({
  webhook_type: "TRANSACTIONS",
  webhook_code: "SYNC_UPDATES_AVAILABLE",
  item_id: "item-123",
});

describe("Plaid webhook JWT verification (P-2)", () => {
  afterEach(() => __clearKeyCacheForTests());

  it("1. accepts a validly signed, fresh, body-matching webhook", async () => {
    const kp = genEcKeyPair();
    const kid = "kid-valid";
    const client = fakeClient({ [kid]: toPlaidJwk(kp.publicKey, kid) });
    const jwt = signJws(kp.privateKey, kid, {
      iat: Math.floor(Date.now() / 1000),
      request_body_sha256: bodyHash(RAW_BODY),
    });

    await expect(verifyPlaidWebhook(client, jwt, RAW_BODY)).resolves.toBeUndefined();
  });

  it("2. rejects a forged signature (signed with a different key)", async () => {
    const real = genEcKeyPair();
    const attacker = genEcKeyPair();
    const kid = "kid-forged";
    // Plaid hands us the REAL public key for this kid …
    const client = fakeClient({ [kid]: toPlaidJwk(real.publicKey, kid) });
    // … but the attacker signed with their OWN private key.
    const jwt = signJws(attacker.privateKey, kid, {
      iat: Math.floor(Date.now() / 1000),
      request_body_sha256: bodyHash(RAW_BODY),
    });

    await expect(verifyPlaidWebhook(client, jwt, RAW_BODY)).rejects.toThrow(
      /signature verification failed/i,
    );
  });

  it("3. rejects when the body was tampered (hash claim != raw body)", async () => {
    const kp = genEcKeyPair();
    const kid = "kid-tamper";
    const client = fakeClient({ [kid]: toPlaidJwk(kp.publicKey, kid) });
    // Sign over the ORIGINAL body's hash …
    const jwt = signJws(kp.privateKey, kid, {
      iat: Math.floor(Date.now() / 1000),
      request_body_sha256: bodyHash(RAW_BODY),
    });
    // … but deliver a DIFFERENT body (forged transaction injected).
    const tamperedBody = JSON.stringify({
      webhook_type: "TRANSACTIONS",
      webhook_code: "SYNC_UPDATES_AVAILABLE",
      item_id: "item-ATTACKER",
    });

    await expect(verifyPlaidWebhook(client, jwt, tamperedBody)).rejects.toThrow(
      /body hash mismatch/i,
    );
  });

  it("4. rejects a stale (replayed) webhook beyond the window", async () => {
    const kp = genEcKeyPair();
    const kid = "kid-replay";
    const client = fakeClient({ [kid]: toPlaidJwk(kp.publicKey, kid) });
    const jwt = signJws(kp.privateKey, kid, {
      // 10 minutes old — beyond the default 5-min replay window.
      iat: Math.floor(Date.now() / 1000) - 10 * 60,
      request_body_sha256: bodyHash(RAW_BODY),
    });

    await expect(verifyPlaidWebhook(client, jwt, RAW_BODY)).rejects.toThrow(
      /stale webhook/i,
    );
  });

  it("5. rejects a non-ES256 alg (no algorithm downgrade)", async () => {
    const kp = genEcKeyPair();
    const kid = "kid-alg";
    const client = fakeClient({ [kid]: toPlaidJwk(kp.publicKey, kid) });
    // Hand-build a token with alg: "none".
    const header = b64url(JSON.stringify({ alg: "none", kid, typ: "JWT" }));
    const payload = b64url(
      JSON.stringify({
        iat: Math.floor(Date.now() / 1000),
        request_body_sha256: bodyHash(RAW_BODY),
      }),
    );
    const jwt = `${header}.${payload}.`;

    await expect(verifyPlaidWebhook(client, jwt, RAW_BODY)).rejects.toThrow(
      /unexpected JWT alg/i,
    );
  });

  it("6. rejects a missing Plaid-Verification header (empty token)", async () => {
    const client = fakeClient({});
    await expect(verifyPlaidWebhook(client, "", RAW_BODY)).rejects.toThrow(
      /missing Plaid-Verification header/i,
    );
  });

  it("7. rejects when Plaid returns an expired verification key", async () => {
    const kp = genEcKeyPair();
    const kid = "kid-expired";
    const client = fakeClient({ [kid]: toPlaidJwk(kp.publicKey, kid, /* expired */ true) });
    const jwt = signJws(kp.privateKey, kid, {
      iat: Math.floor(Date.now() / 1000),
      request_body_sha256: bodyHash(RAW_BODY),
    });

    await expect(verifyPlaidWebhook(client, jwt, RAW_BODY)).rejects.toThrow(
      /expired/i,
    );
  });

  it("8. caches the JWK — second webhook for same kid does not refetch", async () => {
    const kp = genEcKeyPair();
    const kid = "kid-cache";
    let fetches = 0;
    const client = fakeClient({ [kid]: toPlaidJwk(kp.publicKey, kid) }, () => {
      fetches++;
    });
    const mkJwt = () =>
      signJws(kp.privateKey, kid, {
        iat: Math.floor(Date.now() / 1000),
        request_body_sha256: bodyHash(RAW_BODY),
      });

    await verifyPlaidWebhook(client, mkJwt(), RAW_BODY);
    await verifyPlaidWebhook(client, mkJwt(), RAW_BODY);

    expect(fetches).toBe(1);
  });
});
