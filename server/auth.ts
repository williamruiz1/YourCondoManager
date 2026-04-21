import type { Express, NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { storage } from "./storage";
import { log } from "./logger";

type SessionWithOAuth = {
  oauthReturnTo?: string;
  oauthPopup?: boolean;
  oauthCallbackUrl?: string;
};

let passportConfigured = false;
const AUTH_RESTORE_TTL_SECONDS = Math.max(60, Number(process.env.AUTH_RESTORE_TTL_SECONDS || 15 * 60));
const authRestoreSecret = process.env.AUTH_RESTORE_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "";
const AUTH_RESTORE_SECRET = authRestoreSecret;
const AUTH_RESTORE_COOKIE = "auth_restore";

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signAuthRestorePayload(payloadB64: string): string {
  return createHmac("sha256", AUTH_RESTORE_SECRET).update(payloadB64).digest("base64url");
}

function readCookie(req: Request, name: string): string {
  const cookieHeader = req.header("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName !== name) continue;
    return decodeURIComponent(rest.join("="));
  }
  return "";
}

function isSecureRequest(req: Request): boolean {
  const forwardedProto = (req.header("x-forwarded-proto") || "").split(",")[0]?.trim().toLowerCase();
  return forwardedProto === "https" || req.secure;
}

function setAuthRestoreCookie(req: Request, res: Response, token: string) {
  res.cookie(AUTH_RESTORE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    maxAge: AUTH_RESTORE_TTL_SECONDS * 1000,
    path: "/api/auth/session/restore",
  });
}

function clearAuthRestoreCookie(req: Request, res: Response) {
  res.clearCookie(AUTH_RESTORE_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/api/auth/session/restore",
  });
}

