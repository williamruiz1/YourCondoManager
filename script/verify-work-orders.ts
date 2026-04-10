import { db } from "../server/db";
import { workOrders, associations } from "../shared/schema";

type CheckResult = {
  label: string;
  passed: boolean;
  detail?: string;
};

function pass(label: string, detail?: string): CheckResult {
  return { label, passed: true, detail };
}

function fail(label: string, detail: string): CheckResult {
  return { label, passed: false, detail };
}

const VALID_STATUSES = ["open", "assigned", "in-progress", "pending-review", "closed", "cancelled"] as const;
type WorkOrderStatus = typeof VALID_STATUSES[number];

const ASSIGNED_OR_LATER: WorkOrderStatus[] = ["assigned", "in-progress", "pending-review", "closed", "cancelled"];

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Load all work orders and associations
  const allWorkOrders = await db.select().from(workOrders);
  const allAssociations = await db.select().from(associations);
  const associationIds = new Set(allAssociations.map((a) => a.id));

  // a. At least 1 work order exists
  if (allWorkOrders.length >= 1) {
    results.push(pass(
      "At least 1 work order exists",
      `Found ${allWorkOrders.length} work order(s)`,
    ));
  } else {
    results.push(fail(
      "At least 1 work order exists",
      "Expected ≥1 work order, found 0",
    ));
  }

  // b. At least 2 distinct statuses represented
  const distinctStatuses = new Set(allWorkOrders.map((w) => w.status));
  if (distinctStatuses.size >= 2) {
    results.push(pass(
      "At least 2 distinct statuses represented",
      `Found ${distinctStatuses.size} distinct status(es): ${[...distinctStatuses].join(", ")}`,
    ));
  } else {
    results.push(fail(
      "At least 2 distinct statuses represented",
      `Expected ≥2 distinct statuses, found ${distinctStatuses.size}: ${[...distinctStatuses].join(", ")}`,
    ));
  }

  // c. All work orders reference a valid association ID
  const invalidAssociation = allWorkOrders.filter(
    (w) => !associationIds.has(w.associationId),
  );
  if (invalidAssociation.length === 0) {
    results.push(pass(
      "All work orders reference a valid association ID",
      `All ${allWorkOrders.length} work order(s) have valid association references`,
    ));
  } else {
    results.push(fail(
      "All work orders reference a valid association ID",
      `${invalidAssociation.length} work order(s) reference unknown association IDs`,
    ));
  }

  // d. All work orders have a non-empty title
  const blankTitles = allWorkOrders.filter(
    (w) => typeof w.title !== "string" || w.title.trim().length === 0,
  );
  if (blankTitles.length === 0) {
    results.push(pass(
      "All work orders have a non-empty title",
      `All ${allWorkOrders.length} work order(s) have non-empty titles`,
    ));
  } else {
    results.push(fail(
      "All work orders have a non-empty title",
      `${blankTitles.length} work order(s) have blank or missing titles`,
    ));
  }

  // e. Closed work orders have a completedAt timestamp
  const closedOrders = allWorkOrders.filter((w) => w.status === "closed");
  const closedMissingCompletedAt = closedOrders.filter((w) => !w.completedAt);
  if (closedOrders.length === 0) {
    results.push(pass(
      "Closed work orders have a completedAt timestamp",
      "No closed work orders to check (check skipped)",
    ));
  } else if (closedMissingCompletedAt.length === 0) {
    results.push(pass(
      "Closed work orders have a completedAt timestamp",
      `All ${closedOrders.length} closed work order(s) have a completedAt timestamp`,
    ));
  } else {
    results.push(fail(
      "Closed work orders have a completedAt timestamp",
      `${closedMissingCompletedAt.length} closed work order(s) are missing a completedAt timestamp`,
    ));
  }

  // f. Work orders with assignedTo set also have status of assigned or later (not open)
  const assignedWithOpenStatus = allWorkOrders.filter(
    (w) =>
      typeof w.assignedTo === "string" &&
      w.assignedTo.trim().length > 0 &&
      !ASSIGNED_OR_LATER.includes(w.status as WorkOrderStatus),
  );
  if (assignedWithOpenStatus.length === 0) {
    results.push(pass(
      "Assigned work orders have status of assigned or later",
      "All work orders with assignedTo set have an appropriate status",
    ));
  } else {
    results.push(fail(
      "Assigned work orders have status of assigned or later",
      `${assignedWithOpenStatus.length} work order(s) have assignedTo set but status is still "open"`,
    ));
  }

  // g. All priority values are valid enum members
  const invalidPriorities = allWorkOrders.filter(
    (w) => !(VALID_PRIORITIES as readonly string[]).includes(w.priority),
  );
  if (invalidPriorities.length === 0) {
    results.push(pass(
      "All priority values are valid enum members",
      `All ${allWorkOrders.length} work order(s) have valid priority values`,
    ));
  } else {
    results.push(fail(
      "All priority values are valid enum members",
      `${invalidPriorities.length} work order(s) have invalid priority values: ${invalidPriorities.map((w) => `"${w.priority}"`).join(", ")}`,
    ));
  }

  return results;
}

async function main() {
  let checkResults: CheckResult[];

  try {
    checkResults = await runChecks();
  } catch (error: any) {
    console.error("Work orders verification could not connect to database:", error.message);
    process.exit(1);
  }

  const passed = checkResults.filter((r) => r.passed);
  const failed = checkResults.filter((r) => !r.passed);

  console.log("\nWork Orders End-to-End Verification");
  console.log("====================================");

  for (const result of checkResults) {
    const icon = result.passed ? "[PASS]" : "[FAIL]";
    const detail = result.detail ? ` — ${result.detail}` : "";
    console.log(`  ${icon} ${result.label}${detail}`);
  }

  console.log("\n------------------------------------");
  console.log(`  ${passed.length} passed, ${failed.length} failed`);

  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const result of failed) {
      console.log(`  - ${result.label}: ${result.detail}`);
    }
    process.exit(1);
  } else {
    console.log("\nAll work order integrity checks passed.");
    process.exit(0);
  }
}

main();
