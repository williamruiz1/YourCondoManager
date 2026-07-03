/**
 * Stripe Charge Metadata + Statement Descriptor + Application Fee helpers
 *
 * Spec: `~/code/founder-os/wiki/products/ycm/stripe-connect-spec.md`
 *   §1.2 — Application fee mechanic (1.0% default; $0.50 floor; $25 ceiling)
 *   §2.3 — Statement descriptor suffix vocabulary (controlled enum)
 *   §3.1 — Required Stripe metadata keys per charge
 *
 * Pure functions — no I/O. Tests cover the contract; integration tests at
 * the route + service layer exercise the wiring into Stripe.
 *
 * Per Issue founder-os#969 dispatch §Scope.
 */

// ── §2.3 — Statement descriptor suffix vocabulary ──────────────────────────

/**
 * Controlled vocabulary mapping owner-ledger `entryType` → Stripe descriptor
 * suffix (`statement_descriptor_suffix`). Stays under Stripe's 22-char total
 * budget combined with the per-HOA `YCM-…` prefix (capped at ~17 chars in
 * `buildStatementDescriptorPrefix`).
 *
 * Per spec §2.3:
 *   dues → DUES, assessment → ASMT, late_fee → LATE,
 *   reserve_contribution → RSRV, fine → FINE, interest → INTR,
 *   legal_fee → LEGAL, other → MISC
 */
export const STATEMENT_DESCRIPTOR_SUFFIX_VOCABULARY = {
  dues: "DUES",
  assessment: "ASMT",
  late_fee: "LATE",
  reserve_contribution: "RSRV",
  fine: "FINE",
  interest: "INTR",
  legal_fee: "LEGAL",
  other: "MISC",
} as const;

export type ChargeType = keyof typeof STATEMENT_DESCRIPTOR_SUFFIX_VOCABULARY;

const VALID_CHARGE_TYPES = new Set<string>(Object.keys(STATEMENT_DESCRIPTOR_SUFFIX_VOCABULARY));

/**
 * Pick the statement descriptor suffix for a given entry type. Falls back to
 * `MISC` (the `other` mapping) for unknown / null inputs so we always have a
 * value — descriptor suffixes are required by Stripe when the platform sets
 * a per-account `statement_descriptor`.
 */
export function descriptorSuffixForEntryType(entryType: string | null | undefined): string {
  if (!entryType) return STATEMENT_DESCRIPTOR_SUFFIX_VOCABULARY.other;
  // Hyphen vs underscore tolerance — older code uses `late-fee` etc.
  const normalized = entryType.toLowerCase().replace(/-/g, "_");
  if (VALID_CHARGE_TYPES.has(normalized)) {
    return STATEMENT_DESCRIPTOR_SUFFIX_VOCABULARY[normalized as ChargeType];
  }
  return STATEMENT_DESCRIPTOR_SUFFIX_VOCABULARY.other;
}

/** Normalize a free-form entryType into a spec §3.1 `charge_type` enum value. */
export function normalizeChargeType(entryType: string | null | undefined): ChargeType {
  if (!entryType) return "other";
  const normalized = entryType.toLowerCase().replace(/-/g, "_");
  if (VALID_CHARGE_TYPES.has(normalized)) return normalized as ChargeType;
  return "other";
}

// ── §1.2 — Application fee mechanic ────────────────────────────────────────

/** Default application fee rate (1.0%). Per spec §1.2 placeholder. */
export const DEFAULT_APPLICATION_FEE_RATE = 0.01;

/** Floor: $0.50 minimum on charges under $50. Stored in cents. */
export const APPLICATION_FEE_FLOOR_CENTS = 50;

/** Ceiling: $25 maximum on charges above $2,500. Stored in cents. */
export const APPLICATION_FEE_CEILING_CENTS = 2500;

/**
 * Compute the application fee in cents for a given charge amount.
 *
 * Rules (spec §1.2):
 *   1. Fee = `amountCents * rate` (rate as fraction, e.g. 0.01 for 1.0%)
 *   2. Floor at $0.50 — never less, even on tiny charges
 *   3. Ceiling at $25 — never more, even on large charges
 *   4. Never exceed the charge itself (degenerate guard for amounts < $0.50)
 *
 * Returns an integer (cents).
 */
export function computeApplicationFeeCents(
  amountCents: number,
  ratePercentage: number = DEFAULT_APPLICATION_FEE_RATE,
): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  if (!Number.isFinite(ratePercentage) || ratePercentage <= 0) return 0;

  const computed = Math.round(amountCents * ratePercentage);
  const floored = Math.max(computed, APPLICATION_FEE_FLOOR_CENTS);
  const capped = Math.min(floored, APPLICATION_FEE_CEILING_CENTS);
  // Never charge more in fees than the principal — protects degenerate cases
  // where someone tries to pay $0.10 and the floor would exceed the amount.
  return Math.min(capped, amountCents);
}

