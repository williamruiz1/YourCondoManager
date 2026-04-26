# Bulk Communications — Scope Questions (2026-04-26)

**PPM:** ab193305-09ff-46c0-81e7-224ef3a5d19c
**Status:** Awaiting founder input
**Authored:** 2026-04-26 by background research agent

## Context

The "Bulk Communications / Campaign Manager" workitem was previously
attempted on the abandoned `integration/three-features-baseline` branch
and is unrecoverable. Founder explicitly decided that this feature must
have a scope-locking spec session before any agent is dispatched —
otherwise we risk producing ~1500 LoC of the wrong feature.

This doc captures the questions that need founder answers. It is not
the spec. After the session, a follow-up doc (`bulk-communications-spec-...md`)
will translate the answers into acceptance criteria.

---

## What we have today

A surprising amount. The investigation uncovered substantial
single-tenant-aware multi-channel send infrastructure already in place.
The right framing for this feature is **assemble a campaign-shaped
shell on top of existing primitives**, not build from scratch.

### Existing surfaces (Communications zone)

- **`/app/communications`** (`client/src/pages/communications.tsx`,
  ~2,360 LoC) — two-tab page: **Notices** + **Announcements**.
  Notices tab already supports template selection, recipient targeting
  (preview + send), schedule-for-later, require-approval flag, and
  delivery-stat readouts.
- **`/app/communications/inbox`** (`communications-inbox.tsx`) — this
  is the **alerts inbox**, not a comms inbox. Persona-invariant cross-
  association alert triage. Out of scope for bulk-comms work.
- **`/app/board/community-hub`** (`community-hub.tsx`, ~1,370 LoC) —
  the resident-facing community feed (announcements, notices, RSVPs).
  Read surface; bulk-comms feeds it on the announcement side.

### Existing API endpoints (`server/routes.ts`)

| Endpoint | Notes |
|---|---|
| `POST /api/communications/send` | Single-recipient notice send (template + variables). |
| `POST /api/communications/send-targeted` | **Bulk-shaped already.** Accepts `targetType` ∈ `{all-owners, all-tenants, all-occupants, selected-units, individual-owner, individual-tenant, board-members}`, optional `selectedUnitIds`, `selectedUnitAudience`, `messageClass`, `ccOwners`, `templateId`, schedule, approval gate. |
| `GET /api/communications/recipients/preview` | Resolves recipient set before send (count + list). |
| `POST /api/communications/send-sms` | SMS broadcast with TCPA per-send opt-in re-check, 100-per-dispatch cap, 500/24h association daily cap. |
| `POST /api/communications/send-push` | Web push broadcast across active subscriptions. |
| `GET /api/communications/sms-recipient-count` | Eligible-vs-opted-in preview. |
| `GET /api/communications/push-subscriber-count` | Active push subscribers. |
| `GET /api/communications/templates`, `POST`, `PATCH` | Notice template CRUD. |
| `GET /api/communications/sends`, `PATCH /:id/approval` | Sends list + approval workflow. |
| `POST /api/communications/run-scheduled` | Cron-triggered scheduled-notice processor. |
| `PATCH /api/communications/sends/:id/delivery` | Mark delivered / opened / bounced / retry. |
| `GET /api/communications/delivery-stats` | Per-association or per-`campaignKey` aggregate metrics (delivered, opened, bounced, hard/soft, rates). |
| `GET /api/communications/history` | Cross-channel history feed. |
| `POST /api/portal/board/communications/send` | Same primitives, board-portal entrypoint. |
| `GET /api/announcements`, `POST`, `PATCH`, `DELETE` | Community announcements (separate from notices — visibility-scoped, fed to the Hub). |

### Existing schema primitives (`shared/schema.ts`)

- `noticeTemplates` — name, channel, subject/body/header/footer/sig templates, active flag.
- `noticeSends` — per-recipient send record. Has `campaignKey` (text),
  `templateId`, rendered subject/body, status, provider, retries, bounce
  type/reason, opened-at, delivered-at. **`campaignKey` is the only
  thing tying recipients to a campaign — there is no campaign object
  yet.**