export function createAuthRestoreToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: now,
    exp: now + AUTH_RESTORE_TTL_SECONDS,
    kind: "auth-restore",
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signAuthRestorePayload(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyAuthRestoreToken(token: string): { userId: string } | null {
  if (!token || !AUTH_RESTORE_SECRET) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;
  const expected = signAuthRestorePayload(payloadB64);
  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);
  if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as {
      sub?: string;
      exp?: number;
      kind?: string;
    };
    if (payload.kind !== "auth-restore") return null;
    if (!payload.sub || typeof payload.sub !== "string") return null;
    if (!payload.exp || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export function getGoogleOAuthConfig() {
  const clientID = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  const callbackURL = (process.env.GOOGLE_CALLBACK_URL || "").trim();
  const callbackUrlStrict = ["1", "true", "yes"].includes((process.env.GOOGLE_CALLBACK_URL_STRICT || "").trim().toLowerCase());
  const callbackPathRaw = (process.env.GOOGLE_CALLBACK_PATH || "/api/auth/google/callback").trim();
  const callbackPath = callbackPathRaw.startsWith("/") && !callbackPathRaw.startsWith("//")
    ? callbackPathRaw
    : "/api/auth/google/callback";
  const enabled = Boolean(clientID && clientSecret);
  return { enabled, clientID, clientSecret, callbackURL, callbackPath, callbackUrlStrict };
}

function requestOrigin(req: Request): string | null {
  const forwardedProto = (req.header("x-forwarded-proto") || "").split(",")[0]?.trim().toLowerCase();
  const forwardedHost = (req.header("x-forwarded-host") || "").split(",")[0]?.trim();
  const host = forwardedHost || req.header("host") || "";
  if (!host) return null;

  const proto = forwardedProto || (req.protocol ? req.protocol.toLowerCase() : "http");
  if (proto !== "http" && proto !== "https") return null;
  return `${proto}://${host}`;
}

export function resolveGoogleCallbackUrl(req: Request): string | null {
  const config = getGoogleOAuthConfig();
  const origin = requestOrigin(req);
  if (!origin) return config.callbackURL || null;

  const dynamicCallbackUrl = `${origin}${config.callbackPath}`;
  if (!config.callbackURL) return dynamicCallbackUrl;
  if (config.callbackUrlStrict) {
    try {
      const pinned = new URL(config.callbackURL);
      const current = new URL(origin);
      const sameOrigin = pinned.protocol === current.protocol && pinned.host === current.host;
      if (!sameOrigin) {
        console.warn("[auth][callback-url-strict-mismatch]", {
          configuredCallbackUrl: config.callbackURL,
          requestOrigin: origin,
          resolvedCallbackUrl: dynamicCallbackUrl,
        });
        return dynamicCallbackUrl;
      }
    } catch {
      return dynamicCallbackUrl;
    }
    return config.callbackURL;
  }

  try {
    const pinned = new URL(config.callbackURL);
    const current = new URL(origin);
    const sameOrigin = pinned.protocol === current.protocol && pinned.host === current.host;
    return sameOrigin ? config.callbackURL : dynamicCallbackUrl;
  } catch {
    return dynamicCallbackUrl;
  }
}

function profilePictureUrl(profile: Profile): string | null {
  const direct = profile.photos?.[0]?.value?.trim();
  if (direct) return direct;
  const jsonValue = (profile._json as Record<string, unknown> | undefined)?.picture;
  return typeof jsonValue === "string" && jsonValue.trim() ? jsonValue.trim() : null;
}

function profileNames(profile: Profile): { firstName: string | null; lastName: string | null } {
  const givenName = profile.name?.givenName?.trim() || "";
  const familyName = profile.name?.familyName?.trim() || "";

  const fallbackGiven = (profile._json as Record<string, unknown> | undefined)?.given_name;
  const fallbackFamily = (profile._json as Record<string, unknown> | undefined)?.family_name;

  return {
    firstName: givenName || (typeof fallbackGiven === "string" ? fallbackGiven.trim() || null : null),
    lastName: familyName || (typeof fallbackFamily === "string" ? fallbackFamily.trim() || null : null),
  };
}

async function resolveExistingAdminForAuthenticatedUser(input: { email: string }): Promise<{ adminUserId: string | null }> {
  const adminUser = await storage.getAdminUserByEmail(input.email);
  if (!adminUser || adminUser.isActive !== 1) {
    return { adminUserId: null };
  }
  return { adminUserId: adminUser.id };
}

function configurePassport() {
  if (passportConfigured) return;

  passport.serializeUser((user: Express.User, done) => {
    const id = (user as { id?: string }).id;
    if (!id) return done(new Error("Cannot serialize user without id"));
    done(null, id);
  });

  passport.deserializeUser(async (userId: string, done) => {
    try {
      const user = await storage.getAuthUserById(String(userId));
      if (!user) {
        log(`[auth][deserialize] user not found userId=${userId}`, "auth");
        return done(null, false);
      }
      if (user.isActive !== 1) {
        log(`[auth][deserialize] user inactive userId=${userId} email=${user.email} isActive=${user.isActive}`, "auth");
        return done(null, false);
      }
      return done(null, user as Express.User);
    } catch (error) {
      log(`[auth][deserialize] error userId=${userId} err=${(error as Error).message}`, "auth");
      return done(error as Error);
    }
  });

  const google = getGoogleOAuthConfig();
  if (google.enabled) {
    const strategyCallbackUrl = google.callbackURL || "http://localhost:5000/api/auth/google/callback";
    passport.use(new GoogleStrategy(
      {
        clientID: google.clientID,
        clientSecret: google.clientSecret,
        callbackURL: strategyCallbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const providerAccountId = profile.id?.trim();
          if (!providerAccountId) {
            log("[auth][google] missing provider account id", "auth");
            return done(new Error("Google profile is missing account id"));
          }

          const email = profile.emails?.[0]?.value?.trim().toLowerCase() || "";
          if (!email) {
            log(`[auth][google] missing email for providerAccountId=${providerAccountId}`, "auth");
            return done(new Error("Google profile is missing a verified email"));
          }

          log(`[auth][google] callback for email=${email} providerAccountId=${providerAccountId}`, "auth");

          const names = profileNames(profile);
          const avatarUrl = profilePictureUrl(profile);
          const profileJson = profile._json && typeof profile._json === "object" ? profile._json : null;

          let linkedUser = null;
          const external = await storage.getAuthExternalAccount("google", providerAccountId);
          if (external) {
            linkedUser = await storage.getAuthUserById(external.userId);
            log(`[auth][google] external account found userId=${external.userId} linkedUser=${linkedUser ? "found" : "missing"}`, "auth");
          } else {
            log(`[auth][google] no external account for providerAccountId=${providerAccountId}`, "auth");
          }

          if (!linkedUser) {
            linkedUser = await storage.getAuthUserByEmail(email);
            log(`[auth][google] email lookup email=${email} found=${!!linkedUser}`, "auth");
          }

          const bootstrap = await resolveExistingAdminForAuthenticatedUser({ email });
          log(`[auth][google] admin bootstrap email=${email} adminUserId=${bootstrap.adminUserId ?? "null"}`, "auth");

          if (!linkedUser) {
            linkedUser = await storage.createAuthUser({
              adminUserId: bootstrap.adminUserId,
              email,
              firstName: names.firstName,
              lastName: names.lastName,
              avatarUrl,
              isActive: 1,
            });
            log(`[auth][google] created new auth user id=${linkedUser.id} email=${email} adminUserId=${bootstrap.adminUserId ?? "null"}`, "auth");
          } else {
            const prevAdminUserId = linkedUser.adminUserId;
            linkedUser = await storage.updateAuthUser(linkedUser.id, {
              adminUserId: bootstrap.adminUserId,
              firstName: names.firstName ?? linkedUser.firstName,
              lastName: names.lastName ?? linkedUser.lastName,
              avatarUrl: avatarUrl ?? linkedUser.avatarUrl,
              isActive: 1,
            }) ?? linkedUser;
            log(`[auth][google] updated auth user id=${linkedUser.id} email=${email} adminUserId=${prevAdminUserId ?? "null"} -> ${bootstrap.adminUserId ?? "null"} isActive=1`, "auth");
          }

          await storage.upsertAuthExternalAccount({
            userId: linkedUser.id,
            provider: "google",
            providerAccountId,
            providerEmail: email,
            profileJson,
          });
          await storage.touchAuthUserLogin(linkedUser.id);

          log(`[auth][google] login complete email=${email} authUserId=${linkedUser.id} adminUserId=${linkedUser.adminUserId ?? "null"} isActive=${linkedUser.isActive}`, "auth");
          return done(null, linkedUser as Express.User);
        } catch (error) {
          log(`[auth][google] error: ${(error as Error).message}`, "auth");
          return done(error as Error);
        }
      },
    ));
  }

  passportConfigured = true;
}

export function initializeAuth(app: Express) {
  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());
}

