/**
 * YCM — Go-live readiness auto-check service.
 *
 * Per founder-os Issue #1340 (Cherry Hill go-live readiness BUILD). Source of
 * truth for gate inventory + status is:
 *   ~/code/founder-os/wiki/products/ycm/cherry-hill-go-live-checklist-v1.md
 *
 * Plain-English summary (per OP #19):
 *   The /admin/go-live-readiness dashboard asks "are we ready to ring the
 *   bell for Cherry Hill (or any future HOA)?" by checking 23+ named gates
 *   across 7 tiers. Some gates can be checked automatically — is PR #X
 *   merged? does this association have 18 owners? is the Stripe Connect
 *   account active? — those run on dashboard render. Other gates require
 *   a human attestation ("William ran the $1 ACH test charge and it
 *   reconciled successfully") and are marked verified via the dashboard's
 *   "Mark verified" button (stores a row in go_live_gate_attestations).
 *
 * Phase 0 (#1340 this dispatch):
 *   - Gate registry covering all 7 tiers per the wiki checklist
 *   - 8 auto-check functions implemented (PR-status + DB-state +
 *     HTTP-200 + env-presence categories per AC)
 *   - Remaining gates render as "pending" with a Mark verified button
 *
 * Phase 1 follow-ons (not in this dispatch):
 *   - Implement the other auto-checks (Stripe API ping, GA4 API ping,
 *     Plaid token presence, etc.)
 *   - Green-light ceremony auto-fire when all HARD GREEN
 *   - n=1 reference for #1307 cross-product template extraction
 *
 * Cross-link: founder-os#1307 — this implementation is the n=1 reference
 * instance for the cross-product launch-readiness template.
 */

import { and, count, desc, eq, gt, gte, isNotNull } from "drizzle-orm";
import { db } from "../db";
import {
  aiAssistantInteractions,
  ownerLedgerEntries,
  portalAccess,
  units,
  paymentGatewayConnections,
  goLiveGateAttestations,
} from "@shared/schema";

// =========================================================================
// Core types — match the wiki spec exactly (§"Auto-check service" lines 202-233).
// =========================================================================

export type GateStatus = "pass" | "fail" | "pending";

export type CheckResult = {
  status: GateStatus;
  evidence: string;           // human-readable: e.g. "PR #124 merged 2026-05-15"
  last_checked: string;       // ISO timestamp
  cache_ttl_seconds?: number; // optional; default 60
};

export type GateCheck = (associationId: string) => Promise<CheckResult>;

// =========================================================================
// Gate registry — full inventory across the 7 tiers per the wiki checklist.
// Every gate has: id, tier, name, hardSoft, verifyMethod, owning dispatch ref.
// The 🤖 gates with implemented auto-checks have a `autoCheck: GateCheck`
// function attached. Gates without one return `pending` and surface as
// human-attestation candidates on the dashboard.
// =========================================================================

export type TierLight = "HARD" | "SOFT" | "NONBLOCKING";

export type GateMeta = {
  id: string;                        // e.g. "A.1", "B.3"
  tier: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  name: string;                      // human-readable
  hardSoft: TierLight;               // tier-level classification
  verifyMethod: "auto" | "manual";   // 🤖 or 👤 in the wiki
  owningDispatch: string;            // e.g. "#968" or "PR #124"
  autoCheck?: GateCheck;             // present iff verifyMethod === "auto" and implemented
};

export const TIER_NAMES: Record<GateMeta["tier"], string> = {
  A: "Payment infrastructure",
  B: "Owner experience",
  C: "Board experience",
  D: "Marketing + acquisition",
  E: "Operational + observability",
  F: "Customer success readiness",
  G: "Cross-product",
};

export const TIER_HARD_SOFT: Record<GateMeta["tier"], TierLight> = {
  A: "HARD",
  B: "HARD",
  C: "SOFT",
  D: "NONBLOCKING",
  E: "HARD",
  F: "SOFT",
  G: "SOFT",
};

// =========================================================================
// Auto-check implementations (8 gates per AC). Each returns a CheckResult.
// =========================================================================

const isoNow = (): string => new Date().toISOString();

/**
 * A.2 — Charge metadata + statement descriptor wired (PR #124 + DB shape).
 * Check: is YCM PR #124 merged on GitHub?
 */