- `communicationHistory` — cross-channel (email/sms/push) audit row,
  scoped by `relatedType`/`relatedId`/`associationId`.
- `smsDeliveryLogs` — Twilio receipts.
- `pushSubscriptions` — Web Push endpoints, opt-in, active flag.
- `emailLogs` + `emailEvents` — provider-level email log + open/click
  tracking pixel events.
- `portalAccess.smsOptIn` — TCPA opt-in flag.
- `communityAnnouncements` — hub-feed announcements, visibility-level
  text column.

### Provider layer (`server/email-provider.ts`, ~600 LoC)

Nodemailer-based with: tracking pixel + click-redirect tokens,
retention, retry/backoff, allowed-redirect-domain enforcement,
per-tenant SMTP override, simulated-mode for tests.

### What is NOT here today

- **No `campaigns` table.** `campaignKey` is a free-form string. There
  is no canonical "campaign" object that owns multiple sends, statuses,
  and audit fields.
- **No drip / sequence / cadence model.** Schedule-for-later exists per
  send; multi-step sequences do not.
- **No unsubscribe link / unsubscribe token / DNC list table.** SMS has
  per-send opt-in re-check; email does not have a CAN-SPAM-grade
  unsubscribe footer + suppression list.
- **No physical-mailing-address-of-sender field** wired to email
  templates (CAN-SPAM requirement for commercial messages — note: most
  HOA notices are arguably transactional, but governance-wide ones are
  borderline).
- **No segment-builder UI.** Targeting is driven by hardcoded
  `targetType` enum, not a saved segment / persona group.
- **No A/B test, no preview-as-recipient, no test-send-to-self
  workflow** (informally possible, not surfaced).
- **No clear "campaign manager" page** — the existing Notices tab is
  send-shaped, not campaign-shaped.

---

## Open questions for founder session

### Q1 — Recipient selection

**Question:** What recipient-selection model does a "campaign" need
beyond the existing `targetType` enum?

**Options:**
- **A.** Reuse `targetType` exactly as-is (all-owners / all-tenants /
  all-occupants / selected-units / individual / board-members).
  Campaign is just a wrapper around the existing `send-targeted` call.
- **B.** + saved **named segments** (e.g. "Building A owners",
  "Delinquent autopay residents"). Stored as a query definition, not a
  static list, so they stay current.
- **C.** + **manual roster overrides** on top of A or B (add/remove
  individual recipients before send).
- **D.** Full segment builder: visual filter UI (status, balance,
  unit-attributes, opt-in flags) → saved segment → reusable.

**Recommendation:** A for MVP, B as fast-follow. Real boards almost
never need segment builders; they want "everyone in Building A". D is
where bulk-comms vendors over-engineer.

**Why this matters:** A → ~0 LoC of new selection code.
B → ~150 LoC + a `commsSegments` table.
D → ~600 LoC + UI + tests; almost certainly out of scope for the
small/medium boards YCM serves.

---

### Q2 — Channels

**Question:** Which channels does a campaign send across — and is
multi-channel a single campaign or one campaign per channel?

**Options:**
- **A.** Email only (campaign = bulk email).
- **B.** Email + SMS as separate campaigns (managed in same UI but
  routed to different existing endpoints).
