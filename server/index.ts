import dotenv from "dotenv";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { initializeAuth, enforceSessionAbsoluteAge } from "./auth";
import { serveStatic } from "./static";
import { createServer } from "http";
// Wave 33 (5.4 Part B): seedDatabase is lazy-loaded in the boot block —
// see the import-time note further down and the dynamic `await import("./seed")`.
import { storage } from "./storage";
import { pool, db } from "./db";
import { eq } from "drizzle-orm";
import { autopayEnrollments, delinquencyEscalations } from "@shared/schema";
import { runAutopayCollectionForAssociation } from "./routes/autopay";
import { runAutopayRetries } from "./services/retry-service";
import { generateDelinquencyNotices } from "./services/delinquency-notice-service";
import { runSweep as runUnifiedAssessmentSweep } from "./assessment-execution";
import { fanOutCriticalAlerts } from "./alerts/notifications";
import { runOnboardingReminderSweep } from "./services/onboarding-reminder-sweep";
import { runBankFeedSweep } from "./services/bank-feed-sync";
import { runPressingItemsSweep } from "./services/pressing-items/scanner";
import { runUsageReconcileSweep } from "./services/usage-reconcile";
import { sendPlatformAdminEmailNotification } from "./admin-notification-service";
import { recoverInFlightJobs } from "./job-queue";
import { log } from "./logger";
import { runMigrationHealthCheck } from "./migration-health";
import { startElectionScheduler } from "./election-scheduler";
import { startDeprovisioningScheduler } from "./de-provisioning";
import { startVendorComplianceScheduler } from "./vendor-compliance-scheduler";
import { withSchedulerLock } from "./lib/scheduler-lock";
import { createRateLimiter, createPgRateLimiter, onWriteOnly, type RateLimitQuery } from "./rate-limit";
import { subdomainRedirect } from "./middleware/subdomain-redirect";
import { resolveSessionCookieDomain } from "./session-cookie-domain";
import { assertPlaidEnvSafe } from "./services/bank-feed/plaid-env-guard";
import { assertStripeFcEnvSafe } from "./services/bank-feed/stripe-fc-env-guard";

// Wave 33 (5.4 Part B): seed.ts is ~120 KB of static demo-data tables. It
// only runs once at boot, after the HTTP server has already started
// listening, so eager-bundling it bloats `dist/index.cjs` for no
// cold-start benefit. Lazy-load below in the boot block.
//
// The original eager import was: `import { seedDatabase } from "./seed"`

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

// Observability bootstrap (Sentry) is initialized inside the async boot
// block below so the CJS bundle target stays compatible. No-op when
// `SENTRY_DSN` is unset (local dev). See INSTALL-OBSERVABILITY.md for the
// production deploy steps (Issue founder-os#1030).
import { initServerObservability } from "./observability";

const app = express();
const httpServer = createServer(app);
const PgStore = connectPgSimple(session);

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error("Port 5000 is already in use. Stop the existing dev server before starting a new one.");
    process.exit(1);
  }
  console.error("HTTP server failed to start:", error);
  process.exit(1);
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  // Replit production traffic can traverse multiple proxy hops.
  // Trust forwarded proto/host so secure session cookies are issued reliably.
  app.set("trust proxy", true);
}

// Subdomain-aware redirect middleware (Issue #434). Must run AFTER
// `trust proxy = true` (so `req.hostname` reflects the original Host
// header behind Fly's proxy) and BEFORE session / body-parsing /
// route handlers (so we don't waste cycles on a request we're about
// to redirect). It bypasses /api/*, /api/auth/google/callback, /api/
// webhooks/*, /portal/login, /portal/verify — host-agnostic surfaces.
app.use(subdomainRedirect);

const sessionSecret = process.env.SESSION_SECRET?.trim();
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}
const sessionMaxAgeMs = Math.max(60_000, Number(process.env.SESSION_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000));
const sessionCookieSameSite = (() => {
  const raw = (process.env.SESSION_COOKIE_SAME_SITE || "lax").trim().toLowerCase();
  if (raw === "strict" || raw === "lax" || raw === "none") return raw;
  return "lax";
})();
const forceSecureCookie = (process.env.SESSION_COOKIE_SECURE || "").trim().toLowerCase();
const sessionCookieSecure: boolean | "auto" = forceSecureCookie
  ? forceSecureCookie === "1" || forceSecureCookie === "true" || forceSecureCookie === "yes"
  : (isProduction ? "auto" : false);

