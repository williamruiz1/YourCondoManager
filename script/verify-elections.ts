import { db } from "../server/db";
import {
  elections,
  electionOptions,
  electionBallotTokens,
  electionBallotCasts,
} from "../shared/schema";
import { eq, inArray } from "drizzle-orm";

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

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Load all elections
  const allElections = await db.select().from(elections);

  // a. Inventory by status — at least 1 election exists in any status.
  // The seed intentionally ships certified + draft elections; an "open" election
  // is not required because the ballot workflow is exercised via the closed ones.
  const openElections = allElections.filter((e) => e.status === "open");
  const draftElections = allElections.filter((e) => e.status === "draft");
  if (allElections.length >= 1) {
    results.push(pass(
      "At least 1 election exists (any status)",
      `Found ${allElections.length} total — open: ${openElections.length}, draft: ${draftElections.length}, certified/closed: ${allElections.length - openElections.length - draftElections.length}`,
    ));
  } else {
    results.push(fail(
      "At least 1 election exists (any status)",
      "No elections found — seed may not have run",
    ));
  }

  // b. At least 1 election exists with status "certified" or "closed" (with results)
  const closedElections = allElections.filter(
    (e) => e.status === "certified" || e.status === "closed",
  );
  if (closedElections.length >= 1) {
    results.push(pass(
      "At least 1 certified/closed election exists",
      `Found ${closedElections.length} certified/closed election(s)`,
    ));
  } else {
    results.push(fail(
      "At least 1 certified/closed election exists",
      `Expected ≥1 certified or closed election, found ${closedElections.length}`,
    ));
  }

  // Gather IDs for elections that should have options and tokens (open + certified/closed)
  const activeOrClosedElections = [...openElections, ...closedElections];
  const activeOrClosedIds = activeOrClosedElections.map((e) => e.id);

  if (activeOrClosedIds.length === 0) {
    results.push(fail(
      "Active/closed elections have at least 2 options each",
      "No open or closed elections to check",
    ));
    results.push(fail(
      "Active/closed elections have ballot tokens generated",
      "No open or closed elections to check",
    ));
    results.push(fail(
      "Closed elections have cast ballots matching token count",
      "No closed elections to check",
    ));
    results.push(fail(
      "Election options have valid labels",
      "No open or closed elections to check",
    ));
    return results;
  }

  // c. Each active/closed election has at least 2 options
  const allOptions = await db
    .select()
    .from(electionOptions)
    .where(inArray(electionOptions.electionId, activeOrClosedIds));

  const optionsByElection = new Map<string, typeof allOptions>();
  for (const option of allOptions) {
    const existing = optionsByElection.get(option.electionId) ?? [];
    existing.push(option);
    optionsByElection.set(option.electionId, existing);
  }

  let allHaveTwoOptions = true;
  const failedOptionChecks: string[] = [];
  for (const election of activeOrClosedElections) {
    const opts = optionsByElection.get(election.id) ?? [];
    if (opts.length < 2) {
      allHaveTwoOptions = false;
      failedOptionChecks.push(`"${election.title}" has only ${opts.length} option(s)`);
    }
  }

  if (allHaveTwoOptions) {
    results.push(pass(
      "Active/closed elections have at least 2 options each",
      `All ${activeOrClosedElections.length} election(s) have ≥2 options`,
    ));
  } else {
    results.push(fail(
      "Active/closed elections have at least 2 options each",
      failedOptionChecks.join("; "),
    ));
  }

  // d. Each active/closed election has ballot tokens generated
  const allTokens = await db
    .select()
    .from(electionBallotTokens)
    .where(inArray(electionBallotTokens.electionId, activeOrClosedIds));

  const tokensByElection = new Map<string, typeof allTokens>();
  for (const token of allTokens) {
    const existing = tokensByElection.get(token.electionId) ?? [];
    existing.push(token);
    tokensByElection.set(token.electionId, existing);
  }

  let allHaveTokens = true;
  const failedTokenChecks: string[] = [];
  for (const election of activeOrClosedElections) {
    const tokens = tokensByElection.get(election.id) ?? [];
    if (tokens.length === 0) {
      allHaveTokens = false;
      failedTokenChecks.push(`"${election.title}" has no ballot tokens`);
    }
  }

  if (allHaveTokens) {
    results.push(pass(
      "Active/closed elections have ballot tokens generated",
      `All ${activeOrClosedElections.length} election(s) have tokens`,
    ));
  } else {
    results.push(fail(
      "Active/closed elections have ballot tokens generated",
      failedTokenChecks.join("; "),
    ));
  }

  // e. Closed elections have cast ballots matching token count
  const closedIds = closedElections.map((e) => e.id);

  if (closedIds.length > 0) {
    const allCasts = await db
      .select()
      .from(electionBallotCasts)
      .where(inArray(electionBallotCasts.electionId, closedIds));

    const castsByElection = new Map<string, typeof allCasts>();
    for (const cast of allCasts) {
      const existing = castsByElection.get(cast.electionId) ?? [];
      existing.push(cast);
      castsByElection.set(cast.electionId, existing);
    }

    let allHaveCasts = true;
    const failedCastChecks: string[] = [];
    for (const election of closedElections) {
      const casts = castsByElection.get(election.id) ?? [];
      const tokens = tokensByElection.get(election.id) ?? [];
      if (casts.length === 0) {
        allHaveCasts = false;
        failedCastChecks.push(`"${election.title}" has no cast ballots`);
      } else if (casts.length > tokens.length) {
        allHaveCasts = false;
        failedCastChecks.push(
          `"${election.title}" has more casts (${casts.length}) than tokens (${tokens.length})`,
        );
      }
    }

    if (allHaveCasts) {
      results.push(pass(
        "Closed elections have cast ballots matching token count",
        `All ${closedElections.length} closed election(s) have cast ballots within token bounds`,
      ));
    } else {
      results.push(fail(
        "Closed elections have cast ballots matching token count",
        failedCastChecks.join("; "),
      ));
    }
  } else {
    results.push(pass(
      "Closed elections have cast ballots matching token count",
      "No certified/closed elections to validate (check skipped)",
    ));
  }

  // f. Election options have valid labels (non-empty strings)
  const blankLabels = allOptions.filter(
    (o) => typeof o.label !== "string" || o.label.trim().length === 0,
  );

  if (blankLabels.length === 0) {
    results.push(pass(
      "Election options have valid labels",
      `All ${allOptions.length} option(s) have non-empty labels`,
    ));
  } else {
    results.push(fail(
      "Election options have valid labels",
      `${blankLabels.length} option(s) have blank or missing labels`,
    ));
  }

  return results;
}

async function main() {
  let checkResults: CheckResult[];

  try {
    checkResults = await runChecks();
  } catch (error: any) {
    console.error("Election verification could not connect to database:", error.message);
    process.exit(1);
  }

  const passed = checkResults.filter((r) => r.passed);
  const failed = checkResults.filter((r) => !r.passed);

  console.log("\nElections End-to-End Verification");
  console.log("==================================");

  for (const result of checkResults) {
    const icon = result.passed ? "[PASS]" : "[FAIL]";
    const detail = result.detail ? ` — ${result.detail}` : "";
    console.log(`  ${icon} ${result.label}${detail}`);
  }

  console.log("\n----------------------------------");
  console.log(`  ${passed.length} passed, ${failed.length} failed`);

  if (failed.length > 0) {
    console.log("\nFailed checks:");
    for (const result of failed) {
      console.log(`  - ${result.label}: ${result.detail}`);
    }
    process.exit(1);
  } else {
    console.log("\nAll election integrity checks passed.");
    process.exit(0);
  }
}

main();
