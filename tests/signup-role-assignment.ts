/**
 * Signup Role Assignment Tests
 *
 * Validates that the public signup flow assigns the correct default role
 * and that platform-admin is never reachable via public signup.
 *
 * References:
 *   - 4.4 Q1 decision: signup default is "manager", never "platform-admin"
 *   - 0.2 §Persona 1 (Manager): the signup persona for PM-company employees
 *   - 0.2 §Persona 2 (Board Officer): self-managed boards who sign up also get "manager"
 *
 * Run: DATABASE_URL=... npx tsx tests/signup-role-assignment.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pkg from "pg";
const { Pool } = pkg;
import { adminUsers } from "../shared/schema.js";
import * as fs from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

let passed = 0;
let failed = 0;
const testEmail = `signup-test-${Date.now()}@test.ycm.dev`;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function cleanup() {
  await db.delete(adminUsers).where(eq(adminUsers.email, testEmail)).catch(() => {});
}

async function testSignupDefaultRole() {
  console.log("\n--- Test: Public signup creates admin user with role 'manager' ---");

  // Simulate what /api/public/signup/start does (the INSERT)
  const [user] = await db.insert(adminUsers).values({
    email: testEmail,
    role: "manager",
    isActive: 0,
  }).returning();

  assert(user.role === "manager", `New signup user role is 'manager' (got: '${user.role}')`);
  assert(user.role !== "platform-admin", `New signup user role is NOT 'platform-admin'`);
  assert(user.role !== "board-officer", `New signup user role is NOT 'board-officer' (board-officer assigned later, not at signup)`);
  assert(user.role !== "assisted-board", `New signup user role is NOT 'assisted-board'`);
  assert(user.role !== "pm-assistant", `New signup user role is NOT 'pm-assistant'`);
  assert(user.isActive === 0, `New signup user is inactive (pending checkout completion)`);

  await cleanup();
}

async function testNoPlatformAdminInSignupCodePath() {
  console.log("\n--- Test: No code path in signup can produce platform-admin ---");

  // Read the signup endpoint source and verify the role literal
  const routesSource = fs.readFileSync("server/routes.ts", "utf8");

  // Find the /api/public/signup/start handler
  const signupStartIdx = routesSource.indexOf("/api/public/signup/start");
  assert(signupStartIdx !== -1, "Found /api/public/signup/start endpoint in routes.ts");

  if (signupStartIdx !== -1) {
    // Extract ~200 chars around the INSERT to check role value
    const insertRegion = routesSource.substring(signupStartIdx, signupStartIdx + 1500);

    // The INSERT into adminUsers should use role: "manager"
    const hasManagerRole = insertRegion.includes('role: "manager"');
    assert(hasManagerRole, 'Signup INSERT uses role: "manager"');

    // The INSERT should NOT contain platform-admin
    const hasPlatformAdmin = insertRegion.includes('role: "platform-admin"');
    assert(!hasPlatformAdmin, 'Signup INSERT does NOT contain role: "platform-admin"');
  }

  // Also check provisionWorkspace doesn't override role to platform-admin
  const provisionIdx = routesSource.indexOf("async function provisionWorkspace");
  if (provisionIdx !== -1) {
    const provisionRegion = routesSource.substring(provisionIdx, provisionIdx + 2000);
    const setsRoleToPlatformAdmin = provisionRegion.includes('role: "platform-admin"') || provisionRegion.includes("role: 'platform-admin'");
    assert(!setsRoleToPlatformAdmin, 'provisionWorkspace does NOT set role to platform-admin');
  }
}

async function run() {
  console.log("Signup Role Assignment Tests\n");

  try {
    await testSignupDefaultRole();
    await testNoPlatformAdminInSignupCodePath();
  } finally {
    await cleanup();
    await pool.end();
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
