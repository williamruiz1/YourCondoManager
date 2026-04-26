// Wave 16d — Test-only routes for Playwright real-session helpers.
//
// GATING: registerTestRoutes() refuses to register unless
// NODE_ENV=test AND PLAYWRIGHT_TEST_MODE=1. Each handler ALSO
// re-checks the gate on every request (defense-in-depth runtime
// guard). Production cannot reach these endpoints.
//
// Endpoints:
//   POST /api/auth/test-login        { email } → mints a real
//        express-session cookie via passport.serializeUser. ONLY for
//        emails that already exist in admin_users (second gate).
//   GET  /api/__test/last-otp?email= → returns the most recent OTP
//        captured for that email within the last 60 seconds.
//
// See server/__tests__/test-routes.test.ts for the security audit.

import type { Express, NextFunction, Request, Response } from "express";
import { storage } from "./storage";
import { log } from "./logger";

/** Strict — any other value (empty string, "0", "false") returns false. */
export function isTestModeEnabled(): boolean {
  return process.env.NODE_ENV === "test" && process.env.PLAYWRIGHT_TEST_MODE === "1";
}

// ---------------------------------------------------------------------------
// In-memory OTP capture store (the "dev mailer").
// sendPlatformEmail() calls captureTestEmail() on every send; the
// function is a no-op outside test mode. Ring buffer: max 50 entries,
// 60s TTL.
// ---------------------------------------------------------------------------

type CapturedEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  capturedAt: number;
};

const CAPTURE_TTL_MS = 60_000;
const CAPTURE_MAX = 50;
const captureBuffer: CapturedEmail[] = [];

export function captureTestEmail(payload: {
  to: string | string[] | null | undefined;
  subject?: string;
  text?: string | null;
  html?: string | null;
}): void {
  if (!isTestModeEnabled()) return;
  const recipients = Array.isArray(payload.to)
    ? payload.to
    : typeof payload.to === "string"
      ? payload.to.split(",")
      : [];
  const now = Date.now();
  while (captureBuffer.length > 0 && now - captureBuffer[0].capturedAt > CAPTURE_TTL_MS) {
    captureBuffer.shift();
  }
  while (captureBuffer.length >= CAPTURE_MAX) {
    captureBuffer.shift();
  }
  for (const raw of recipients) {
    const recipient = raw.trim().toLowerCase();
    if (!recipient) continue;
    captureBuffer.push({
      to: recipient,
      subject: payload.subject ?? "",
      text: payload.text ?? "",
      html: payload.html ?? "",
      capturedAt: now,
    });
  }
}

const OTP_PATTERN = /\b(\d{6})\b/;

/** For unit tests only — clears the ring buffer. */
export function __resetTestCaptureForTests(): void {
  captureBuffer.length = 0;
}

// ---------------------------------------------------------------------------
// Route handlers.
// ---------------------------------------------------------------------------

function gateRequest(_req: Request, res: Response, next: NextFunction): void {
  if (!isTestModeEnabled()) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  next();
}

async function handleTestLogin(req: Request, res: Response): Promise<void> {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!rawEmail) {
      res.status(400).json({ message: "email is required" });
      return;
    }

    // Second gate — even if the env-var gate accidentally leaked, the
    // endpoint can only mint sessions for emails that already exist in
    // admin_users.
    const adminUser = await storage.getAdminUserByEmail(rawEmail);
    if (!adminUser || adminUser.isActive !== 1) {
      log(`[test-login] no active admin_user for email=${rawEmail}`, "auth");
      res.status(404).json({ message: "Admin user not found" });
      return;
    }

    let authUser = await storage.getAuthUserByEmail(rawEmail);
    if (!authUser) {
      authUser = await storage.createAuthUser({
        adminUserId: adminUser.id,
        email: rawEmail,
        firstName: null,
        lastName: null,
        avatarUrl: null,
        isActive: 1,
      });
    } else if (authUser.adminUserId !== adminUser.id || authUser.isActive !== 1) {
      authUser = (await storage.updateAuthUser(authUser.id, {
        adminUserId: adminUser.id,
        isActive: 1,
      })) ?? authUser;
    }
    if (!authUser) {
      res.status(500).json({ message: "Failed to resolve auth user" });
      return;
    }

    // req.login → passport.serializeUser → express-session, exactly as
    // the Google OAuth callback does. Only Google's identity assertion
    // is bypassed; the cookie+session roundtrip is genuine.
    req.login(authUser as Express.User, async (error?: unknown) => {
      if (error) {
        log(`[test-login] req.login failed err=${(error as Error).message}`, "auth");
        res.status(500).json({ message: "Failed to establish session" });
        return;
      }
      try {
        await storage.touchAuthUserLogin(authUser!.id);
      } catch (_err) {
        /* non-fatal */
      }
      log(`[test-login] session established email=${rawEmail} adminUserId=${adminUser.id}`, "auth");
      res.status(200).json({
        ok: true,
        authenticated: true,
        adminUserId: adminUser.id,
        authUserId: authUser!.id,
        email: rawEmail,
      });
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
}

function handleLastOtp(req: Request, res: Response): void {
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  if (!email) {
    res.status(400).json({ message: "email query parameter is required" });
    return;
  }
  const now = Date.now();
  // Search newest-first.
  for (let i = captureBuffer.length - 1; i >= 0; i -= 1) {
    const entry = captureBuffer[i];
    if (entry.to !== email) continue;
    if (now - entry.capturedAt > CAPTURE_TTL_MS) continue;
    const match = `${entry.text}\n${entry.html}`.match(OTP_PATTERN);
    if (!match) continue;
    res.status(200).json({
      otp: match[1],
      subject: entry.subject,
      capturedAt: new Date(entry.capturedAt).toISOString(),
      ageMs: now - entry.capturedAt,
    });
    return;
  }
  res.status(404).json({ message: "No recent OTP captured for that email" });
}

/**
 * Register the test-only routes on `app`. Returns false (no-op) unless
 * isTestModeEnabled() — this is the load-bearing registration-time gate
 * for the security audit.
 */
export function registerTestRoutes(app: Express): boolean {
  if (!isTestModeEnabled()) {
    log("[test-routes] refusing to register — gate is closed", "auth");
    return false;
  }
  app.post("/api/auth/test-login", gateRequest, handleTestLogin);
  app.get("/api/__test/last-otp", gateRequest, handleLastOtp);
  log("[test-routes] registered POST /api/auth/test-login + GET /api/__test/last-otp", "auth");
  return true;
}
