/**
 * Compliance rules-engine loader (Project Statecraft, scaffold-only).
 *
 * PURE, READ-ONLY module: no database access, no writes, no wiring into any
 * existing route/service. It reads per-state rule-set JSON files out of
 * `server/compliance/rules/` and returns them as typed `StateComplianceRules`
 * objects, or a keyed `ComplianceRuleSet` when loading everything at once.
 *
 * This does NOT decide anything on its own — it is a data accessor for a
 * rules engine that a future dispatch will build on top of. Nothing here
 * should be treated as validated legal guidance; see the `verifiedWithCounsel`
 * field on every rule set.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { log } from "../logger";
import type {
  ComplianceRuleSet,
  StateCluster,
  StateComplianceRules,
} from "./rules-types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES_DIR = path.resolve(HERE, "rules");

/** Cache so repeated calls in the same process don't re-read + re-parse disk. */
let cache: ComplianceRuleSet | null = null;

/**
 * Reads every `*.json` file under `server/compliance/rules/` and builds a
 * keyed-by-state-code map. Malformed files are skipped (logged to stderr)
 * rather than throwing, so one bad data file can't take down every caller.
 */
function loadAllRuleSets(): ComplianceRuleSet {
  if (cache) return cache;

  const ruleSet: ComplianceRuleSet = {};

  let files: string[] = [];
  try {
    files = readdirSync(RULES_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    // rules/ directory missing entirely — return an empty set rather than throw.
    cache = ruleSet;
    return ruleSet;
  }

  for (const file of files) {
    const fullPath = path.join(RULES_DIR, file);
    try {
      const raw = readFileSync(fullPath, "utf8");
      const parsed = JSON.parse(raw) as StateComplianceRules;
      if (!parsed?.stateCode) {
        log(`skipping ${file}: missing stateCode`, "compliance-rules-engine");
        continue;
      }
      ruleSet[parsed.stateCode.toUpperCase()] = parsed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`failed to parse ${file}: ${msg}`, "compliance-rules-engine");
    }
  }

  cache = ruleSet;
  return ruleSet;
}

/**
 * Loads the compliance rule set for a single two-letter state code (case
 * insensitive). Returns null if no rule-set data file exists for that state
 * yet — callers must handle the "not yet modeled" case explicitly rather
 * than assume every state has data.
 */
export function loadComplianceRules(stateCode: string): StateComplianceRules | null {
  if (!stateCode) return null;
  const all = loadAllRuleSets();
  return all[stateCode.toUpperCase()] ?? null;
}

/**
 * Returns every currently-loaded state's rule set that belongs to the given
 * regulatory cluster. Empty array if no state data has been authored for
 * that cluster yet (expected for A/C/D until those clusters get their own
 * placeholder or real data files).
 */
export function getRequirementsForCluster(cluster: StateCluster): StateComplianceRules[] {
  const all = loadAllRuleSets();
  return Object.values(all).filter((rules) => rules.cluster === cluster);
}

/** Test-only: clears the in-process cache so tests can assert fresh reads. */
export function __resetComplianceRulesCacheForTests(): void {
  cache = null;
}