// Issue #447: scope the session cookie to the parent domain in production so
// login persists across `app.yourcondomanager.org` (product) and
// `yourcondomanager.org` (marketing). Without this the Set-Cookie header
// defaults to host-only scope and a user logged in on `app.` appears
// logged-out when they navigate to the apex marketing surface (cross-host
// navigation pattern enabled by PR #117 subdomain split).
//
// Default in production: `.yourcondomanager.org` (leading dot per RFC 6265
// for parent-domain scoping that covers apex + every subdomain). Env override
// `SESSION_COOKIE_DOMAIN` is the escape hatch for preview deploys or future
// domain changes — explicit empty string falls back to host-only behavior.
//
// Local dev / preview environments keep host-only behavior (the dev cookie
// is named `sid_dev` per existing config; cross-host persistence isn't a
// concern at localhost or *.fly.dev preview URLs).
const sessionCookieDomain: string | undefined = resolveSessionCookieDomain(
  isProduction,
  process.env.SESSION_COOKIE_DOMAIN,
);

app.use(session({
  store: new PgStore({
    pool,
    createTableIfMissing: true,
    tableName: "user_sessions",
  }),
  // Use a different name in development so the Replit IDE preview session
  // cookie never collides with the published app's "sid" cookie when both
  // are open in the same browser.
  name: isProduction ? "sid" : "sid_dev",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: sessionCookieSecure,
    sameSite: sessionCookieSameSite as "lax" | "strict" | "none",
    maxAge: sessionMaxAgeMs,
    // Issue #447 — parent-domain scoping in production only; undefined in
    // dev/preview defaults to host-only.
    domain: sessionCookieDomain,
  },
}));
initializeAuth(app);

// WS12 — absolute session timeout enforcement (Issue #388 / Plaid attestation).
// Runs after passport.session() so `req.user` is populated for authenticated
// requests; bails out cheaply for unauthenticated traffic. See
// docs/security/zero-trust-architecture.md §3.2 for rationale.
app.use(enforceSessionAbsoluteAge);

type AutomationJobState = {
  isRunning: boolean;
  timer: NodeJS.Timeout | null;
};

const globalAutomationState = globalThis as typeof globalThis & { __automationJobState?: AutomationJobState };

export { log } from "./logger";

async function runDueAutopayCharges(): Promise<{ succeeded: number; failed: number; skipped: number }> {
  // Find all associations with active autopay enrollments due
  const dueAssociations = await db
    .select({ associationId: autopayEnrollments.associationId })
    .from(autopayEnrollments)
    .where(eq(autopayEnrollments.status, "active"))
    .groupBy(autopayEnrollments.associationId);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const { associationId } of dueAssociations) {
    try {
      const result = await runAutopayCollectionForAssociation(associationId);
      succeeded += result.succeeded;
      failed += result.failed;
      skipped += result.skipped;
    } catch (err: any) {
      console.error(`[autopay-sweep] Error for association ${associationId}:`, err);
      failed++;
    }
  }

  return { succeeded, failed, skipped };
}

async function runAllDelinquencyNotices(): Promise<{ generated: number; skipped: number }> {
  const associations = await db
    .select({ associationId: delinquencyEscalations.associationId })
    .from(delinquencyEscalations)
    .where(eq(delinquencyEscalations.status, "active"))
    .groupBy(delinquencyEscalations.associationId);

  let generated = 0;
  let skipped = 0;
  for (const { associationId } of associations) {
    try {
      const result = await generateDelinquencyNotices(associationId);
      generated += result.generated;
      skipped += result.skipped;
    } catch (err: any) {
      console.error(`[notice-sweep] Error for association ${associationId}:`, err);
    }
  }
  return { generated, skipped };
}

