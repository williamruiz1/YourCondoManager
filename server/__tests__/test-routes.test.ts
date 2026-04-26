/**
 * Wave 16d — production-safety tests for `server/test-routes.ts`.
 *
 * Security audit matrix (the load-bearing evidence for the PR):
 *   1. NODE_ENV=production           → registration refused, 404.
 *   2. NODE_ENV=test, no flag        → registration refused, 404.
 *   3. NODE_ENV=test, flag=1         → registered + reachable; flipping
 *                                      the flag mid-life makes handlers
 *                                      404 (defense-in-depth runtime guard).
 *
 * Plus: admin-existence gate on /api/auth/test-login, exact-email match
 * + 60s TTL on /api/__test/last-otp, captureTestEmail no-op outside
 * test mode.
 */
import express from "express";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const adminUsers = new Map<string, { id: string; email: string; isActive: number }>();
const authUsersByEmail = new Map<string, { id: string; email: string; adminUserId: string | null; isActive: number }>();
const authUsersById = new Map<string, { id: string; email: string; adminUserId: string | null; isActive: number }>();
const passportLoginCalls: Array<{ userId: string }> = [];

vi.mock("../storage", () => ({
  storage: {
    getAdminUserByEmail: async (email: string) => adminUsers.get(email.toLowerCase()),
    getAuthUserByEmail: async (email: string) => authUsersByEmail.get(email.toLowerCase()),
    createAuthUser: async (data: { email: string; adminUserId: string | null }) => {
      const id = `auth-${data.email}`;
      const user = { id, email: data.email, adminUserId: data.adminUserId, isActive: 1 };
      authUsersByEmail.set(data.email.toLowerCase(), user);
      authUsersById.set(id, user);
      return user;
    },
    updateAuthUser: async (id: string, patch: Partial<{ adminUserId: string | null; isActive: number }>) => {
      const u = authUsersById.get(id);
      if (!u) return undefined;
      Object.assign(u, patch);
      return u;
    },
    touchAuthUserLogin: async () => undefined,
  },
}));
vi.mock("../logger", () => ({ log: () => undefined }));

import {
  registerTestRoutes,
  isTestModeEnabled,
  captureTestEmail,
  __resetTestCaptureForTests,
} from "../test-routes";

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.login = (user: { id: string }, cb: (err?: unknown) => void) => {
      passportLoginCalls.push({ userId: user.id });
      cb();
    };
    next();
  });
  return app;
}

async function withApp<T>(fn: (url: string) => Promise<T>): Promise<T> {
  const app = makeApp();
  registerTestRoutes(app);
  const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve, reject) => {
    const s = app.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      resolve({ port, close: () => new Promise((r) => s.close(() => r(undefined))) });
    });
    s.on("error", reject);
  });
  try {
    return await fn(`http://127.0.0.1:${server.port}`);
  } finally {
    await server.close();
  }
}

const post = (url: string, path: string, body: unknown) =>
  fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const get = (url: string, path: string) => fetch(`${url}${path}`);

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_TEST_MODE = process.env.PLAYWRIGHT_TEST_MODE;

beforeEach(() => {
  adminUsers.clear();
  authUsersByEmail.clear();
  authUsersById.clear();
  passportLoginCalls.length = 0;
  __resetTestCaptureForTests();
});

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_TEST_MODE === undefined) delete process.env.PLAYWRIGHT_TEST_MODE;
  else process.env.PLAYWRIGHT_TEST_MODE = ORIGINAL_TEST_MODE;
});

describe("isTestModeEnabled — gate definition", () => {
  it("requires both env vars set to NODE_ENV=test AND PLAYWRIGHT_TEST_MODE=1", () => {
    process.env.NODE_ENV = "production";
    process.env.PLAYWRIGHT_TEST_MODE = "1";
    expect(isTestModeEnabled()).toBe(false);

    process.env.NODE_ENV = "test";
    delete process.env.PLAYWRIGHT_TEST_MODE;
    expect(isTestModeEnabled()).toBe(false);

    for (const v of ["", "0", "false", "no"]) {
      process.env.PLAYWRIGHT_TEST_MODE = v;
      expect(isTestModeEnabled()).toBe(false);
    }

    process.env.PLAYWRIGHT_TEST_MODE = "1";
    expect(isTestModeEnabled()).toBe(true);
  });
});