function getSafeReturnTo(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate.startsWith("/")) return "/";
  if (candidate.startsWith("//")) return "/";
  return candidate;
}

function ensureGoogleOAuthConfigured(req: Request, res: Response): boolean {
  const config = getGoogleOAuthConfig();
  if (config.enabled) return true;

  if (req.path.startsWith("/api/")) {
    res.status(503).json({ message: "Google OAuth is not configured" });
    return false;
  }

  res.status(503).send("Google OAuth is not configured");
  return false;
}

export function getGoogleOAuthStatus(req: Request) {
  const config = getGoogleOAuthConfig();
  const resolvedCallbackUrl = resolveGoogleCallbackUrl(req);
  return {
    enabled: config.enabled,
    clientConfigured: Boolean(config.clientID && config.clientSecret),
    callbackPath: config.callbackPath,
    configuredCallbackUrl: config.callbackURL || null,
    callbackUrlStrict: config.callbackUrlStrict,
    requestOrigin: requestOrigin(req),
    resolvedCallbackUrl,
    callbackRoutes: [
      "/auth/google/callback",
      "/api/auth/google/callback",
      "/callback/google",
      "/api/callback/google",
    ],
  };
}

export function registerAuthRoutes(app: Express) {
  const startGoogleOAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!ensureGoogleOAuthConfigured(req, res)) return;
    const callbackURL = resolveGoogleCallbackUrl(req);
    if (!callbackURL) {
      return res.status(503).json({ message: "Google OAuth callback URL could not be resolved" });
    }

    const forceSelectRaw = typeof req.query.forceSelect === "string" ? req.query.forceSelect : "";
    const forceSelect = forceSelectRaw === "1" || forceSelectRaw.toLowerCase() === "true";
    const popupRaw = typeof req.query.popup === "string" ? req.query.popup : "";
    const popup = popupRaw === "1" || popupRaw.toLowerCase() === "true";
    const returnTo = getSafeReturnTo(req.query.returnTo);
    (req.session as SessionWithOAuth).oauthReturnTo = returnTo;
    (req.session as SessionWithOAuth).oauthPopup = popup;
    (req.session as SessionWithOAuth).oauthCallbackUrl = callbackURL;

    const auth = passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: forceSelect ? "select_account" : undefined,
      callbackURL,
    } as any);
    auth(req, res, next);
  };

  const handleGoogleOAuthCallback = (req: Request, res: Response, next: NextFunction) => {
    if (!ensureGoogleOAuthConfigured(req, res)) return;
    const callbackURL = (req.session as SessionWithOAuth).oauthCallbackUrl || resolveGoogleCallbackUrl(req);
    if (!callbackURL) {
      return res.status(503).json({ message: "Google OAuth callback URL could not be resolved" });
    }

    passport.authenticate("google", { failureRedirect: "/?auth=failed", callbackURL } as any)(req, res, (error?: unknown) => {
      if (error) return next(error);
      const returnTo = getSafeReturnTo((req.session as SessionWithOAuth).oauthReturnTo || "/");
      const popup = Boolean((req.session as SessionWithOAuth).oauthPopup);
      const authUserId = (req.user as { id?: string } | undefined)?.id || "";
      const authRestore = authUserId ? createAuthRestoreToken(authUserId) : "";
      if (authRestore) {
        setAuthRestoreCookie(req, res, authRestore);
      }
      delete (req.session as SessionWithOAuth).oauthReturnTo;
      delete (req.session as SessionWithOAuth).oauthPopup;
      delete (req.session as SessionWithOAuth).oauthCallbackUrl;

      if (popup) {
        const safeReturnTo = `${returnTo}${returnTo.includes("?") ? "&" : "?"}auth=success`;
        const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Authentication Complete</title></head>
  <body>
    <p>Authentication complete. You can close this window.</p>
    <script>
      (function() {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: "google-oauth-success", returnTo: ${JSON.stringify(safeReturnTo)} }, window.location.origin);
          }
        } catch (_error) {}
        setTimeout(function() {
          try { window.close(); } catch (_error) {}
        }, 50);
      })();
    </script>
  </body>