const checkA2_chargeMetadata: GateCheck = async () => {
  try {
    const res = await fetch("https://api.github.com/repos/williamruiz1/YourCondoManager/pulls/124", {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });
    if (!res.ok) {
      return {
        status: "pending",
        evidence: `GitHub API returned ${res.status} querying PR #124`,
        last_checked: isoNow(),
      };
    }
    const pr = (await res.json()) as { merged?: boolean; merged_at?: string };
    if (pr.merged) {
      return {
        status: "pass",
        evidence: `PR #124 merged ${pr.merged_at ?? "—"}`,
        last_checked: isoNow(),
      };
    }
    return {
      status: "pending",
      evidence: "PR #124 open / not merged",
      last_checked: isoNow(),
    };
  } catch (err) {
    return {
      status: "pending",
      evidence: `GitHub API error: ${(err as Error).message}`,
      last_checked: isoNow(),
    };
  }
};

/**
 * A.4 — Plaid ACH integration live (env-presence check).
 * Check: PLAID_ENV environment variable set.
 */
const checkA4_plaidEnv: GateCheck = async () => {
  const present = Boolean(process.env.PLAID_ENV?.trim());
  return {
    status: present ? "pass" : "pending",
    evidence: present ? `PLAID_ENV=${process.env.PLAID_ENV}` : "PLAID_ENV not set",
    last_checked: isoNow(),
  };
};

/**
 * A.5 — Association has a connected Stripe account (DB-state check).
 * Check: payment_gateway_connections row exists for this association
 * with a non-empty Stripe Connect account id.
 */
const checkA5_stripeConnectActive: GateCheck = async (associationId: string) => {
  try {
    const rows = await db
      .select({ id: paymentGatewayConnections.id })
      .from(paymentGatewayConnections)
      .where(
        and(
          eq(paymentGatewayConnections.associationId, associationId),
          isNotNull(paymentGatewayConnections.providerAccountId),
        ),
      )
      .limit(1);
    if (rows.length > 0) {
      return {
        status: "pass",
        evidence: `payment_gateway_connections row present for association ${associationId}`,
        last_checked: isoNow(),
      };
    }
    return {
      status: "pending",
      evidence: "No payment_gateway_connections row with external_account_id",
      last_checked: isoNow(),
    };
  } catch (err) {
    return {
      status: "pending",
      evidence: `DB query error: ${(err as Error).message}`,
      last_checked: isoNow(),
    };
  }
};

/**
 * B.1 — All N owner units have YCM account (DB-state count via units).
 * Proxy: count of `units` rows for the association (each unit ↔ owner).
 * For CHC the expected count is 18; we report the actual count and pass
 * if >= 1. The per-association expected count is a config follow-on.
 */
const checkB1_ownersHaveAccounts: GateCheck = async (associationId: string) => {
  try {
    const rows = await db
      .select({ n: count() })
      .from(units)
      .where(eq(units.associationId, associationId));
    const n = Number(rows[0]?.n ?? 0);
    return {
      status: n > 0 ? "pass" : "pending",
      evidence: `${n} units for association ${associationId}`,
      last_checked: isoNow(),
    };
  } catch (err) {
    return {
      status: "pending",
      evidence: `DB query error: ${(err as Error).message}`,
      last_checked: isoNow(),
    };
  }
};

/**
 * B.2 — Owner portal shows correct balance per owner (DB-state check).
 * Checks two things:
 *   1. At least one active portal_access row exists for the association
 *      (owners have accounts that can log in).
 *   2. At least one owner_ledger_entries row exists for the association
 *      (there is something to show in the balance — either a charge or
 *      an imported assessment). An empty ledger would mean the portal
 *      shows $0 for every owner, which is technically "correct" but
 *      not meaningful for go-live.
 * This gate is verifyMethod:"auto" but had no autoCheck wired. Adding it
 * here per P0-1 trace (Issue #204, 2026-05-30).
 */
