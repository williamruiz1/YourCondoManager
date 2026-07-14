# AUDIT-HOA-001 — Results

**Audited:** 2026-06-19 · **Target:** `~/code/YourCondoManager` @ `a030c1f` · **Method:** running code + schema (165 tables, 42 migrations, 615 API endpoints, 38 server test files) + open GitHub Issues. Rated per the three-state model (Designed / Live / Working / Absent); evidence pointers cited inline. No rating taken from README/marketing.

---

## 1. Headline findings

- **E1 — configurable compliance rules engine: PARTIAL, and it caps the platform.** A genuinely data-driven, versioned, legal-review-workflowed *governance-task* engine exists (`shared/governance-state-template-library.ts`, `governance_compliance_templates` + `governance_template_items` tables, `/api/governance/templates`). But it only parameterizes **annual compliance checklists** (due-month/due-day reminders with statute citations) and is seeded for **only 3 states (CT, FL, CA)**. It does **not** parameterize the rules that drive other features — notice windows (K3), fine caps (R1), reserve cadence/funding minimums (C1/E4), election proxy/secret-ballot rules (V2), or revenue-tier report selection (E3/F7). Adding a *checklist* for a new state is data entry; making the *platform behave correctly* for a new state is still code. **Net: a partial E1 — a compliance-reminder engine, not a compliance-behavior engine.**
- **F1/F2/F3 — the make-or-break trio is split.** **F3 (dues collection) is Working-grade architecture, pending live proof**: Stripe Connect Standard with **direct charges to the connected account** + application fee — money routes bank-to-bank, the HOA owns its own Stripe dashboard, YCM holds only the platform key (`server/services/stripe-connect.ts`, `server/services/payment-service.ts:570-580`). **Compliance posture is correct.** **F2 (reconciliation) is Live→Working**: a real Plaid feed + a 42 KB weighted auto-matcher with descriptor aliasing and owner-suggestion matching (`server/services/reconciliation/auto-matcher.ts`, `server/services/bank-feed-sync.ts`), plus a month-close/lock workflow (`reconciliation_periods`). **F1 (fund accounting) is the weak leg**: per-unit subledgers exist (`owner_ledger_entries`) but there is **no operating-vs-reserve fund segregation** — the code literally returns `reserveBalance: 0, // placeholder — no reserve balance table` (`server/routes.ts:17492`, `:17313`). No double-entry GL.
- **Money never flows through YCM's own accounts — confirmed clean.** Stripe direct-charge + Plaid aggregation route funds bank-to-bank; no commingling finding.
- **The whole compliance/reserve layer is Absent or near-Absent.** No reserve study, no SIRS, no milestone-inspection tracking (C1/C2), no violations/ARC engine (R1), no statutory notice-timeline enforcement (K3), no e-signature (D2), no physical mail (K2), no 1099/tax (F6), no revenue-aware reporting (F7), no estoppel/resale or state-filing generators (E7). This is expected on a first audit and is exactly the roadmap.
- **Maturity verdict: MVP-baseline, in an active production-hardening push for one real 18-unit HOA (Cherry Hill Court).** Open Issues #204/#222 ("verify end-to-end money loop on Cherry Hill real data", "confirm Stripe Connect live + CHC connected account") show the live money loop is being *proven now*, not yet proven. The financial-ops core + directory + comms + docs + voting + work-orders are real and broad; the 50-state compliance layer that the target state demands is largely unbuilt.

---

## 2. Capability scorecard

State-weight: Absent 0 / Designed 1 / Live 2 / Working 3. Score = weight × (Cov + Sys).