async function runAutomationSweep() {
  // Wave 12 (Phase 5.1 cleanup): the unified assessment orchestrator is now
  // the sole poster. ASSESSMENT_EXECUTION_UNIFIED defaults ON; the legacy
  // per-subsystem functions (runDueRecurringCharges,
  // runAutomaticSpecialAssessmentInstallments) were retired alongside the
  // Q8 run-endpoint shims and no longer exist in the bundle.
  const [scheduledResult, escalationResult, boardPackageResult, assessmentSweep, autopayResult, retryResult, noticeResult, criticalAlertFanOut, accessReviewReminder, onboardingReminderResult, bankFeedSweepResult, pressingItemsResult, usageReconcileResult] = await Promise.all([
    storage.runScheduledNotices({ actedBy: "automation@system" }),
    storage.runMaintenanceEscalationSweep({ actorEmail: "automation@system" }),
    storage.runScheduledBoardPackageGeneration({ actorEmail: "automation@system" }),
    runUnifiedAssessmentSweep(),
    runDueAutopayCharges(),
    runAutopayRetries(),
    runAllDelinquencyNotices(),
    // 4.1 Tier 3 (Wave 32) — fan out critical alerts via push + email.
    // Wrapped to never throw out of the sweep — a misbehaving notification
    // path must not jam the rest of automation. Errors are logged and
    // counted as zero-result.
    fanOutCriticalAlerts().catch((error: unknown) => {
      console.error("[alert-notifications] fanOutCriticalAlerts failed:", error);
      return {
        scanned: 0,
        sentEmail: 0,
        sentPush: 0,
        failed: 0,
        rateLimited: 0,
        alreadyDelivered: 0,
        suppressedPreExisting: 0,
      };
    }),
    // WS7 Access Review (Issue #347) — quarterly reminder. Internally
    // gates on its own ~85-day cadence via the audit-log marker, so it's
    // safe to call from every sweep without flooding admins. Wrapped to
    // never throw out of the sweep.
    storage
      .runQuarterlyAccessReviewReminder({ actorEmail: "automation@system" })
      .catch((error: unknown) => {
        console.error("[access-review] quarterly reminder failed:", error);
        return { fired: false, reason: "error" } as { fired: boolean; reason: string };
      }),
    // #1617 — Day 7/10/12/13/14 onboarding wizard reminder cadence. Internally
    // idempotent (per-day timestamp column on `onboarding_progress`); wrapped
    // so a Resend outage can't jam the automation tick.
    runOnboardingReminderSweep().catch((error: unknown) => {
      console.error("[onboarding-reminder] sweep failed:", error);
      return { scanned: 0, sent: 0, failed: 0, skipped: 0 };
    }),
    // founder-os#2478 — Plaid bank-feed sync + reconcile. Per-tick pump that
    // picks every active connection past its staleness threshold and runs
    // the existing sync logic + the existing auto-matcher. Each per-connection
    // attempt is locked + audited (bank_feed_sync_runs). Wrapped so a single
    // Plaid 5xx (or a connection-level lock collision) can't jam the sweep.
    runBankFeedSweep().catch((error: unknown) => {
      console.error("[bank-feed-sync] sweep failed:", error);
      return { scanned: 0, synced: 0, skipped: 0, failed: 0, totalTransactions: 0, totalMatches: 0 };
    }),
    // founder-os#1256 Phase 1 — Pressing Items scanner. Refreshes the
    // role-lensed board-attention feed. Per-association failures are
    // logged inside `scanAssociation`; this outer catch handles a
    // catastrophic failure (e.g. DB outage) without jamming the sweep.
    runPressingItemsSweep().catch((error: unknown) => {
      console.error("[pressing-items] sweep failed:", error);
      return { associationsScanned: 0, totalInserted: 0, totalUpdated: 0, totalResolved: 0 };
    }),
    // usage-reporting (gap closed) — report current per-unit / per-door usage to
    // the Stripe Billing Meters, once per billing period per active metered
    // subscription. Idempotent (local ledger + deterministic Stripe identifier), so
    // it is safe to call every sweep tick: subscriptions already reported for the
    // current period are skipped. Returns null when Stripe is unconfigured. Wrapped
    // so a Stripe 5xx can't jam the rest of automation.
    runUsageReconcileSweep().catch((error: unknown) => {
      console.error("[usage-reporting] reconcile sweep failed:", error);
      return null;
    }),
  ]);

  log(
    `automation sweep complete :: notices processed=${scheduledResult.processed}, maintenance escalated=${escalationResult.escalated}/${escalationResult.processed}, board packages generated=${boardPackageResult.generated}/${boardPackageResult.processed}, assessment dispatched=${assessmentSweep.totalDispatched} success=${assessmentSweep.perStatus.success} failed=${assessmentSweep.perStatus.failed} skipped=${assessmentSweep.perStatus.skipped}, autopay succeeded=${autopayResult.succeeded} failed=${autopayResult.failed} skipped=${autopayResult.skipped}, retries retried=${retryResult.retried} succeeded=${retryResult.succeeded} failed=${retryResult.failed}, delinquency notices generated=${noticeResult.generated} skipped=${noticeResult.skipped}, critical-alerts scanned=${criticalAlertFanOut.scanned} sent=${criticalAlertFanOut.sentEmail + criticalAlertFanOut.sentPush} (email=${criticalAlertFanOut.sentEmail} push=${criticalAlertFanOut.sentPush}) rate-limited=${criticalAlertFanOut.rateLimited} dedup=${criticalAlertFanOut.alreadyDelivered} suppressed=${criticalAlertFanOut.suppressedPreExisting} failed=${criticalAlertFanOut.failed}, access-review-reminder fired=${accessReviewReminder.fired} (${accessReviewReminder.reason}), onboarding-reminders scanned=${onboardingReminderResult.scanned} sent=${onboardingReminderResult.sent} failed=${onboardingReminderResult.failed} skipped=${onboardingReminderResult.skipped}, bank-feed-sync scanned=${bankFeedSweepResult.scanned} synced=${bankFeedSweepResult.synced} skipped=${bankFeedSweepResult.skipped} failed=${bankFeedSweepResult.failed} txns=${bankFeedSweepResult.totalTransactions} matches=${bankFeedSweepResult.totalMatches}, pressing-items assoc=${pressingItemsResult.associationsScanned} inserted=${pressingItemsResult.totalInserted} updated=${pressingItemsResult.totalUpdated} resolved=${pressingItemsResult.totalResolved}, usage-reconcile ${usageReconcileResult ? `scanned=${usageReconcileResult.scanned} reported=${usageReconcileResult.reported} skipped=${usageReconcileResult.skipped} errors=${usageReconcileResult.errors}` : "skipped (stripe unconfigured)"}`,
    "automation",
  );

  // After the quarterly access-review reminder fires, also email the
  // platform-admin cohort so the reminder lands somewhere they'll see it.
  // Emitted out-of-band of the awaited Promise.all so a flaky email path
  // doesn't extend sweep latency. Errors are logged.
  if (accessReviewReminder.fired) {
    const inactiveCount = (accessReviewReminder as { inactiveAdmins?: number }).inactiveAdmins ?? 0;
    const totalCount = (accessReviewReminder as { totalAdmins?: number }).totalAdmins ?? 0;
    sendPlatformAdminEmailNotification({
      category: "adminAccess",
      priority: "digest",
      allowedRoles: ["platform-admin"],
      email: {
        subject: "Quarterly access review is due",
        html: `<p>Quarterly admin access review is due.</p>
          <p><strong>${totalCount}</strong> admin user${totalCount === 1 ? "" : "s"} in the system; <strong>${inactiveCount}</strong> flagged inactive (90+ days no login).</p>
          <p>Review and complete the cycle at <a href="/app/admin/access-review">/app/admin/access-review</a>.</p>`,
        text: `Quarterly admin access review is due.\n\n${totalCount} admin users; ${inactiveCount} inactive (90+ days).\n\nReview at /app/admin/access-review`,
      },
    }).catch((error: unknown) => {
      console.error("[access-review] reminder email failed:", error);
    });
  }
}