const checkB2_ownerPortalBalance: GateCheck = async (associationId: string) => {
  try {
    const [portalRows, ledgerRows] = await Promise.all([
      db
        .select({ n: count() })
        .from(portalAccess)
        .where(
          and(
            eq(portalAccess.associationId, associationId),
            eq(portalAccess.status, "active"),
          ),
        ),
      db
        .select({ n: count() })
        .from(ownerLedgerEntries)
        .where(eq(ownerLedgerEntries.associationId, associationId)),
    ]);
    const portalN = Number(portalRows[0]?.n ?? 0);
    const ledgerN = Number(ledgerRows[0]?.n ?? 0);
    if (portalN > 0 && ledgerN > 0) {
      return {
        status: "pass",
        evidence: `${portalN} active portal_access rows; ${ledgerN} owner_ledger_entries — balance API has data to display`,
        last_checked: isoNow(),
      };
    }
    const missing: string[] = [];
    if (portalN === 0) missing.push("no active portal_access rows (owners cannot log in)");
    if (ledgerN === 0) missing.push("no owner_ledger_entries (portal would show $0 for all owners)");
    return {
      status: "pending",
      evidence: missing.join("; "),
      last_checked: isoNow(),
    };
  } catch (err) {
    return {
      status: "pending",
      evidence: `DB query error: ${(err as Error).message}`,
      last_checked: isoNow(),
    };
  }
};

/**
 * B.5 — Transactional email infrastructure (env-presence check).
 * Check: EMAIL_FROM + RESEND_API_KEY environment variables set.
 */
const checkB5_emailInfra: GateCheck = async () => {
  const emailFrom = process.env.EMAIL_FROM?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (emailFrom && resendKey) {
    return {
      status: "pass",
      evidence: `EMAIL_FROM=${emailFrom}; RESEND_API_KEY set`,
      last_checked: isoNow(),
    };
  }
  const missing = [
    !emailFrom && "EMAIL_FROM",
    !resendKey && "RESEND_API_KEY",
  ].filter(Boolean).join(", ");
  return {
    status: "pending",
    evidence: `Missing: ${missing}`,
    last_checked: isoNow(),
  };
};

/**
 * D.1 — Landing page live (HTTP-200 check).
 * Check: yourcondomanager.org returns 2xx.
 */
const checkD1_landingPageLive: GateCheck = async () => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://yourcondomanager.org/", {
      method: "HEAD",
      signal: ctrl.signal,
      redirect: "follow",
    }).finally(() => clearTimeout(timer));
    if (res.ok) {
      return {
        status: "pass",
        evidence: `HTTP ${res.status} from yourcondomanager.org`,
        last_checked: isoNow(),
      };
    }
    return {
      status: "pending",
      evidence: `HTTP ${res.status} from yourcondomanager.org`,
      last_checked: isoNow(),
    };
  } catch (err) {
    return {
      status: "pending",
      evidence: `Fetch error: ${(err as Error).message}`,
      last_checked: isoNow(),
    };
  }
};

/**
 * E.1 — Sentry capturing errors (PR-status check on PR #125 + env presence).
 * Check: PR #125 (observability wiring) merged on GitHub AND SENTRY_DSN
 * env var present on the running instance.
 */
const checkE1_sentryWired: GateCheck = async () => {
  const sentryEnv = Boolean(process.env.SENTRY_DSN?.trim());
  try {
    const res = await fetch("https://api.github.com/repos/williamruiz1/YourCondoManager/pulls/125", {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });
    if (!res.ok) {
      return {
        status: "pending",
        evidence: `GitHub API returned ${res.status} for PR #125`,
        last_checked: isoNow(),
      };
    }
    const pr = (await res.json()) as { merged?: boolean; merged_at?: string };
    if (pr.merged && sentryEnv) {
      return {
        status: "pass",
        evidence: `PR #125 merged ${pr.merged_at ?? "—"}; SENTRY_DSN set`,
        last_checked: isoNow(),
      };
    }
    if (pr.merged && !sentryEnv) {
      return {
        status: "pending",
        evidence: `PR #125 merged but SENTRY_DSN not set`,
        last_checked: isoNow(),
      };
    }
    return {
      status: "pending",
      evidence: "PR #125 open / not merged",
      last_checked: isoNow(),
    };
  } catch (err) {
    return {
      status: "pending",
      evidence: `GitHub API error: ${(err as Error).message}`,
      last_checked: isoNow(),
    };
  }
};