</html>`;
        return res.status(200).send(html);
      }

      const redirectWithAuth = `${returnTo}${returnTo.includes("?") ? "&" : "?"}auth=success`;
      return res.redirect(redirectWithAuth);
    });
  };

  app.get("/auth/google", startGoogleOAuth);
  app.get("/api/auth/google", startGoogleOAuth);

  app.get("/auth/google/callback", handleGoogleOAuthCallback);
  app.get("/api/auth/google/callback", handleGoogleOAuthCallback);
  app.get("/callback/google", handleGoogleOAuthCallback);
  app.get("/api/callback/google", handleGoogleOAuthCallback);

  // GET /api/auth/magic/:token — signup magic-link fallback (4.4 Q7 AC 20)
  //
  // Consumed by the email sent from /api/public/signup/complete when auto-session
  // establishment fails. Verifies the HMAC-signed token (15-min TTL per
  // AUTH_RESTORE_TTL_SECONDS), calls req.login() to set the sid cookie, and
  // redirects to /app. No password prompt (AC 22 — OTP-first signup preserved).
  const handleMagicLinkConsume = async (req: Request, res: Response) => {
    const token = typeof req.params.token === "string" ? req.params.token : "";
    const verified = verifyAuthRestoreToken(token);
    if (!verified) {
      log("[auth][magic] token invalid or expired", "auth");
      return res.redirect("/pricing?auth=magic-expired");
    }

    const user = await storage.getAuthUserById(verified.userId);
    if (!user || user.isActive !== 1) {
      log(`[auth][magic] user missing or inactive userId=${verified.userId}`, "auth");
      return res.redirect("/pricing?auth=magic-invalid");
    }

    req.login(user as Express.User, async (error) => {
      if (error) {
        log(`[auth][magic] req.login failed userId=${user.id} err=${error.message}`, "auth");
        return res.redirect("/pricing?auth=magic-failed");
      }
      await storage.touchAuthUserLogin(user.id);
      log(`[auth][magic] session established userId=${user.id} email=${user.email} adminUserId=${user.adminUserId ?? "null"}`, "auth");
      return res.redirect("/app?auth=magic-success");
    });
  };
  app.get("/api/auth/magic/:token", handleMagicLinkConsume);
  app.get("/auth/magic/:token", handleMagicLinkConsume);

  app.post("/api/auth/session/restore", async (req: Request, res: Response) => {
    const payload = readCookie(req, AUTH_RESTORE_COOKIE);
    if (!payload) return res.status(400).json({ message: "payload is required" });

    const verified = verifyAuthRestoreToken(payload);
    if (!verified) {
      clearAuthRestoreCookie(req, res);
      log("[auth][restore] token invalid or expired", "auth");
      return res.status(403).json({ message: "Invalid or expired auth restore payload" });
    }

    const user = await storage.getAuthUserById(verified.userId);
    if (!user) {
      clearAuthRestoreCookie(req, res);
      log(`[auth][restore] user not found userId=${verified.userId}`, "auth");
      return res.status(403).json({ message: "Auth user not found or inactive" });
    }
    if (user.isActive !== 1) {
      clearAuthRestoreCookie(req, res);
      log(`[auth][restore] user inactive userId=${verified.userId} email=${user.email} isActive=${user.isActive}`, "auth");
      return res.status(403).json({ message: "Auth user not found or inactive" });
    }

    req.login(user as Express.User, async (error) => {
      if (error) {
        clearAuthRestoreCookie(req, res);
        log(`[auth][restore] req.login failed userId=${user.id} err=${error.message}`, "auth");
        return res.status(500).json({ message: "Failed to restore session" });
      }
      clearAuthRestoreCookie(req, res);
      await storage.touchAuthUserLogin(user.id);
      log(`[auth][restore] session restored userId=${user.id} email=${user.email} adminUserId=${user.adminUserId ?? "null"}`, "auth");
      return res.status(201).json({ authenticated: true, user });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ authenticated: false });
    }
    const authUser = req.user as { adminUserId?: string | null; email?: string | null };
    const adminUser = authUser.adminUserId
      ? await storage.getAdminUserById(authUser.adminUserId)
      : (authUser.email ? await storage.getAdminUserByEmail(authUser.email) : undefined);
    return res.json({
      authenticated: true,
      user: req.user,
      admin: adminUser && adminUser.isActive === 1
        ? {
            id: adminUser.id,
            email: adminUser.email,
            role: adminUser.role,
          }
        : null,
    });
  });

  const logoutHandler = (req: Request, res: Response) => {
    req.logout((logoutError) => {
      if (logoutError) return res.status(500).json({ message: "Failed to logout" });

      if (!req.session) {
        res.clearCookie("sid");
        return res.status(204).send();
      }

      req.session.destroy((sessionError) => {
        if (sessionError) return res.status(500).json({ message: "Failed to destroy session" });
        res.clearCookie("sid");
        return res.status(204).send();
      });
    });
  };

  app.post("/auth/logout", logoutHandler);
  app.post("/api/auth/logout", logoutHandler);
}