function startAutomationJobs() {
  const enabled = (process.env.AUTOMATION_SWEEPS_ENABLED || "1").trim() !== "0";
  if (!enabled) {
    log("automation sweeps disabled by env", "automation");
    return;
  }

  if (globalAutomationState.__automationJobState?.isRunning) {
    log("automation sweeps already running; skipping duplicate startup", "automation");
    return;
  }

  const intervalMs = Math.max(60_000, Number(process.env.AUTOMATION_SWEEPS_INTERVAL_MS || 300_000));
  const timer = setInterval(() => {
    // founder-os#10741 (SCALE-B-003 / A-REL-005): cross-machine advisory lock so
    // the money-adjacent automation sweep (autopay / delinquency / assessment)
    // fires on only ONE machine. No-op on the current single-machine topology.
    withSchedulerLock("automation-sweep", runAutomationSweep).catch((error) => {
      console.error("Automation sweep failed:", error);
    });
  }, intervalMs);

  globalAutomationState.__automationJobState = {
    isRunning: true,
    timer,
  };

  runAutomationSweep().catch((error) => {
    console.error("Automation sweep failed:", error);
  });
  log(`automation sweeps started (interval ${intervalMs}ms)`, "automation");
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Init Sentry first inside the async boot so errors during the rest of
  // boot are captured. Safe across hot-reload (idempotent init).
  await initServerObservability();

  // BLINDSPOT F7 — Plaid production env-flip guard. Refuse to boot in
  // PLAID_ENV=production unless webhook JWT verification is wired + the
  // production credentials are present. This makes the safe order
  // (verification BEFORE going live) mechanical, not a checklist a deploy can
  // skip. Sandbox/development always passes. Throwing here aborts boot — which
  // on Fly aborts the deploy, exactly as intended.
  const plaidGuard = assertPlaidEnvSafe();
  log(`Plaid env guard OK (env=${plaidGuard.env})`, "plaid");

  // Stripe Financial Connections (FC) env guard — same mechanical-safety rail
  // as Plaid's, scoped to the FC bank-feed alternative. No-op unless
  // STRIPE_FINANCIAL_CONNECTIONS_ENABLED is ON. When ON in production, it
  // refuses to boot without STRIPE_FC_WEBHOOK_SECRET wired (so a production
  // FC webhook handler can never accept forged bank transactions).
  const fcGuard = assertStripeFcEnvSafe();
  log(
    `Stripe FC env guard OK (enabled=${fcGuard.enabled} env=${fcGuard.env})`,
    "stripe-fc",
  );

  // ── Rate limiting (P1-4 / YCM#211) ───────────────────────────────────────
  //
  // Money-mutation + auth-adjacent routes use the MULTI-MACHINE-CORRECT
  // Postgres-backed limiter (createPgRateLimiter): one shared fixed-window
  // counter across all Fly machines via the existing `rate_limit_counters`
  // table. fly.toml provisions 2 machines (one auto-stopped), so a per-machine
  // in-memory counter would let a load-balanced attacker get up to 2x the
  // intended quota on exactly these surfaces. No Redis, no new infra service.
  // On a Postgres blip the limiter FAILS OPEN to a per-machine in-memory
  // limiter (abuse protection, not a security gate — a DB blip must never DoS
  // legitimate traffic). Full strategy + route inventory: docs/rate-limiting.md.
  //
  // Limits are generous — an 18-unit HOA never hits them in normal use (this is
  // abuse protection, not customer throttling). `onWriteOnly` leaves GET reads
  // (dashboards, reports) unthrottled on the money/admin prefixes.
  const rlQuery: RateLimitQuery = (text, params) => pool.query(text, params);
  const rlFallbackLog = (tier: string) => (err: unknown) =>
    log(
      `rate-limit ${tier}: Postgres unavailable, degrading to per-machine in-memory limiter :: ${
        err instanceof Error ? err.message : String(err)
      }`,
      "rate-limit",
    );

  // TIER 1 — AUTH VERIFY (OTP / token verification: the tightest brute-force
  // surface — an attacker guessing a 6-digit OTP or a ballot/verify token).
  const authVerifyLimiter = createPgRateLimiter({
    query: rlQuery,
    keyPrefix: "auth-verify",
    windowMs: 10 * 60_000,
    max: 10,
    message: "Too many verification attempts, please try again in a few minutes.",
    onFallback: rlFallbackLog("auth-verify"),
  });
  app.use("/api/portal/verify-login", authVerifyLimiter);
  app.use("/api/vendor-portal/verify-login", authVerifyLimiter);
  app.use("/api/platform/email/verify", authVerifyLimiter);
  app.use("/api/elections/ballot", authVerifyLimiter); // token-cast ballot surface

  // TIER 2 — AUTH REQUEST (login request / magic-link send: email-enumeration +
  // OTP-spam surface).
  const authRequestLimiter = createPgRateLimiter({
    query: rlQuery,
    keyPrefix: "auth-request",
    windowMs: 60_000,
    max: 10,
    message: "Too many login attempts, please try again later.",
    onFallback: rlFallbackLog("auth-request"),
  });
  app.use("/api/portal/request-login", authRequestLimiter);
  app.use("/api/vendor-portal/request-login", authRequestLimiter);

  // TIER 3 — MONEY / ADMIN WRITE (payments, ledger, reconcile, autopay, Plaid,
  // Stripe Connect, billing, admin writes). 60/min per IP is permissive for a
  // treasurer recording a batch of payments yet blocks an automated write flood.
  const moneyWriteLimiter = createPgRateLimiter({
    query: rlQuery,
    keyPrefix: "money-write",
    windowMs: 60_000,
    max: 60,
    message: "Too many financial requests, please slow down.",
    onFallback: rlFallbackLog("money-write"),
  });
  app.use("/api/financial", onWriteOnly(moneyWriteLimiter));
  app.use("/api/admin", onWriteOnly(moneyWriteLimiter));
  app.use("/api/portal/pay", onWriteOnly(moneyWriteLimiter));
  app.use("/api/portal/payment-methods", onWriteOnly(moneyWriteLimiter));
  app.use("/api/portal/autopay", onWriteOnly(moneyWriteLimiter));
  app.use("/api/plaid", onWriteOnly(moneyWriteLimiter));
  app.use("/api/portal/plaid", onWriteOnly(moneyWriteLimiter));

  // TIER 4 — INVITE / TOKEN GENERATION (send onboarding invites — email-send
  // abuse surface). Admin-authed but still worth a generous cap.
  const inviteLimiter = createPgRateLimiter({
    query: rlQuery,
    keyPrefix: "invite-gen",
    windowMs: 60_000,
    max: 20,
    message: "Too many invitations sent, please slow down.",
    onFallback: rlFallbackLog("invite-gen"),
  });
  app.use("/api/onboarding/invites", onWriteOnly(inviteLimiter));

  // General public surface — a coarse per-machine in-memory guard is acceptable
  // here (non-money, non-auth; the exact quota need not be shared across
  // machines). Kept in-memory deliberately.
  const publicRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
  app.use("/api/public", publicRateLimiter);

  await registerRoutes(httpServer, app);

  // Wave 16d — test-only Playwright helper routes. Registration is
  // gated at *call time*: registerTestRoutes() refuses to register
  // unless NODE_ENV=test AND PLAYWRIGHT_TEST_MODE=1. Each handler ALSO
  // re-checks the gate on every request as defense-in-depth. The import
  // is unconditional (so type-check / build see it) but the side-effect
  // is skipped in production.
  if (process.env.NODE_ENV === "test" && process.env.PLAYWRIGHT_TEST_MODE === "1") {
    const { registerTestRoutes } = await import("./test-routes");
    registerTestRoutes(app);
  }

  // Log DB state on startup for deployment verification
  pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM associations) AS associations,
      (SELECT COUNT(*)::int FROM units) AS units,
      (SELECT COUNT(*)::int FROM buildings) AS buildings
  `).then(({ rows }) => {
    const { associations, units, buildings } = rows[0];
    log(`db state :: associations=${associations} units=${units} buildings=${buildings} host=${process.env.PGHOST ?? "?"} db=${process.env.PGDATABASE ?? "?"}`, "startup");
  }).catch((err) => {
    log(`db state check failed: ${err.message}`, "startup");
  });

  // founder-os #2476 — boot-time migration health check. Defense-in-depth
  // backstop: if Fly's release_command somehow failed to run (or a machine
  // was restarted directly without going through the deploy pipeline), the
  // check flips /api/health to 503 + logs loudly so the situation is
  // visible. Does NOT crash the server — we want diagnostics reachable.
  void runMigrationHealthCheck(pool).catch((err) => {
    log(`migration health check uncaught error: ${err?.message ?? err}`, "startup");
  });

  // Wave 33 (5.4 Part B): seedDatabase ships ~120 KB of static demo data
  // and runs once at boot. Lazy-import keeps it out of the cold-start
  // bundle and out of dist/index.cjs's main chunk.
  //
  // founder-os#2472: the dynamic import specifier MUST include the file
  // extension. The production runtime is `node dist/index.cjs` (CJS), but
  // `package.json` declares `"type": "module"` and `await import()` invokes
  // Node's ESM resolver. ESM resolution requires explicit file extensions
  // for relative paths — a bare `./seed` throws ERR_MODULE_NOT_FOUND at
  // boot, the error was being logged but silently swallowed, and the app
  // continued serving empty tables. Cherry Hill data never landed in
  // production as a direct consequence.
  //
  // Site audit 2026-06-22: the seed sibling is built in `format: "cjs"`
  // (it uses `module.exports`/`require` internally). Under
  // `"type": "module"`, Node parses a `.js` file as ESM — so importing the
  // CJS-format `dist/seed.js` threw `ReferenceError: module is not defined
  // in ES module scope` on every prod boot ("[boot] Seed failed to run").
  // The build now emits the sibling as `dist/seed.cjs`, whose `.cjs`
  // extension forces Node's CJS loader regardless of "type": "module".
  //
  // Dev (tsx via `script/dev.ts`) does NOT resolve a `.cjs` specifier back
  // to `server/seed.ts` (verified), but it DOES resolve `.js`. So the
  // specifier branches on the runtime: `./seed.cjs` for the prod bundle,
  // `./seed.js` for the tsx dev runner. Both are in esbuild's `external`
  // list so neither is inlined into the main bundle.
  const seedModuleSpecifier =
    process.env.NODE_ENV === "production" ? "./seed.cjs" : "./seed.js";
  // founder-os#10741 (STARTUP-B-006): gate DB seeding off the production boot
  // path behind an env flag. Default preserves current seed-on-boot behavior;
  // set SEED_ON_BOOT=false to skip seeding at startup (e.g. once the DB is
  // provisioned, so a boot / crash-restart never re-runs the ~120 KB demo seed).
  if (process.env.SEED_ON_BOOT === "false") {
    log("[boot] seed :: skipped (SEED_ON_BOOT=false)", "startup");
    return;
  }
  void (async () => {
    try {
      log(`[boot] seed :: starting lazy import of ${seedModuleSpecifier}`, "startup");
      const { seedDatabase } = await import(/* @vite-ignore */ seedModuleSpecifier);
      await seedDatabase();
      log("[boot] seed :: completed", "startup");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      log(`[boot] seed FAILED to run: ${message}`, "startup");
      console.error("[boot] Seed failed to run:", err);
      if (stack) {
        console.error("[boot] Seed failure stack:", stack);
      }
    }
  })();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // Return JSON 404 for unmatched /api/* and /uploads/* paths so they
  // are never swallowed by the SPA HTML fallback below.
  app.all("/api/*path", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });
  app.all("/uploads/*path", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  // `reusePort` is a Linux-only socket option (SO_REUSEPORT). On Darwin
  // it returns ENOTSUP at bind time, which kills the dev server on
  // macOS. Mirroring the platform gate already in script/dev.ts.
  const listenOptions: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: "0.0.0.0",
  };
  if (process.platform === "linux") {
    listenOptions.reusePort = true;
  }
  httpServer.listen(listenOptions, () => {
    log(`serving on port ${port}`);
    startAutomationJobs();
    startElectionScheduler();
    startDeprovisioningScheduler();
    startVendorComplianceScheduler();
    // Wave 33 (5.4-F3): re-enqueue any background_jobs rows still in
    // queued/running state from a prior process. Best-effort; failures are
    // logged but never crash the server.
    recoverInFlightJobs().catch((err) => {
      console.error("[job-queue] recoverInFlightJobs failed:", err);
    });
  });
})();
