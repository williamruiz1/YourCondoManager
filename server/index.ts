import dotenv from "dotenv";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { initializeAuth } from "./auth";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { storage } from "./storage";
import { pool } from "./db";

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

const sessionSecret = process.env.SESSION_SECRET?.trim() || "dev-session-secret";
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
  name: "sid",
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

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function runAutomationSweep() {
  const [scheduledResult, escalationResult, boardPackageResult] = await Promise.all([
    storage.runScheduledNotices({ actedBy: "automation@system" }),
    storage.runMaintenanceEscalationSweep({ actorEmail: "automation@system" }),
    storage.runScheduledBoardPackageGeneration({ actorEmail: "automation@system" }),
  ]);
  log(
    `automation sweep complete :: notices processed=${scheduledResult.processed}, maintenance escalated=${escalationResult.escalated}/${escalationResult.processed}, board packages generated=${boardPackageResult.generated}/${boardPackageResult.processed}`,
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
    },
  );
})();