/**
 * E.3 — AI cost economics tracking live (DB-state check).
 * Check: ai_assistant_interactions has rows with non-zero cost_estimate
 * in the last 7 days (proves Phase 1 LLM adapter is writing real values).
 */
const checkE3_aiCostTracking: GateCheck = async (associationId: string) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ n: count() })
      .from(aiAssistantInteractions)
      .where(
        and(
          eq(aiAssistantInteractions.associationId, associationId),
          gte(aiAssistantInteractions.createdAt, sevenDaysAgo),
          gte(aiAssistantInteractions.costEstimate, 0.000001),
        ),
      );
    const n = Number(rows[0]?.n ?? 0);
    if (n > 0) {
      return {
        status: "pass",
        evidence: `${n} interactions with non-zero cost_estimate in last 7d`,
        last_checked: isoNow(),
      };
    }
    return {
      status: "pending",
      evidence: "No ai_assistant_interactions with non-zero cost_estimate in last 7d",
      last_checked: isoNow(),
    };
  } catch (err) {
    return {
      status: "pending",
      evidence: `DB query error: ${(err as Error).message}`,
      last_checked: isoNow(),
    };
  }
};

// =========================================================================
// Gate registry — full inventory. Per-gate metadata mirrors the wiki spec
// at wiki/products/ycm/cherry-hill-go-live-checklist-v1.md.
// =========================================================================

