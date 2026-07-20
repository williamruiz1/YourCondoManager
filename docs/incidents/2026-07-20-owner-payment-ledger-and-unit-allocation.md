# Owner payment ledger visibility and unit allocation RCA

**Date:** 2026-07-20  
**Severity:** High — owner-facing financial attribution  
**Status:** Corrective change validated locally; production correction and deployment tracked through release validation

## Summary

Two related gaps made an otherwise successful owner payment difficult to
understand and allowed it to be attributed to the wrong unit:

1. The full Owner Ledger History read only posted `owner_ledger_entries`.
   Initiated, pending, and failed `payment_transactions` therefore disappeared
   from that view even though the My Finances overview showed processing
   payments.
2. For an owner with multiple units, checkout silently selected the first unit
   with a positive balance while presenting an account-wide payment amount.
   The owner was not shown or asked which unit would receive the payment.

The affected ACH payment settled successfully. Its payment transaction,
canonical ledger credit, and Stripe audit metadata are being reassigned from
the incorrectly selected unit to the owner-requested unit. No amount, payment
status, owner, or account-wide balance changes as part of that correction.

## Root cause

### Ledger visibility

The full ledger route treated the accounting journal as the entire owner
payment history. That is correct for balance math but incomplete for lifecycle
visibility: a pending or failed payment does not yet have a posted ledger
entry. The overview already merged those two sources, but the dedicated ledger
page did not.

### Unit allocation

The client selected a payment unit with this fallback behavior:

- use the only unit for a single-unit owner;
- otherwise use the first unit with a positive balance;
- otherwise use the first unit.

That selection was not visible. Because a payment transaction and its eventual
ledger credit each contain one `unit_id`, an account-wide amount cannot safely
be inferred as belonging to one property.

## Impact

- Owners could see a payment as processing on the overview but not in the full
  ledger.
- Failed payments could disappear from the full account timeline.
- A multi-unit owner's payment could post to a unit they did not intend.
- Association-wide and owner-wide totals remained arithmetically correct, but
  the per-unit balance attribution could be wrong.

## Corrective changes

- Merge initiated, pending, and failed payment transactions into the full
  ledger timeline.
- Label each row `Processing`, `Failed`, or `Posted`.
- Keep unsettled rows informational; only posted ledger entries affect
  balances.
- Require multi-unit owners to choose the destination unit before checkout.
- Show each unit's amount due this period in the selector.
- Use the selected unit's due-now and full-balance figures for payment
  quick-fill actions.
- Include the selected unit in the primary payment button text.
- Keep the single-unit flow automatic.

## Production data correction controls

The unit reassignment uses exact identifiers and guarded current values for:

- the settled payment transaction;
- its one canonical posted ledger credit;
- the corresponding Stripe PaymentIntent and Checkout Session metadata.

The database updates and append-only audit record are executed in one
transaction. Linked webhook, processing-fee, payout, and autopay tables are
checked before mutation. The validator confirms:

- exactly one payment transaction and one ledger credit changed;
- both now reference the requested unit;
- payment amount, owner, status, and identity key are unchanged;
- the sum across all of the owner's units is unchanged;
- Stripe metadata matches the corrected unit.

## Prevention and tests

- Pure tests cover processing, failed, and posted ledger ordering and status.
- Component tests cover full-ledger status rendering and unit labels.
- A checkout regression test proves a multi-unit owner cannot submit before
  choosing a unit and that the chosen `unitId` is sent to the payment API.
- Type checking and the production build are release gates.