describe("registerTestRoutes — security audit matrix", () => {
  it("refuses to register in NODE_ENV=production (row 1)", async () => {
    process.env.NODE_ENV = "production";
    process.env.PLAYWRIGHT_TEST_MODE = "1";
    expect(registerTestRoutes(makeApp())).toBe(false);
    await withApp(async (url) => {
      const res = await post(url, "/api/auth/test-login", { email: "anybody@test.example" });
      expect(res.status).toBe(404);
    });
  });

  it("refuses to register in NODE_ENV=test without flag (row 2)", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PLAYWRIGHT_TEST_MODE;
    expect(registerTestRoutes(makeApp())).toBe(false);
    await withApp(async (url) => {
      expect((await get(url, "/api/__test/last-otp?email=x@test.example")).status).toBe(404);
    });
  });

  it("registers and serves both routes when both env vars are set (row 3)", async () => {
    process.env.NODE_ENV = "test";
    process.env.PLAYWRIGHT_TEST_MODE = "1";
    adminUsers.set("manager@test.example", { id: "admin-1", email: "manager@test.example", isActive: 1 });

    await withApp(async (url) => {
      const res = await post(url, "/api/auth/test-login", { email: "manager@test.example" });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        ok: true,
        authenticated: true,
        adminUserId: "admin-1",
        email: "manager@test.example",
      });
      expect(passportLoginCalls).toHaveLength(1);
    });
  });

  it("404s when env var flips off mid-life (defense-in-depth runtime guard)", async () => {
    process.env.NODE_ENV = "test";
    process.env.PLAYWRIGHT_TEST_MODE = "1";
    adminUsers.set("manager@test.example", { id: "admin-1", email: "manager@test.example", isActive: 1 });

    await withApp(async (url) => {
      const before = await post(url, "/api/auth/test-login", { email: "manager@test.example" });
      expect(before.status).toBe(200);
      delete process.env.PLAYWRIGHT_TEST_MODE;
      const after = await post(url, "/api/auth/test-login", { email: "manager@test.example" });
      expect(after.status).toBe(404);
    });
  });
});

describe("/api/auth/test-login — admin-existence gate", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.PLAYWRIGHT_TEST_MODE = "1";
  });

  it("404s when email is not in admin_users (cannot mint sessions for arbitrary emails)", async () => {
    await withApp(async (url) => {
      const res = await post(url, "/api/auth/test-login", { email: "outsider@evil.example" });
      expect(res.status).toBe(404);
      expect(passportLoginCalls).toHaveLength(0);
    });
  });

  it("404s when admin row exists but is inactive", async () => {
    adminUsers.set("inactive@test.example", { id: "admin-2", email: "inactive@test.example", isActive: 0 });
    await withApp(async (url) => {
      const res = await post(url, "/api/auth/test-login", { email: "inactive@test.example" });
      expect(res.status).toBe(404);
    });
  });

  it("400s on missing email", async () => {
    await withApp(async (url) => {
      const res = await post(url, "/api/auth/test-login", {});
      expect(res.status).toBe(400);
    });
  });
});

describe("/api/__test/last-otp + captureTestEmail", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.PLAYWRIGHT_TEST_MODE = "1";
  });

  it("returns the latest OTP for an exact email match (no cross-match)", async () => {
    captureTestEmail({ to: "alice@test.example", subject: "code", text: "code: 111111", html: "" });
    captureTestEmail({ to: "alice@test.example", subject: "code", text: "code: 222222", html: "" });
    captureTestEmail({ to: "bob@test.example", subject: "code", text: "code: 333333", html: "" });

    await withApp(async (url) => {
      expect((await (await get(url, "/api/__test/last-otp?email=alice@test.example")).json()).otp).toBe("222222");
      expect((await (await get(url, "/api/__test/last-otp?email=bob@test.example")).json()).otp).toBe("333333");
      expect((await get(url, "/api/__test/last-otp?email=eve@test.example")).status).toBe(404);
    });
  });

  it("does NOT return OTPs older than 60 seconds", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      captureTestEmail({ to: "stale@test.example", subject: "code", text: "code: 999999", html: "" });
      vi.setSystemTime(new Date("2026-01-01T00:01:01Z")); // +61s

      await withApp(async (url) => {
        expect((await get(url, "/api/__test/last-otp?email=stale@test.example")).status).toBe(404);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("captureTestEmail is a no-op outside test mode (production cannot leak)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.PLAYWRIGHT_TEST_MODE;
    captureTestEmail({ to: "leak@evil.example", subject: "code", text: "code: 777777", html: "" });

    process.env.NODE_ENV = "test";
    process.env.PLAYWRIGHT_TEST_MODE = "1";
    await withApp(async (url) => {
      expect((await get(url, "/api/__test/last-otp?email=leak@evil.example")).status).toBe(404);
    });
  });
});
