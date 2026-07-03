/**
 * Canonical source-of-truth for the role sets that gate every money-mutation
 * surface in YCM (Issue #214 / dispatch #8537). Kept side-effect-free (type-only
 * import) so the permission-matrix drift-guard test can import these WITHOUT
 * pulling in the DB / route-registration import chain.
 *
 * Documented in `docs/security/financial-route-role-matrix.md`. Any change here
 * MUST update that matrix + is locked by
 * `server/routes/__tests__/financial-role-constants.test.ts`.
 *
 * Money-sensitivity tiering (tighter = fewer roles):
 *   - RECORD_ROLES         — post a payment (money IN, ledger-authoritative): treasurer-tight.
 *   - REFUND_ROLES         — refund (money OUT): + manager.
 *   - DISBURSEMENT_WRITE_ROLES — disburse (money OUT): + manager.
 *   - RECON_WRITE_ROLES    — alter reconciliation matches: the 5 operator personas.
 *   `viewer` is excluded from EVERY set (read-only role never mutates money).
 */

import type { AdminRole } from "@shared/schema";

// Spec: platform-admin + board-treasurer only. board-treasurer doesn't exist in
// this codebase's AdminRole enum; board-officer is the treasurer-equivalent.
export const RECORD_ROLES: AdminRole[] = ["platform-admin", "board-officer"];

// Refunds move money OUT — gate to platform-admin / board-officer / manager.
export const REFUND_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "manager",
];

// Money-OUT WRITE roles — segregation of duties operates WITHIN this set: any
// two DIFFERENT members can be maker + checker.
export const DISBURSEMENT_WRITE_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "manager",
];

// Reconciliation match writes — the five operator personas EXCLUDING `viewer`.
export const RECON_WRITE_ROLES: AdminRole[] = [
  "platform-admin",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "manager",
];