- **C.** Email + SMS + Push as a single multi-channel campaign with
  per-recipient channel preference resolution (e.g. "send SMS if opted
  in, else email").
- **D.** + In-app inbox (a fourth channel — would require a new
  inbox-message persistence model; the current `/inbox` page is the
  alerts inbox, not a comms inbox).

**Recommendation:** B. The endpoints already exist for all three; a
single-channel-per-campaign model keeps delivery-stats coherent and
avoids the rule-engine of "did we already reach this person on a higher-
priority channel?". Push is so opt-in-light that bundling it into B as
"send push as a courtesy alongside email" is fine without making it a
first-class channel.

**Why this matters:** A → reuse `send-targeted` directly.
B → campaign object needs a `channel` enum; per-channel send-paths.
C → channel-resolution rules engine (~200 LoC of business logic +
edge cases) and per-recipient effective-channel tracking on `noticeSends`.
D → new inbox-message table + portal-side surface; ≥400 LoC.

---

### Q3 — Send model (immediate / scheduled / drip)

**Question:** Beyond "send now" and "send at time T" (both supported
today on `noticeSends.scheduledFor`), do we need multi-step or
recurring sends?

**Options:**
- **A.** Immediate + single-scheduled only. Reuse what exists.
- **B.** + **recurring** (e.g. "first of every month" — useful for
  monthly statements / dues reminders).
- **C.** + **drip sequence** (e.g. day 0 / day 7 / day 14 — useful for
  delinquency escalation, AGM reminders).
- **D.** Drip + branching (e.g. "if not opened by day 3, send SMS
  follow-up").

**Recommendation:** A for MVP. The delinquency-escalation and AGM-
reminder use cases are real but they should pull from a different
spec — there's already an escalation engine elsewhere in the codebase
(see "ladder" / late-fee escalation work). Don't bolt drip onto bulk-
comms before clarifying which engine owns it.

**Why this matters:** A → 0 new infra.
B → recurring-schedule cron config (~100 LoC).
C → `campaignSteps` table + sequencer (~300 LoC) + UI.
D → branching graph + condition evaluator (~600 LoC); this is where
"three-features-baseline" probably went off the rails.

---

### Q4 — Templates

**Question:** What's the relationship between a campaign and the
existing `noticeTemplates` library?

**Options:**
- **A.** Campaign references one template (existing `templateId` pointer).
- **B.** + **campaign-local copy** of the template at send time
  (immutable snapshot stored on the campaign / send, so editing the
  template after send doesn't rewrite history). The schema sort of does
  this already — `noticeSends.subjectRendered` / `bodyRendered` capture
  the snapshot. Confirm this is sufficient.
- **C.** Campaign-builder allows ad-hoc subject/body without a saved
  template (already supported on `send-targeted`, where `subject` and
  `body` may be passed inline).
- **D.** + variable preview UX: render template against a sample
  recipient before send.

**Recommendation:** B + C + D. The first two are essentially free —
the schema already supports them. D is genuinely valuable and small
(~80 LoC of frontend, reusing the existing `recipients/preview`
endpoint with a single recipient).

**Why this matters:** Skipping D leads to "I sent the wrong template"
incidents. Confirming B avoids debate later about whether template
edits retroactively rewrite send-history.

---

### Q5 — Tracking + compliance

**Question:** What level of tracking and compliance does a campaign
need to ship with?

**Options:**
- **A.** Reuse existing per-send delivery stats. No unsubscribe link,
  no DNC list, no physical-address footer. (Acceptable for purely
  transactional HOA notices: dues invoices, AGM notices — these are not
  commercial messages under CAN-SPAM.)
- **B.** + **email unsubscribe link + suppression list table** for
  campaign-classified messages. Per-association suppression.
- **C.** + per-recipient **opt-out audit trail** (when, how, which
  campaign), accessible to the recipient via portal.
- **D.** + jurisdictional compliance metadata: physical sender
  address footer required when `messageClass === "general"` (vs.
  operational/financial/governance which are transactional).
  CASL (Canadian Anti-Spam Law) consent-of-record fields if any
  associations are in Canada.

**Recommendation:** B + C + a documented carve-out:
"transactional categories" (operational, financial, governance) skip
the unsubscribe footer; "general" announcements include it. The
existing `messageClass` enum is already plumbed end-to-end. D is the
right end-state but jurisdictional logic is a separate workitem — flag
it but don't build it here.

**Stop-and-surface:** SMS already has TCPA-grade per-send opt-in
re-check, but email has nothing equivalent. If the founder picks A
(skip unsubscribe), the legal posture is "all outbound bulk email is
transactional" — which is plausible for HOA but should be a deliberate
decision, not an oversight. Document it.

**Why this matters:** A → fastest ship, legal risk on borderline-
commercial messages.
B + C → ~250 LoC: `commsSuppressions` table + middleware that filters
recipients on send + a portal page surface (could reuse the existing
`/portal/me/preferences` page if it exists, otherwise add).
D → multi-week effort; out of scope here.

---

### Q6 — Integration with existing primitives

**Question:** Does the campaign object **wrap** existing
`noticeSends` (i.e. `noticeSends.campaignKey` becomes
`noticeSends.campaignId`, plus a new `commsCampaigns` table) — or
does it **fork** to a parallel `campaignSends` table?

**Options:**
- **A.** **Wrap.** Add `commsCampaigns` table; promote `campaignKey` to
  a foreign key. Backfill existing campaign-key strings. All existing
  endpoints continue to work; new `/api/communications/campaigns`
  endpoints sit on top.
- **B.** **Fork.** New `commsCampaigns` + `commsCampaignSends` tables,
  separate from `noticeSends`. Old endpoints keep working unchanged;
  new campaign endpoints don't share history.
- **C.** **No new table at all.** "Campaign" is a virtual aggregate
  computed by `GROUP BY campaign_key` over `noticeSends`. Just add a
  campaign-manager page that reads grouped send history.

**Recommendation:** A — but pace it. Phase 1: build the campaign-
manager UI as a virtual aggregate (option C), so the founder can see
campaigns end-to-end without schema changes. Phase 2: promote to a
real `commsCampaigns` table once we know the actual fields needed.
This is the lowest-risk path and matches founder's "don't build the
wrong thing" framing.

**Why this matters:** A → ~400 LoC + a migration touching one of the
largest send tables in the system. Migration risk is non-trivial.
B → ~600 LoC and immediately diverges history (bad for audit).
C → ~200 LoC, zero migration risk, fastest founder-visible result.

---

## Out-of-scope (don't bring up in founder session)

- Email deliverability infra (DKIM/SPF/DMARC config). Handled by
  `email-provider.ts` + tenant SMTP overrides.
- SMS provider integration. Twilio is wired and feature-gated.
- Push subscription provisioning. Already complete (Wave 12-ish).
- Hub announcements visibility model. Lives on `communityAnnouncements`,
  separate workitem.
- The alerts inbox at `/app/communications/inbox`. Not a comms surface
  despite the URL — it's cross-association alert triage.
- Reply-to / inbound email (`emailThreads`). That's a separate
  bidirectional-comms workitem.
- Per-recipient personalization variables beyond what
  `noticeTemplates.{subject,body}Template` already supports.
- Internationalization of templates. There's an i18n layer for app
  strings; templates are not yet localized.

---

## Suggested architecture sketch (one paragraph, post-decisions)

Once Q1–Q6 are answered, the implementation likely looks like:
**Phase 1 (≤300 LoC, no schema)** — Add a Campaign Manager page at
`/app/communications/campaigns` that reads
`GET /api/communications/sends` grouped by `campaignKey`, joins with
delivery stats, and surfaces a campaign list + per-campaign drill-down.
Add a "New Campaign" wizard that wraps the existing `send-targeted`
flow with template preview (Q4-D), saved drafts, and a confirmation
step. Reuse all existing endpoints. **Phase 2 (≤500 LoC + migration)** —
Promote `campaignKey` to a `commsCampaigns` foreign key (Q6-A);
add named segments table if Q1-B; add suppression list table if Q5-B/C.
**Phase 3 (gated on signal)** — drip sequences, multi-channel
resolution, jurisdictional compliance. Likely a separate spec each.

Conservative LoC for Phase 1 + Phase 2 combined: ~800 LoC across
~12 files (1 migration, 2 new pages, 4 new endpoints, ~5 modified
endpoints, types/tests). This is roughly half the size of the
abandoned attempt — because most of the work is already done and the
spec session's job is to keep it that way.