export const GATES: GateMeta[] = [
  // ---- Tier A — Payment infrastructure (HARD) ----
  { id: "A.1", tier: "A", name: "Stripe Connect platform onboarding live", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "#968" },
  { id: "A.2", tier: "A", name: "Charge metadata + statement descriptor wired", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "PR #124 / #969", autoCheck: checkA2_chargeMetadata },
  { id: "A.3", tier: "A", name: "Reconciliation report + Gap C fix", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "#970" },
  { id: "A.4", tier: "A", name: "Plaid ACH integration live", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "#1266", autoCheck: checkA4_plaidEnv },
  { id: "A.5", tier: "A", name: "Association has connected Stripe account", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "A.1+A.2", autoCheck: checkA5_stripeConnectActive },
  { id: "A.6", tier: "A", name: "$1 test charge flows ACH end-to-end + reconciles", hardSoft: "HARD", verifyMethod: "manual", owningDispatch: "A.1-A.5" },
  { id: "A.7", tier: "A", name: "$1 test charge flows card end-to-end + reconciles", hardSoft: "HARD", verifyMethod: "manual", owningDispatch: "A.1-A.5" },
  { id: "A.8", tier: "A", name: "First real owner pays driveway-assessment via ACH", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "A.1-A.7" },

  // ---- Tier B — Owner experience (HARD) ----
  { id: "B.1", tier: "B", name: "All owners have YCM account", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "seed.ts", autoCheck: checkB1_ownersHaveAccounts },
  { id: "B.2", tier: "B", name: "Owner portal shows correct balance per owner", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "—", autoCheck: checkB2_ownerPortalBalance },
  { id: "B.3", tier: "B", name: "Owner can log in + see ledger + pay", hardSoft: "HARD", verifyMethod: "manual", owningDispatch: "A.1-A.5+B.1" },
  { id: "B.4", tier: "B", name: "AI Phase 0 chat answers balance / payment questions", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "#1153" },
  { id: "B.5", tier: "B", name: "Transactional email infra (EMAIL_FROM + RESEND_API_KEY)", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "PR #126 / #1042", autoCheck: checkB5_emailInfra },
  { id: "B.6", tier: "B", name: "Brand v1 applied to in-app surfaces + emails", hardSoft: "HARD", verifyMethod: "manual", owningDispatch: "#1141" },

  // ---- Tier C — Board experience (SOFT) ----
  { id: "C.1", tier: "C", name: "Board admin can view portfolio dashboard", hardSoft: "SOFT", verifyMethod: "manual", owningDispatch: "—" },
  { id: "C.2", tier: "C", name: "Board admin can send communication to all owners", hardSoft: "SOFT", verifyMethod: "auto", owningDispatch: "B.5" },
  { id: "C.3", tier: "C", name: "Board admin can view reconciliation report", hardSoft: "SOFT", verifyMethod: "manual", owningDispatch: "A.3" },
  { id: "C.4", tier: "C", name: "Board admin can initiate refund / dispute response", hardSoft: "SOFT", verifyMethod: "manual", owningDispatch: "A.1-A.3" },

  // ---- Tier D — Marketing + acquisition (NONBLOCKING) ----
  { id: "D.1", tier: "D", name: "yourcondomanager.org landing page live", hardSoft: "NONBLOCKING", verifyMethod: "auto", owningDispatch: "#1024", autoCheck: checkD1_landingPageLive },
  { id: "D.2", tier: "D", name: "/tour route live", hardSoft: "NONBLOCKING", verifyMethod: "auto", owningDispatch: "#1272" },
  { id: "D.3", tier: "D", name: "/demo Cal.com booking active", hardSoft: "NONBLOCKING", verifyMethod: "auto", owningDispatch: "#1272" },
  { id: "D.4", tier: "D", name: "/trial-signup wired", hardSoft: "NONBLOCKING", verifyMethod: "auto", owningDispatch: "#1272" },
  { id: "D.5", tier: "D", name: "Cherry Hill case study draft (post-GO)", hardSoft: "NONBLOCKING", verifyMethod: "manual", owningDispatch: "post-GO" },

  // ---- Tier E — Operational + observability (HARD) ----
  { id: "E.1", tier: "E", name: "Sentry capturing errors in production", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "PR #125 / #1030", autoCheck: checkE1_sentryWired },
  { id: "E.2", tier: "E", name: "GA4 tracking page-views + events", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "PR #125 / #1030" },
  { id: "E.3", tier: "E", name: "AI cost economics tracking live", hardSoft: "HARD", verifyMethod: "auto", owningDispatch: "#1261", autoCheck: checkE3_aiCostTracking },
  { id: "E.4", tier: "E", name: "CT CIOA compliance audit complete", hardSoft: "HARD", verifyMethod: "manual", owningDispatch: "#1035" },
  { id: "E.5", tier: "E", name: "Security baseline reviewed at >= Level 1", hardSoft: "HARD", verifyMethod: "manual", owningDispatch: "#351+#352+#360" },

  // ---- Tier F — Customer success readiness (SOFT) ----
  { id: "F.1", tier: "F", name: "Goodwin engagement initiated (legal counsel)", hardSoft: "SOFT", verifyMethod: "manual", owningDispatch: "stripe-connect §7.4" },
  { id: "F.2", tier: "F", name: "Onboarding wizard tested end-to-end", hardSoft: "SOFT", verifyMethod: "manual", owningDispatch: "#1158" },
  { id: "F.3", tier: "F", name: "CHC board walked through wizard with William", hardSoft: "SOFT", verifyMethod: "manual", owningDispatch: "F.2" },
  { id: "F.4", tier: "F", name: "Sub-dispatch logged for CHC subscription pricing decision", hardSoft: "SOFT", verifyMethod: "auto", owningDispatch: "stripe-connect §8" },

  // ---- Tier G — Cross-product (SOFT) ----
  { id: "G.1", tier: "G", name: "Compass dogfood status documented (CHC = n=1)", hardSoft: "SOFT", verifyMethod: "manual", owningDispatch: "#1180+Compass#1064" },
  { id: "G.2", tier: "G", name: "CHC ↔ Compass data-sharing model documented if relevant", hardSoft: "SOFT", verifyMethod: "manual", owningDispatch: "#1180" },
];

// =========================================================================
// Snapshot computation — run all auto-checks + join attestations.
// Used by the route handler at GET /api/admin/go-live-readiness/:association_id.
// =========================================================================

export type GateSnapshot = GateMeta & {
  result: CheckResult;
  attestation?: {
    attested_by_email: string;
    attested_at: string;
    notes?: string;
  };
  overall_status: GateStatus;  // attestation overrides auto-check pending
};

export type TierSnapshot = {
  tier: GateMeta["tier"];
  name: string;
  hardSoft: TierLight;
  light: "GREEN" | "AMBER" | "RED";
  gates: GateSnapshot[];
};

export type ReadinessSnapshot = {
  association_id: string;
  computed_at: string;
  tiers: TierSnapshot[];
  top_light: "GREEN" | "AMBER" | "RED";
  hard_gates_total: number;
  hard_gates_passing: number;
};

