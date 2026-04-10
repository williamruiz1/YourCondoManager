import dotenv from "dotenv";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { initializeAuth } from "./auth";
import { runAutomaticSpecialAssessmentInstallments } from "./assessment-installments";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { storage } from "./storage";
import { pool, db } from "./db";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { recurringChargeSchedules, recurringChargeRuns, ownerships, units, ownerLedgerEntries } from "@shared/schema";
import { log } from "./logger";
import { startElectionScheduler } from "./election-scheduler";

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

async function runDueRecurringCharges(): Promise<{ succeeded: number; failed: number; skipped: number }> {
  const now = new Date();
  // Push date filter to DB instead of loading all active schedules
  const dueNow = await db.select().from(recurringChargeSchedules).where(
    and(
      eq(recurringChargeSchedules.status, "active"),
      or(isNull(recurringChargeSchedules.nextRunDate), lte(recurringChargeSchedules.nextRunDate, now))
    )
  );

  let succeeded = 0, failed = 0, skipped = 0;

  // Batch-fetch all units for association-wide schedules (avoids N+1)
  const assocIds = [...new Set(dueNow.filter((s) => !s.unitId).map((s) => s.associationId))];
  const assocUnitsMap = new Map<string, string[]>();
  if (assocIds.length > 0) {
    const allUnits = await db.select({ id: units.id, associationId: units.associationId })
      .from(units).where(inArray(units.associationId, assocIds));
    for (const u of allUnits) {
      const arr = assocUnitsMap.get(u.associationId) ?? [];
      arr.push(u.id);
      assocUnitsMap.set(u.associationId, arr);
    }
  }

  for (const schedule of dueNow) {
    const targetUnitIds = schedule.unitId
      ? [schedule.unitId]
      : (assocUnitsMap.get(schedule.associationId) ?? []);

    // Batch-fetch ownerships for all target units (avoids N+1)
    const ownershipMap = new Map<string, typeof ownerships.$inferSelect>();
    if (targetUnitIds.length > 0) {
      const activeOwnerships = await db.select().from(ownerships)
        .where(and(inArray(ownerships.unitId, targetUnitIds), isNull(ownerships.endDate)));
      for (const o of activeOwnerships) {
        if (!ownershipMap.has(o.unitId)) ownershipMap.set(o.unitId, o);
      }
    }

    for (const unitId of targetUnitIds) {
      const ownership = ownershipMap.get(unitId);

      if (!ownership) {
        await db.insert(recurringChargeRuns).values({
          scheduleId: schedule.id,
          associationId: schedule.associationId,
          unitId,
          status: "skipped",
          errorMessage: "No active ownership found",
          amount: schedule.amount,
          ranAt: now,
        });
        skipped++;
        continue;
      }

      const [run] = await db.insert(recurringChargeRuns).values({
        scheduleId: schedule.id,
        associationId: schedule.associationId,
        unitId,
        status: "pending",
        amount: schedule.amount,
        ranAt: now,
      }).returning();

      try {
        const [entry] = await db.insert(ownerLedgerEntries).values({
          associationId: schedule.associationId,
          unitId,
          personId: ownership.personId,
          entryType: schedule.entryType,
          amount: schedule.amount,
          description: schedule.chargeDescription,
          referenceType: "recurring_charge_schedule",
          referenceId: schedule.id,
          postedAt: now,
        }).returning();
        await db.update(recurringChargeRuns).set({ status: "success", ledgerEntryId: entry.id, ranAt: now }).where(eq(recurringChargeRuns.id, run.id));
        succeeded++;
      } catch (err: any) {
        await db.update(recurringChargeRuns).set({ status: "failed", errorMessage: err.message }).where(eq(recurringChargeRuns.id, run.id));
        failed++;
      }
    }

    // Advance nextRunDate
    const next = new Date(now);
    if (schedule.frequency === "monthly") next.setMonth(next.getMonth() + 1);
    else if (schedule.frequency === "quarterly") next.setMonth(next.getMonth() + 3);
    else if (schedule.frequency === "annual") next.setFullYear(next.getFullYear() + 1);
    next.setDate(Math.min(schedule.dayOfMonth ?? 1, 28));
    await db.update(recurringChargeSchedules).set({ nextRunDate: next, updatedAt: now }).where(eq(recurringChargeSchedules.id, schedule.id));
  }

  return { succeeded, failed, skipped };
}

async function runAutomationSweep() {
  const [scheduledResult, escalationResult, boardPackageResult, recurringResult, assessmentResult] = await Promise.all([
    storage.runScheduledNotices({ actedBy: "automation@system" }),
    storage.runMaintenanceEscalationSweep({ actorEmail: "automation@system" }),
    storage.runScheduledBoardPackageGeneration({ actorEmail: "automation@system" }),
    runDueRecurringCharges(),
    runAutomaticSpecialAssessmentInstallments(),
  ]);
  log(
    `automation sweep complete :: notices processed=${scheduledResult.processed}, maintenance escalated=${escalationResult.escalated}/${escalationResult.processed}, board packages generated=${boardPackageResult.generated}/${boardPackageResult.processed}, recurring charges succeeded=${recurringResult.succeeded} failed=${recurringResult.failed} skipped=${recurringResult.skipped}, assessment installments associations=${assessmentResult.associationsProcessed} posted=${assessmentResult.entriesCreated} alreadyPosted=${assessmentResult.alreadyPosted} skipped=${assessmentResult.skippedUnits}`,
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
  await registerRoutes(httpServer, app);

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

  seedDatabase().catch((err) => {
    console.error("Seed failed:", err);
  });

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
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startAutomationJobs();
      startElectionScheduler();
    },
  );
})();
