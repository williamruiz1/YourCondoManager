/**
 * Web Push Provider — VAPID-based push notifications.
 *
 * Credential resolution order:
 *   1. Environment variable (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
 *   2. platform_secrets database table (set via Platform Controls UI)
 *   3. Simulation mode
 *
 * Generate keys once with: npx web-push generate-vapid-keys
 */

import crypto from "crypto";
import { getSecret } from "./platform-secrets-store";

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
};

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
};

export type SendPushResult = {
  status: "sent" | "failed" | "simulated" | "expired";
  errorMessage?: string | null;
};

async function getVapidConfig() {
  return {
    publicKey: await getSecret("VAPID_PUBLIC_KEY", "vapid.publicKey"),
    privateKey: await getSecret("VAPID_PRIVATE_KEY", "vapid.privateKey"),
    subject: await getSecret("VAPID_SUBJECT", "vapid.subject") ?? "mailto:admin@yourcondomanager.org",
  };
}

export async function isPushProviderConfigured(): Promise<boolean> {
  const cfg = await getVapidConfig();
  return Boolean(cfg.publicKey && cfg.privateKey);
}

export async function getVapidPublicKey(): Promise<string | null> {
  return (await getVapidConfig()).publicKey;
}

export async function getPushProviderStatus() {
  const cfg = await getVapidConfig();
  return {
    configured: Boolean(cfg.publicKey && cfg.privateKey),
    vapidPublicKeySet: Boolean(cfg.publicKey),
    vapidPrivateKeySet: Boolean(cfg.privateKey),
    subject: cfg.subject,
  };
}

/**
 * Build the JWT Authorization header for the Web Push request (VAPID).
 * This avoids requiring the web-push npm package.
 */
function base64urlEncode(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

/**
 * Derive the uncompressed public key (x, y coordinates) from a raw 32-byte
 * VAPID private key using EC key generation. The private key is expected in
 * URL-safe base64 encoding (the format produced by web-push generate-vapid-keys).
 */
function derivePublicKeyFromPrivate(privateKeyB64url: string): { x: string; y: string } {
  // Build a proper PKCS8 DER structure for a P-256 EC private key.
  // PKCS8 header for EC P-256:
  //   SEQUENCE { SEQUENCE { OID ecPublicKey, OID prime256v1 }, OCTET STRING { EC private key } }
  const rawPrivateKey = base64urlDecode(privateKeyB64url);
  const pkcs8Header = Buffer.from(
    "308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420",
    "hex",
  );
  const pkcs8Der = Buffer.concat([pkcs8Header, rawPrivateKey]);

  const keyObject = crypto.createPrivateKey({ key: pkcs8Der, format: "der", type: "pkcs8" });
  const jwk = keyObject.export({ format: "jwk" });
  return { x: jwk.x as string, y: jwk.y as string };
}

async function buildVapidJwt(endpoint: string, vapidPrivateKey: string, subject: string): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600; // 12 hours

  const header = base64urlEncode(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64urlEncode(Buffer.from(JSON.stringify({ aud: audience, exp, sub: subject })));
  const signingInput = `${header}.${payload}`;

  try {
    // Derive proper x/y coordinates from the private key
    const { x, y } = derivePublicKeyFromPrivate(vapidPrivateKey);

    const privateKeyJwk = {
      kty: "EC" as const,
      crv: "P-256" as const,
      d: vapidPrivateKey,
      x,
      y,
    };

    const ck = crypto.createPrivateKey({ key: privateKeyJwk, format: "jwk" });
    const sig = crypto.sign("SHA256", Buffer.from(signingInput), { key: ck, dsaEncoding: "ieee-p1363" });
    return `${signingInput}.${base64urlEncode(sig)}`;
  } catch {
    throw new Error("Failed to sign VAPID JWT — check VAPID_PRIVATE_KEY format");
  }
}

/**
 * Encrypt the push message payload using Web Push encryption (RFC 8291).
 * Returns the encrypted ciphertext and content-encoding headers.
 */
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authKey: string,
): Promise<{ ciphertext: Buffer; salt: Buffer; serverPublicKey: Buffer }> {
  const recipientPublicKey = base64urlDecode(p256dhKey);
  const authSecret = base64urlDecode(authKey);

  // Generate ephemeral EC key pair
  const { privateKey: serverPrivateKey, publicKey: serverPublicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  const serverPublicKeyRaw = serverPublicKey.export({ format: "der", type: "spki" }).slice(-65);

  // ECDH shared secret
  const recipientKey = crypto.createPublicKey({
    key: recipientPublicKey,
    format: "der",
    type: "spki",
  });
  // Note: Web Push requires the raw 65-byte uncompressed public key
  const recipientKeyFull = crypto.createPublicKey({
    key: Buffer.concat([
      Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex"),
      recipientPublicKey,
    ]),
    format: "der",
    type: "spki",
  });

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(recipientPublicKey);
  const localPublicKey = Buffer.from(ecdh.getPublicKey());

  // salt
  const salt = crypto.randomBytes(16);

  // HKDF for content encryption key and nonce (simplified Web Push aes128gcm)
  const prk = crypto.createHmac("sha256", authSecret).update(sharedSecret).digest();
  const cekInfo = Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), localPublicKey, recipientPublicKey]);
  const cek = crypto.createHmac("sha256", prk).update(cekInfo).update(Buffer.from([1])).digest().slice(0, 16);
  const nonceInfo = Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), localPublicKey, recipientPublicKey]);
  const nonce = crypto.createHmac("sha256", prk).update(nonceInfo).update(Buffer.from([1])).digest().slice(0, 12);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const paddedPayload = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const encrypted = Buffer.concat([cipher.update(paddedPayload), cipher.final(), cipher.getAuthTag()]);

  // aes128gcm content: salt(16) + rs(4 big-endian, 4096) + keylen(1) + localPublicKey(65) + ciphertext
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const ciphertext = Buffer.concat([salt, rs, Buffer.from([localPublicKey.length]), localPublicKey, encrypted]);

  return { ciphertext, salt, serverPublicKey: localPublicKey };
}

/**
 * Send a Web Push notification to a single subscription endpoint.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionKeys,
  payload: PushPayload,
): Promise<SendPushResult> {
  const cfg = await getVapidConfig();

  if (!(await isPushProviderConfigured())) {
    console.warn("[push-provider][simulation]", { endpoint: subscription.endpoint.slice(0, 60), title: payload.title });
    return { status: "simulated" };
  }

  try {
    const payloadStr = JSON.stringify(payload);
    const { ciphertext } = await encryptPayload(payloadStr, subscription.p256dhKey, subscription.authKey);

    const jwt = await buildVapidJwt(subscription.endpoint, cfg.privateKey!, cfg.subject);
    const headers: Record<string, string> = {
      Authorization: `vapid t=${jwt},k=${cfg.publicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
    };

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers,
      body: ciphertext,
    });

    if (res.status === 201 || res.status === 200) {
      return { status: "sent" };
    }
    if (res.status === 404 || res.status === 410) {
      return { status: "expired" };
    }
    const text = await res.text().catch(() => "");
    return { status: "failed", errorMessage: `HTTP ${res.status}: ${text.slice(0, 100)}` };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[push-provider][send-error]", { endpoint: subscription.endpoint.slice(0, 60), errorMessage });
    return { status: "failed", errorMessage };
  }
}
