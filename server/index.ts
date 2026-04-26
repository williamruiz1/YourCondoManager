import dotenv from "dotenv";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { initializeAuth } from "./auth";
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
import { recoverInFlightJobs } from "./job-queue";
import { log } from "./logger";
import { startElectionScheduler } from "./election-scheduler";
import { createRateLimiter } from "./rate-limit";

// Wave 33 (5.4 Part B): seed.ts is ~120 KB of static demo-data tables. It
// only runs once at boot, after the HTTP server has already started
// listening, so eager-bundling it bloats `dist/index.cjs` for no
// cold-start benefit. Lazy-load below in the boot block.
//
// The original eager import was: `import { seedDatabase } from "./seed"`

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

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
  },
}));
initializeAuth(app);

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
  const [scheduledResult, escalationResult, boardPackageResult, assessmentSweep, autopayResult, retryResult, noticeResult, criticalAlertFanOut] = await Promise.all([
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
  ]);

  log(
    `automation sweep complete :: notices processed=${scheduledResult.processed}, maintenance escalated=${escalationResult.escalated}/${escalationResult.processed}, board packages generated=${boardPackageResult.generated}/${boardPackageResult.processed}, assessment dispatched=${assessmentSweep.totalDispatched} success=${assessmentSweep.perStatus.success} failed=${assessmentSweep.perStatus.failed} skipped=${assessmentSweep.perStatus.skipped}, autopay succeeded=${autopayResult.succeeded} failed=${autopayResult.failed} skipped=${autopayResult.skipped}, retries retried=${retryResult.retried} succeeded=${retryResult.succeeded} failed=${retryResult.failed}, delinquency notices generated=${noticeResult.generated} skipped=${noticeResult.skipped}, critical-alerts scanned=${criticalAlertFanOut.scanned} sent=${criticalAlertFanOut.sentEmail + criticalAlertFanOut.sentPush} (email=${criticalAlertFanOut.sentEmail} push=${criticalAlertFanOut.sentPush}) rate-limited=${criticalAlertFanOut.rateLimited} dedup=${criticalAlertFanOut.alreadyDelivered} suppressed=${criticalAlertFanOut.suppressedPreExisting} failed=${criticalAlertFanOut.failed}`,
    "automation",
  );
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
    runAutomationSweep().catch((error) => {
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
  const publicRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
  app.use("/api/public", publicRateLimiter);

  // Portal login is the real brute-force surface. Apply a conservative
  // limit to request-login (email enumeration / OTP spam) and a tighter
  // limit to verify-login (OTP code brute-force).
  const portalRequestLoginLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 10,
    message: "Too many login attempts, please try again later.",
  });
  app.use("/api/portal/request-login", portalRequestLoginLimiter);

  const portalVerifyLoginLimiter = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 5,
    message: "Too many verification attempts, please try again later.",
  });
  app.use("/api/portal/verify-login", portalVerifyLoginLimiter);

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

  // Wave 33 (5.4 Part B): seedDatabase ships ~120 KB of static demo data
  // and runs once at boot. Lazy-import keeps it out of the cold-start
  // bundle and out of dist/index.cjs's main chunk.
  void (async () => {
    try {
      const { seedDatabase } = await import("./seed");
      await seedDatabase();
    } catch (err) {
      console.error("Seed failed:", err);
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
    // Wave 33 (5.4-F3): re-enqueue any background_jobs rows still in
    // queued/running state from a prior process. Best-effort; failures are
    // logged but never crash the server.
    recoverInFlightJobs().catch((err) => {
      console.error("[job-queue] recoverInFlightJobs failed:", err);
    });
  });
})();
