# Phase 1 Audit — A5 Documents & Insurance

**Auditor:** A5
**Date:** 2026-04-11
**Scope:** 2 pages — `documents.tsx` (`/app/documents`), `insurance.tsx` (`/app/insurance`)

---

## Scorecard

| Page | Purpose | Persona | Category | Zone | Placement | Fulfillment | Verdict | Target | Rationale | Gaps | Cog |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `documents.tsx` | This page exists to upload, classify, version, tag, and publish association documents to operators and the owner portal. | `manager` | Z2-2 Document Vault | zone-2 | `wrong-section` | `complete` | `RENAME-MOVE` | Nest under a "Documents & Records" section (Zone 2 reference group) separate from day-to-day operations | Stands correctly as a top-level nav item but is peer-level with Insurance and both float unanchored between Board/Comms and Operations; they should form a discrete Zone 2 reference group | Portal visibility toggle (`isPortalVisible` / `portalAudience`) is a lightweight publication workflow that has no corresponding review or approval step; if document approval gates are added later this page will need a workflow verdict re-evaluation | med |
| `insurance.tsx` | This page exists to record, track, and alert on association insurance policies including carrier, coverage limits, premiums, and renewal dates. | `manager` | Z2-2 Document Vault | zone-2 | `wrong-section` | `complete` | `MERGE-AS-TAB` | Merge as a tab under `/app/documents` (Z2-2 Document Vault hub), titled "Policies" or "Insurance" | Policy registry is setup-level reference data consulted occasionally, not transacted daily; no claims, no payment processing, no work-order linkage — it is reference coverage metadata that belongs alongside the document vault, not inside Finance or Operations | No file attachment on policies (a PDF of the actual policy certificate cannot be stored here — only structured metadata); no claims tracking; no link to work orders or vendor invoices for claim-related costs | low |

---

## DEMOTE-ADMIN handovers

None. Both pages are manager/board-admin primary and correctly scoped to Zone 2. Neither contains platform-operator-only functionality.

---

## Cross-refs

- **Portal publish toggle in `documents.tsx`** — `isPortalVisible` and `portalAudience` fields send documents to `/portal`. The portal surface (`/portal/*`) is out of scope for this audit (C9), but the toggle is a workflow seam: if the owner later adds a document approval step, this page's verdict may need to escalate from `RENAME-MOVE` to `PATCH` (to add the review gate) or even a separate `ORPHAN-SURFACE` for a distribution sub-flow. Flag for Phase 3 reconciliation.
- **Insurance document type in `documents.tsx`** — The document type list at line 54 includes `"Insurance"` as a valid category. This means insurance policy PDFs can already be stored in the vault. After `insurance.tsx` is merged as a tab under Documents, operators will have both structured policy metadata (the merged tab) and the underlying PDF files (the vault list filtered to type "Insurance") in one hub. Phase 5 should surface both panes on the merged hub and consider removing the ambiguity of having two Insurance entry points.
- **Missing-file integrity check** — `documents.tsx` queries `/api/documents/missing-files` and surfaces a `missingFileIds` set that badges broken document rows. This is an implicit audit-trail feature. If a future audit-trail requirement is scoped, this detection logic is the foundation — note for Phase 5.
- **`amenities.tsx` (out of scope)** — noted in spec §10 as out of scope; not audited here.

---

## Insurance category analysis

**Decision: Z2-2 Document Vault.**

The three candidates from the spec were Z2-2 (Document Vault), Z1-3 (Financial Operations), and Z1-6 (Service & Maintenance/claim-as-work).

**Against Z1-6 (claim-as-work):** `insurance.tsx` has no claims workflow, no incident filing, no link to work orders, and no vendor coordination. The page is purely a policy registry. Z1-6 is ruled out.

**Against Z1-3 (Financial Operations):** The page captures `premiumAmount` and `coverageAmount` as optional metadata fields. These are informational — no payment is processed, no invoice is generated, no ledger entry is created. The presence of a dollar field does not make a page financial-operational any more than a unit square-footage field makes a page a construction page. The renewal/expiration alert (`slaStatus`, 90-day warning) is a compliance reminder, not a financial transaction trigger. Z1-3 requires billing, collections, payments, or reporting workflows — none exist here.

**For Z2-2 (Document Vault):** The page is a structured reference registry of association-level insurance policies. It is consulted at onboarding (to enter existing policies), at renewal time (when the 90-day alert fires), and occasionally for board inquiries. Traffic is task-driven and bursty — exactly the Zone 2 pattern (§5). The `documents.tsx` document type list already includes `"Insurance"` as a category, confirming the product already treats insurance as a document-class concern. Merging `insurance.tsx` as a "Policies" tab within the Document Vault hub produces a single reference surface where managers can store both the policy PDF (via the vault) and structured metadata (via the merged tab), with zero Z1 operational surface fragmentation.

**Verdict for `insurance.tsx`:** `MERGE-AS-TAB` → target `/app/documents` (Z2-2 Document Vault hub), rendered as a "Policies" tab alongside the main document list tab. The top-level "Insurance" sidebar entry should be removed once the tab is live.