| ID | Capability | State | Cov | Sys | Score | Evidence | Gap to "Working" |
|---|---|---|---|---|---|---|---|
| **F1** | Fund accounting GL (operating vs **reserve**, per-unit subledgers, cash+accrual) | Live | 1 | 1 | 4 | `owner_ledger_entries` (per-unit subledger, real); `financial_accounts` (no fund-type col); `routes.ts:17492` `reserveBalance:0 // placeholder` | Add fund dimension (operating/reserve) to accounts+ledger; reserve balance store; double-entry GL; accrual support |
| **F2** | Bank feeds & auto-reconciliation | Live | 2 | 2 | 8 | `reconciliation/auto-matcher.ts` (42KB, weighted scoring); `bank-feed-sync.ts` (advisory-locked pump); `plaid-reconciliation.ts`; `reconciliation_periods` (month-close) | Plaid still defaults sandbox (`plaid-provider.ts:37`); prove >95% auto-match on real CHC data (Issue #204); no community-bank direct API |
| **F3** | Dues/assessment collection (ACH+card, autopay, recurring invoicing) | Live | 2 | 2 | 8 | Stripe Connect direct charges `payment-service.ts:570-580`; `autopay_enrollments`/`autopay_runs`; `recurring_charge_schedules`; `/api/portal/payments` | Confirm live keys on CHC connected acct (Issue #222); end-to-end live-money proof (Issue #204); no paper-check lockbox |
| **F4** | AP / vendor payments (invoice capture, GL coding, approval routing, 1099) | Designed | 1 | 0 | 1 | `vendor_invoices` (vendor/amount/status only); `/api/financial/invoices`; **no** GL-coding, approval-routing-on-invoice, or 1099 fields | Build invoice→GL coding, approval routing, vendor ACH pay rail, 1099 tracking |
| **F5** | Budgeting & reserve-contribution accounting | Live | 2 | 1 | 6 | `budgets`/`budget_versions`(draft→ratified)/`budget_lines`; `/api/financial/budgets`; reserve-contribution *projection* `storage.ts:16653` | Tie to real reserve-study data (C1 absent); budget-vs-actual surfacing |
| **F6** | Tax / compliance filing (1099, 1120-H) | Absent | 0 | 0 | 0 | No 1099/1120/IRS/e-file code anywhere | Build 1099 generation + IRS e-file path |
| **F7** | Financial reporting (balance sheet, P&L, AR aging, board packets) — revenue-aware | Live | 1 | 0 | 2 | P&L `routes.ts:6438`, AR-aging `:6520`, board-summary `:6758`, board packages tables | **Not revenue-aware** — no compiled/reviewed/audited auto-select per state threshold (E3); no balance sheet |
| **M1** | Resident system-of-record (owner/tenant, multi-owner, delinquency/violation status) | Working | 3 | 2 | 15 | `persons`/`ownerships`/`occupancies`/`person_contact_points`/`board_roles`; owner-vs-tenant via occupancies; RBAC | Violation-status feed absent (R1 absent); otherwise complete |
| **K1** | Email/SMS/voice, mass notification, alerts, newsletters | Live | 2 | 2 | 8 | Twilio SMS `sms-provider.ts`; web-push VAPID `push-provider.ts`; email provider + `email_logs`/`email_events`; `communication_history`; `community_announcements` | SendGrid-class scale email + deliverability (Issue #215/#221 in progress); voice channel not built |
| **K2** | Physical mail (statutory mailed notices/ballots/statements) | Absent | 0 | 0 | 0 | No Lob / postal / certified-mail integration | Integrate Lob-class mail API |
| **K3** | Statutory notice-timeline enforcement (14/21/30-day by state) | Absent | 0 | 0 | 0 | "14-day" appears only as hardcoded ad-hoc task/alert thresholds (`routes.ts:1607`), not a per-state notice engine | Build per-state notice-window parameterization driving K1/K2 |
| **D1** | Doc repository (governing docs, minutes, budgets; versioning, retention) | Live | 2 | 2 | 8 | `documents`(versionNumber/isCurrentVersion), `document_versions`(unique-per-doc), `document_tags`; object storage; `/api/documents` | No formal retention-schedule enforcement; otherwise strong |
| **D2** | E-signature (DocuSign/Adobe Sign) | Absent | 0 | 0 | 0 | No DocuSign/Adobe/esign code (all "sign" hits are webhook signature verification) | Integrate ESIGN/UETA e-sign provider |
| **D3** | Public document website (state unit-count threshold) | Designed | 1 | 1 | 2 | Public portal-visible docs `routes.ts:18221`; **not** the statutory public-website mandate w/ threshold logic | Build state-threshold-driven public website module |
| **V1** | Board/owner elections, proxy, e-voting, quorum | Working | 3 | 2 | 15 | `elections`/`election_ballot_tokens`/`election_ballot_casts`/`election_proxy_designations`+`_documents`; secret-ballot flag, quorum %, certification; `election-scheduler.ts` auto-close; `/api/portal/elections` | No external e-vote provider/video; rules set manually not by state (V2) |
| **V2** | Configurable election engine (per-state ballot/notice/proxy rules) | Designed | 1 | 0 | 1 | `is_secret_ballot`/`quorum_percent` are **manual per-election fields**, not state-driven; no no-proxy/inspector enforcement | Drive election rules from E1 per-state config |
| **W1** | Work-order mgmt (intake, dispatch, recurring, capital, field inspection) | Live | 2 | 1 | 6 | `maintenance_requests`→`convert-to-work-order`→`work_orders`(vendor/cost/status); `inspection_records`; `maintenance_schedule_templates`/`_instances`(recurring); WO photos `routes.ts:11235`; vendor portal | No offline/mobile field client; no capital-project module; WO→AP link exists but F4 thin |
| **R1** | Violations/ARC (enforcement, intake/approval, fine schedules, hearings, notices) | Absent | 0 | 0 | 0 | No violation/ARC/covenant/fine-schedule/hearing code in routes or schema | Build full violations+ARC workflow, rules-configurable per state |
| **C1** | Reserve study (component inventory, useful-life, % funded, 30-yr plan, fund segregation) | Absent | 0 | 0 | 0 | No reserve-study data model; only budget-derived contribution *projection* `storage.ts:16653`; `reserveBalance:0` placeholder | Build component inventory, %-funded, funding-plan, reserve-fund store (depends F1) |
| **C2** | SIRS + structural/milestone-inspection deadline tracking | Absent | 0 | 0 | 0 | No SIRS/milestone/structural-inspection code | Build SIRS module + inspection-deadline engine (post-Surfside) |
| **B1** | QuickBooks/Xero/Intacct sync, banking APIs, tax, 1099, AP | Designed | 1 | 0 | 1 | "QuickBooks Online Integration" in `ftph-feature-tree.ts:658` as `defaultStatus:"inactive"`; Plaid is the only live rail | Build accounting-sync connectors |
| **P1** | SOC 2 (Type II) posture | Designed | 1 | 0 | 1 | `go-live-checks.ts`, `go_live_gate_attestations`, consent/audit masking; no SOC2 attestation | Formal SOC 2 program |
| **P2** | PCI DSS posture (or processor offload) | Working | 2 | 3 | 6 | Full offload — Stripe Checkout/Connect; no card data touches YCM (`payment-service.ts`) | Processor-offload posture satisfies PCI scope minimization; document SAQ-A |
| **P3** | Multi-region hosting / availability | Designed | 1 | 1 | 2 | Fly + Neon migration in progress (Issue #224); observability (Sentry/GA4) being wired (#208/#223) | Confirm multi-region; uptime monitoring (#209) |
| **P4** | RBAC across modules | Working | 3 | 2 | 15 | `admin_user_role` enum (6 roles) enforced via `requireAdminRole` on every route; portal/owner/vendor roles; `permission_envelopes`, `admin_association_scopes` | Board-vs-manager financial-mutation audit in progress (#214) |
| **P5** | Audit log / immutable financial trail | Live | 2 | 1 | 6 | `audit_logs`(actor/action/entity), `auth_events`, `payment_event_transitions`, `permission_change_logs` | Not cryptographically immutable (no hash chain); broaden financial-mutation coverage |
| **E1** | Data-driven per-state rules layer (state = config, not code) | Live | 1 | 1 | 4 | `governance-state-template-library.ts` (CT/FL/CA), `governance_compliance_templates`(versioned, publication-status, legal-review), `governance_template_items`; `/api/governance/templates` | Only drives annual checklists; does NOT parameterize notice/fine/reserve/election/report rules; only 3 states |
| **E2** | Versioned compliance rules DB + legal-review workflow + "verify w/ counsel" | Live | 2 | 1 | 6 | `governance_compliance_templates`: `versionNumber`, `publicationStatus`(draft→published), `lastVerifiedAt`, `nextReviewDueAt`, `reviewNotes`, source citations | Add in-product "verify with counsel" disclaimer; broaden beyond checklists |
| **E3** | Revenue-aware reporting (compiled/reviewed/audited per threshold) | Absent | 0 | 0 | 0 | No revenue-tier logic in F7 reports | Build revenue-tier→report-type selector per state |
| **E4** | Reserve cadence + funding-minimum parameterization | Absent | 0 | 0 | 0 | No reserve-cadence/funding-minimum config (C1 absent) | Parameterize 3/5/6-yr cycles + %-minimums |
| **E5** | Notice-timeline parameterization per state | Absent | 0 | 0 | 0 | See K3 — hardcoded thresholds only | Parameterize notice windows per state |
| **E6** | Election-rule parameterization (secret ballot, inspector, no-proxy, e-vote consent) | Absent | 0 | 0 | 0 | See V2 — manual per-election only | Parameterize election rules per state |
| **E7** | State filing/artifact generators (NV 609, CA §5570, estoppel/resale) | Absent | 0 | 0 | 0 | No estoppel/resale/609/§5570 generators | Build per-cluster artifact generators |

---

## 3. Underlying-systems readiness

| Rail | Needed by | Status | Evidence |
|---|---|---|---|
| Plaid (bank aggregation) | F1, F2 | **sandbox** (production-capable, env-gated) | `bank-feed/plaid-provider.ts:37` defaults `PLAID_ENV=sandbox`; production path wired |
| Stripe (ACH/card processing) | F3 | **one-real (test→live pending)** | `stripe-connect.ts:304` detects `sk_live_`/`sk_test_`; CHC live-key confirm open (Issue #222) |
| Community-association bank direct API (AAB/Pacific Premier/CIT) | F2 | **none** | No direct bank API; Plaid only |
| Lockbox (paper checks) | F3 | **none** | No lockbox integration |
| AvidXchange-class AP automation | F4 | **none** | `vendor_invoices` is record-only |
| IRS e-file (1099/1120-H) | F6 | **none** | No tax rail |
| Twilio (SMS/voice) | K1 | **one-real (SMS) / none (voice)** | `sms-provider.ts` real Twilio REST + sim fallback; no voice |
| SendGrid-class email | K1 | **stub→one-real (in progress)** | email provider + logs; deliverability setup open (Issue #221/#215) |
| Lob (physical mail) | K2 | **none** | No mail rail |
| DocuSign/Adobe Sign | D2 | **none** | No e-sign rail |
| E-voting provider (ElectionBuddy/SBS) | V1 | **none (native built instead)** | Native ballot system in-platform; no external provider/video |
| Reserve-study data feed | C1/C2 | **none** | No reserve module to feed |
| QuickBooks/Xero/Intacct | B1 | **none (designed)** | `ftph-feature-tree.ts:658` inactive |
| Anthropic Claude (RAG assistant) | (extra) | **one-real** | `ai-assistant/llm-adapter.ts` Claude 3.5 Sonnet + mock fallback; Voyage/OpenAI embeddings |
| pgvector (doc embeddings) | (extra) | **one-real** | migration `0034_pgvector_extension`, `0035_document_embeddings`, `document_embeddings` |
| Sentry / GA4 (observability) | P3 | **stub (wiring now)** | Issues #208/#223 open |

---

## 4. Cluster-readiness verdict

| Cluster | Ready? | Blocking gaps (IDs) |
|---|---|---|
| **B — Minimal baseline** (TX, AZ, GA, NC, SC + ~25) | **Live** (serviceable today for a single managed HOA; not multi-tenant-hardened across the cluster) | Close the live-money loop (F2/F3 → Working, Issues #204/#222); **R1 violations/ARC is Absent** and most baseline states expect covenant enforcement; K3 notice-config to parameterize per-state notice/fine rules. F1 fund segregation needed for credible board financials. |
| **A — UCIOA 5-yr reserve** (DE, CT, NV, VA, WA, CO, MD) | **Absent** | **C1 reserve module (Absent)** is the hard blocker; E4 cadence/funding-min config (Absent); budget-disclosure generator (Absent); V2 election-rule config (Designed); E7 NV Form 609 (Absent). Note: CT/CA governance *checklists* already seeded (E1) — a head start, not the feature set. |
| **C — Structural-integrity condo** (FL, NJ, +DE/New Castle, CA SB 326) | **Absent** | **C2 SIRS + milestone-inspection tracking (Absent)**; non-waivable reserve-funding logic (depends C1/F1, Absent). |
| **D — Prescriptive governance** (CA Davis-Stirling, FL Ch.718/720) | **Absent** | E7 estoppel/resale + §5570 generators (Absent); V2 prescriptive election engine (Designed→needs no-proxy/inspector); R1 fine-cap logic (Absent); E3 revenue-tiered audit (Absent); D3 website mandate (Designed). FL/CA governance checklists seeded (E1) but the prescriptive *behavior* is unbuilt. |

**Bottom line:** the platform can credibly run **one Cluster-B HOA today** (its current CHC target) once the live-money loop is proven. It cannot yet *claim* any cluster as a repeatable multi-state product, because the cluster-A gate (C1 reserve module) and the universal baseline gate (R1 violations) are Absent.

---

## 5. Ranked gap list (worst-impact-first)

1. **F1 fund segregation / reserve-aware GL — Absent.** *Why:* boards and every reserve-mandate state need operating-vs-reserve separation; the code admits `reserveBalance:0` placeholder. Gates Cluster A and credible board financials everywhere. *Size:* L. *Deps:* none (foundational — C1/E4/F5 all depend on it).
2. **C1 reserve-study module — Absent.** *Why:* the single most state-differentiated feature; the entire Cluster-A gate. *Gates:* A (and C2/D downstream). *Size:* L. *Deps:* F1.
3. **R1 violations / ARC engine — Absent.** *Why:* baseline expectation in nearly every state (covenant enforcement, ARC, fines, hearings); Absent across the whole codebase. *Gates:* B (credibility), D (fine-cap logic). *Size:* L. *Deps:* E1 (for per-state due-process/fine-cap config).
4. **Close the F2/F3 live-money loop to Working — Live, unproven.** *Why:* per the assignment, if reconciliation isn't Working on >95% and dues collection isn't Working end-to-end, the platform is pre-MVP regardless of feature count. Architecture is sound; live proof is open (Issues #204, #222). *Gates:* B. *Size:* M. *Deps:* Stripe live keys, real CHC data.
5. **E1 generalization — Live (checklist-only).** *Why:* today state=config only for annual checklists; to be a 50-state product the same engine must parameterize notice (E5), fine (R1), reserve cadence (E4), election (E6), and report-tier (E3) rules. Without it, every new compliance behavior is a code change → caps the platform at one cluster. *Gates:* A/C/D scalability. *Size:* L. *Deps:* feeds R1/K3/C1/V2/F7.
6. **K3 statutory notice-timeline enforcement — Absent.** *Why:* statutory notice windows are compliance-critical and currently hardcoded ad-hoc. *Gates:* A/B/D. *Size:* M. *Deps:* E1, K2.
7. **F7 revenue-aware reporting (E3) — Absent.** *Why:* FL/CA tie report type (compiled/reviewed/audited) to revenue; also no balance sheet. *Gates:* D. *Size:* M. *Deps:* F1.
8. **C2 SIRS + milestone-inspection tracking — Absent.** *Why:* the entire Cluster-C gate (post-Surfside). *Gates:* C. *Size:* L. *Deps:* C1, E1.
9. **F4 AP automation (GL coding, approval routing, 1099) — Designed.** *Why:* `vendor_invoices` is record-only; no payment rail or 1099. *Gates:* operational completeness. *Size:* M. *Deps:* F1 (GL coding).
10. **E7 state-filing generators (NV 609, CA §5570, estoppel/resale) — Absent.** *Why:* required per-cluster artifacts. *Gates:* A (NV), D (CA/FL). *Size:* M each. *Deps:* E1, F1, C1.
11. **D2 e-signature & K2 physical mail — Absent.** *Why:* statutory mailed notices/ballots (K2) and signed documents (D2) are recurring compliance needs. *Gates:* A/C/D. *Size:* M (integrations). *Deps:* E1 (mail triggers).
12. **F6 tax (1099/1120-H), B1 accounting sync — Absent/Designed.** *Why:* operational completeness; lower compliance urgency than the above. *Size:* M. *Deps:* F1.

---

## 6. Top-N recommended next moves

The smallest set that moves the most cluster-readiness:

1. **Prove the F2/F3 live-money loop end-to-end on Cherry Hill (Cluster B unlock).** *Benchmark:* F2 auto-matcher Working on **>95% of real CHC transactions** with Plaid in production env (`PLAID_ENV=production`), and a real dues payment completing through the live Stripe connected account (closes Issues #204, #222). This converts the platform's current target HOA from "Live" to "Working" and validates the spine before any compliance build.
2. **Add the fund dimension to the GL (F1) — operating vs reserve.** *Benchmark:* every `financial_account` + `owner_ledger_entry` carries a fund (operating/reserve); the dashboard reserve-balance placeholder (`routes.ts:17492`) returns a real segregated balance. This is the foundational unlock for C1/E4/F5/F7 and removes the single most board-visible gap.
3. **Build the reserve-study module (C1) on top of F1 (Cluster A unlock).** *Benchmark:* component inventory + %-funded + 30-yr funding plan producing a compliant **budget-disclosure summary for ≥3 Cluster-A states** (DE/CT/NV) — the assignment's stated Phase-1 benchmark.
4. **Build the violations/ARC engine (R1), rules-configurable via E1 (Cluster B credibility).** *Benchmark:* a covenant violation flows intake→notice→hearing→fine with per-state due-process/fine-cap pulled from `governance_compliance_templates`-style config, not code.
5. **Generalize E1 from checklist-config to behavior-config, starting with notice windows (K3/E5).** *Benchmark:* adding a new state's 14/21/30-day notice rule is a data row that actually changes when the system sends/blocks a notice — proving "state = config, not code" beyond reminders.

---

## 7. Unmapped / extra capabilities (appendix — latent value)

Strong assets not in the §3/§4 rubric, several matching the YCMGap white-space thesis:

- **RAG-grounded AI assistant** — owner-portal Q&A grounded in governing docs via pgvector + Claude 3.5 Sonnet (`server/services/ai-assistant/`, `server/services/rag/`, `document_embeddings`, `ai_assistant_interactions`, SSE streaming, feature-flagged). Matches the "governing-doc Q&A" table-stakes feature; real, not mock.
- **AI document ingestion / extraction pipeline** — `ai_ingestion_jobs`/`ai_extracted_records`/`ai_ingestion_exceptions`/`association_ingestion_correction_memory`/`clause_records`/`suggested_links` + `/api/ai/ingestion` (27 endpoints). Extracts structured records + governing-doc clauses from uploaded files with a correction-memory loop. Significant latent value.
- **Dual-control financial approvals** — `financial_approvals` (`requiredApprovers` default 2) wired at `/api/financial/approvals`. Directly matches the YCMGap #1 white space ("enforced dual-control disbursements / fraud controls") — partially built.
- **Insurance policy tracking + expiry alerts** — `association_insurance_policies` (carrier/premium/coverage/expiration) + 30-day expiry alerts (`routes.ts:2114`, `9048`). Matches the YCMGap #2 "insurance crisis" white space — a head start.
- **Pressing-items / role-lensed scanner** — `pressing_items` + `server/services/pressing-items/` surfaces prioritized action items per role (board fiduciary-dashboard direction).
- **Collections handoff workflow** — `collections_handoffs` (referred→active→settled→judgment) — delinquency-to-attorney lifecycle.
- **Vendor portal** — `vendor_portal_credentials`/`vendor_work_order_activity` + `/api/vendor-portal/*` — vendors self-service work orders.
- **Hub/community map system** — `hub_page_configs`/`hub_map_layers`/`hub_map_nodes`/`hub_map_issues` + `/api/hub/*` — configurable community info/map surface.
- **Admin roadmap / executive-update / analysis-versioning system** — `admin_roadmap_*`, `admin_executive_*`, `admin_analysis_*` — internal PM/ops tooling (not an HOA-facing capability; possible scope creep but useful).
- **Amenity booking** — `amenities`/`amenity_reservations`/`amenity_blocks` + per-association toggle — matches resident-experience white space.

## 8. Documentation gaps (appendix — exists but undiscovered)

Capabilities that exist in code but a feature-checklist reviewer would likely miss (classify as documentation, not feature, gaps):

- **Reserve-contribution *projection*** (`storage.ts:16653`, `currentReserveBalance`/`projectedEndingBalance`) exists inside the budget engine — easy to mistake for "no reserve handling at all." It is a projection, **not** a reserve-study module (C1 still Absent), but it is partial latent value toward F5/C1.
- **Stripe payout → owner-breakdown reconciliation** (`stripe-reconciliation.ts`, `stripe_payouts`/`stripe_payout_items`) — a sophisticated payout-to-HOA-books reconciliation most reviewers would miss behind "Stripe integration."
- **Bank descriptor-alias learning** (`bank_descriptor_aliases`, `auto-matcher.ts:160-254`) — the reconciler *learns* payor-name→owner mappings over time; a non-obvious depth feature.
- **Month-close / period-lock workflow** (`reconciliation_periods` open→closed→locked) — the treasurer month-close (Issue #220) is partly already in the schema.
- **E1 governance engine is more capable than its seed suggests** — the `governance_compliance_templates` schema supports versioning, publication-status, legal-review, source-citation, and per-association overrides (`compliance_alert_overrides`); it is seeded for only 3 states but the *engine* is real. The gap is breadth + scope (checklists only), not absence.
- **Go-live attestation gate** (`go_live_gate_attestations`, `server/services/go-live-checks.ts`) — a structured production-readiness gate exists; relevant to P1/P3 posture.

---

*Method notes: ratings taken from schema (`shared/schema.ts`, 165 tables), migrations (42), route registration (`server/routes.ts`, 615 endpoints), services, and 38 server test files — not README/marketing. State-law specifics in §4.3 of the assignment were used only as a checklist of what to verify; no state's current rule is asserted as settled fact here (verify with counsel before the platform relies on any of them). The live-money loop (F2/F3) is rated **Live** not **Working** because open Issues #204/#222 show it is being proven on real data now, not yet proven — Plaid still defaults to sandbox and the CHC Stripe live key is unconfirmed.*
