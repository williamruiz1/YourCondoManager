import assert from "node:assert/strict";
import fs from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "../server/db";

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function assertContains(content: string, needle: string, message: string) {
  assert.ok(content.includes(needle), message);
}

async function verifyCodeAndConfig() {
  const authFile = read("server/auth.ts");
  const routesFile = read("server/routes.ts");
  const indexFile = read("server/index.ts");
  const appFile = read("client/src/App.tsx");
  const schemaFile = read("shared/schema.ts");
  const storageFile = read("server/storage.ts");
  const envExample = read(".env.example");
  const packageJson = JSON.parse(read("package.json")) as {
    dependencies?: Record<string, string>;
  };

  assertContains(authFile, 'app.get("/auth/google"', "missing /auth/google route");
  assertContains(authFile, 'app.get("/api/auth/google"', "missing /api/auth/google route");
  assertContains(authFile, 'app.get("/auth/google/callback"', "missing /auth/google/callback route");
  assertContains(authFile, 'app.get("/api/auth/google/callback"', "missing /api/auth/google/callback route");
  assertContains(authFile, 'app.get("/api/callback/google"', "missing /api/callback/google compatibility route");
  assertContains(authFile, 'app.get("/api/auth/me"', "missing /api/auth/me route");
  assertContains(authFile, 'app.post("/api/auth/session/restore"', "missing /api/auth/session/restore route");
  assertContains(authFile, 'app.post("/auth/logout"', "missing /auth/logout route");
  assertContains(authFile, 'app.post("/api/auth/logout"', "missing /api/auth/logout route");
  assertContains(authFile, "createAuthRestoreToken", "missing auth restore token generation");
  assertContains(authFile, "verifyAuthRestoreToken", "missing auth restore token verification");

  assertContains(routesFile, "registerAuthRoutes(app);", "auth routes not registered");
  assertContains(routesFile, "tryHydrateAdminFromSession", "missing session-hydration fallback in admin auth");
  assertContains(routesFile, "applyAdminContext", "missing shared admin context mapper");

  assertContains(indexFile, "connectPgSimple", "missing connect-pg-simple usage");
  assertContains(indexFile, 'tableName: "user_sessions"', "missing durable session table config");
  assertContains(authFile, "passport.session()", "missing passport session middleware");

  assertContains(appFile, "/api/auth/google?popup=1", "missing frontend popup launcher flow");
  assertContains(appFile, "google-oauth-success", "missing callback postMessage success handling");
  assertContains(appFile, "/api/auth/session/restore", "missing frontend session restore call");
  assertContains(appFile, "/api/auth/logout", "missing frontend logout call");

  assertContains(schemaFile, 'pgEnum("oauth_provider", ["google"])', "missing oauth provider enum");
  assertContains(schemaFile, 'pgTable("auth_users"', "missing auth_users table");
  assertContains(schemaFile, 'pgTable("auth_external_accounts"', "missing auth_external_accounts table");

  assertContains(storageFile, "getAuthUserByEmail", "missing auth user lookup method");
  assertContains(storageFile, "upsertAuthExternalAccount", "missing external account upsert");
  assertContains(storageFile, "touchAuthUserLogin", "missing auth login touch helper");
  assertContains(storageFile, "getAdminUserById", "missing admin user by id helper");

  assertContains(envExample, "GOOGLE_CLIENT_ID=", "missing GOOGLE_CLIENT_ID in .env.example");
  assertContains(envExample, "GOOGLE_CLIENT_SECRET=", "missing GOOGLE_CLIENT_SECRET in .env.example");
  assertContains(envExample, "GOOGLE_CALLBACK_URL=", "missing GOOGLE_CALLBACK_URL in .env.example");
  assertContains(envExample, "GOOGLE_CALLBACK_URL_STRICT=", "missing GOOGLE_CALLBACK_URL_STRICT in .env.example");
  assertContains(envExample, "GOOGLE_CALLBACK_PATH=", "missing GOOGLE_CALLBACK_PATH in .env.example");
  assertContains(envExample, "SESSION_SECRET=", "missing SESSION_SECRET in .env.example");

  assert.equal(
    packageJson.dependencies?.["passport-google-oauth20"] !== undefined,
    true,
    "passport-google-oauth20 dependency is missing",
  );
}

async function verifyDatabaseArtifacts() {
  const relationRows = await db.execute(sql`
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename in ('auth_users', 'auth_external_accounts', 'user_sessions')
    order by tablename
  `);

  const tableNames = new Set(
    relationRows.rows
      .map((row) => (row as Record<string, unknown>).tablename)
      .filter((value): value is string => typeof value === "string"),
  );

  assert.equal(tableNames.has("auth_users"), true, "auth_users table missing in database");
  assert.equal(tableNames.has("auth_external_accounts"), true, "auth_external_accounts table missing in database");
  if (!tableNames.has("user_sessions")) {
    console.warn("Note: user_sessions table not found yet. It is created at runtime by connect-pg-simple after app startup.");
  }
}

async function run() {
  await verifyCodeAndConfig();
  await verifyDatabaseArtifacts();
  console.log("Google OAuth production-readiness verification checks passed.");
}

run().catch((error: any) => {
  console.error(`Google OAuth readiness verification failed: ${error.message}`);
  process.exit(1);
});