const PENDING_RESULT = (gateId: string): CheckResult => ({
  status: "pending",
  evidence: `Gate ${gateId} requires manual attestation (no auto-check implemented in Phase 0)`,
  last_checked: new Date().toISOString(),
});

export async function computeReadinessSnapshot(associationId: string): Promise<ReadinessSnapshot> {
  // Run all auto-checks in parallel.
  const results: Array<{ meta: GateMeta; result: CheckResult }> = await Promise.all(
    GATES.map(async (meta) => {
      if (meta.autoCheck) {
        try {
          return { meta, result: await meta.autoCheck(associationId) };
        } catch (err) {
          return {
            meta,
            result: {
              status: "pending" as const,
              evidence: `auto-check threw: ${(err as Error).message}`,
              last_checked: new Date().toISOString(),
            },
          };
        }
      }
      return { meta, result: PENDING_RESULT(meta.id) };
    }),
  );

  // Pull most-recent attestation per gate for this association.
  const attestRows = await db
    .select({
      gateId: goLiveGateAttestations.gateId,
      attestedByEmail: goLiveGateAttestations.attestedByEmail,
      attestedAt: goLiveGateAttestations.attestedAt,
      notes: goLiveGateAttestations.notes,
    })
    .from(goLiveGateAttestations)
    .where(eq(goLiveGateAttestations.associationId, associationId))
    .orderBy(desc(goLiveGateAttestations.attestedAt));

  const latestByGate = new Map<string, typeof attestRows[number]>();
  for (const row of attestRows) {
    if (!latestByGate.has(row.gateId)) latestByGate.set(row.gateId, row);
  }

  // Bucket by tier; compute per-tier and top-line light.
  const tierMap = new Map<GateMeta["tier"], TierSnapshot>();
  let hardTotal = 0;
  let hardPassing = 0;

  for (const { meta, result } of results) {
    const attest = latestByGate.get(meta.id);
    // An attestation "passes" the gate even if auto-check is pending.
    const overall: GateStatus = attest ? "pass" : result.status;
    const snap: GateSnapshot = {
      ...meta,
      result,
      attestation: attest
        ? {
            attested_by_email: attest.attestedByEmail,
            attested_at: attest.attestedAt.toISOString(),
            notes: attest.notes ?? undefined,
          }
        : undefined,
      overall_status: overall,
    };
    let bucket = tierMap.get(meta.tier);
    if (!bucket) {
      bucket = {
        tier: meta.tier,
        name: TIER_NAMES[meta.tier],
        hardSoft: TIER_HARD_SOFT[meta.tier],
        light: "GREEN",
        gates: [],
      };
      tierMap.set(meta.tier, bucket);
    }
    bucket.gates.push(snap);

    if (TIER_HARD_SOFT[meta.tier] === "HARD") {
      hardTotal++;
      if (overall === "pass") hardPassing++;
    }
  }

  // Compute per-tier light.
  for (const tier of tierMap.values()) {
    const anyFail = tier.gates.some((g) => g.overall_status === "fail");
    const anyPending = tier.gates.some((g) => g.overall_status === "pending");
    if (tier.hardSoft === "HARD") {
      tier.light = anyFail || anyPending ? "RED" : "GREEN";
    } else if (tier.hardSoft === "SOFT") {
      tier.light = anyFail || anyPending ? "AMBER" : "GREEN";
    } else {
      tier.light = anyFail || anyPending ? "AMBER" : "GREEN";
    }
  }

  // Top-line: RED if any HARD tier RED; AMBER if any SOFT tier AMBER; GREEN otherwise.
  let top: "GREEN" | "AMBER" | "RED" = "GREEN";
  for (const tier of tierMap.values()) {
    if (tier.hardSoft === "HARD" && tier.light === "RED") {
      top = "RED";
      break;
    }
    if (tier.light === "AMBER") top = "AMBER";
  }

  // Sort tiers A → G.
  const TIER_ORDER: GateMeta["tier"][] = ["A", "B", "C", "D", "E", "F", "G"];
  const tiers = TIER_ORDER.map((t) => tierMap.get(t)!).filter(Boolean);

  return {
    association_id: associationId,
    computed_at: new Date().toISOString(),
    tiers,
    top_light: top,
    hard_gates_total: hardTotal,
    hard_gates_passing: hardPassing,
  };
}