// ── §3.1 — Spec metadata schema ────────────────────────────────────────────

/**
 * Inputs needed to build the spec §3.1 metadata for a Stripe charge. All
 * required fields are non-null; optional ones map to undefined when absent.
 */
export type ChargeMetadataContext = {
  // Required (§3.1)
  ownerName: string;
  ownerId: string;
  unitId: string;
  unitLabel: string;
  hoaId: string;
  hoaName: string;
  ledgerEntryId: string;
  chargeType: ChargeType;
  /** YYYY-MM */
  period: string;
  /** "production" | "staging" | "development" */
  environment: string;

  // Optional (§3.2)
  assessmentId?: string | null;
  paymentLinkToken?: string | null;
  autopayEnrollmentId?: string | null;
  /** YYYY-MM-DD */
  originalDueDate?: string | null;
  /**
   * Phase 1 (P0-3) — the unit's unique payment reference (units.unitAccountRef,
   * e.g. "CHC-0007"). When present, it is emitted as `unit_account_ref` so the
   * reconciliation Tier-0 pass can resolve the deposit to the unit at
   * confidence 1.0 straight off the Stripe metadata rail. Optional — un-backfilled
   * units simply omit it (the existing unit_id + name path still applies).
   */
  unitAccountRef?: string | null;
};

/** Schema version per §3.1 `ycm_charge_version`. Bump on shape changes. */
export const CHARGE_METADATA_SCHEMA_VERSION = 1;

/**
 * Build the canonical Stripe metadata object per spec §3.1. The returned
 * record can be flattened into a URLSearchParams form post under
 * `metadata[<key>]` or `payment_intent_data[metadata][<key>]` (spec §3.3 — all
 * snake_case, full UUIDs, Stripe-searchable).
 *
 * Optional keys are omitted (not set to null) so we don't pollute Stripe's
 * 50-keys-per-object budget.
 */
export function buildSpecMetadata(ctx: ChargeMetadataContext): Record<string, string> {
  const out: Record<string, string> = {
    owner_name: ctx.ownerName,
    owner_id: ctx.ownerId,
    unit_id: ctx.unitId,
    unit_label: ctx.unitLabel,
    hoa_id: ctx.hoaId,
    hoa_name: ctx.hoaName,
    ledger_entry_id: ctx.ledgerEntryId,
    charge_type: ctx.chargeType,
    period: ctx.period,
    ycm_environment: ctx.environment,
    ycm_charge_version: String(CHARGE_METADATA_SCHEMA_VERSION),
  };
  if (ctx.assessmentId) out.assessment_id = ctx.assessmentId;
  if (ctx.paymentLinkToken) out.payment_link_token = ctx.paymentLinkToken;
  if (ctx.autopayEnrollmentId) out.autopay_enrollment_id = ctx.autopayEnrollmentId;
  if (ctx.originalDueDate) out.original_due_date = ctx.originalDueDate;
  // Phase 1 (P0-3): unique per-unit payment reference on the Stripe rail.
  if (ctx.unitAccountRef) out.unit_account_ref = ctx.unitAccountRef;
  return out;
}

/**
 * Apply a flat metadata object to a URLSearchParams under both top-level
 * `metadata[key]` AND nested `payment_intent_data[metadata][key]` so the
 * fields are visible on session, payment_intent, and charge resources.
 *
 * Matches the existing pattern at server/routes.ts:5386-5397 +
 * server/services/payment-service.ts:117-130 (which only set the legacy
 * subset — this helper writes the full spec §3.1 set).
 */
export function applyChargeMetadataToCheckoutSession(
  params: URLSearchParams,
  metadata: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(metadata)) {
    params.set(`payment_intent_data[metadata][${key}]`, value);
    params.set(`metadata[${key}]`, value);
  }
}

/** Same as above, but for off-session PaymentIntent creation (no nested intent). */
export function applyChargeMetadataToPaymentIntent(
  params: URLSearchParams,
  metadata: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(metadata)) {
    params.set(`metadata[${key}]`, value);
  }
}

// ── Period helpers ──────────────────────────────────────────────────────────

/** Format a Date (or now) as `YYYY-MM` for spec §3.1 `period`. UTC-anchored. */
export function periodFromDate(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Format a Date as `YYYY-MM-DD` for spec §3.2 `original_due_date`. UTC. */
export function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
