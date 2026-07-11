# Tenant Sending Alias — Scope / Design Spec

**Status:** SCOPED → BUILT → VALIDATED (this spec is the definition of done).
**Author:** feature dispatch (William: "scope it out FIRST so that it works perfectly").
**Goal:** Let each HOA (association) and PM (management company) send owner-facing email
(dues notices, announcements, receipts, OTPs) **FROM their own recognizable alias** on the
verified `yourcondomanager.org` domain, instead of the generic system `noreply@` address —
while making it **structurally impossible** for one tenant to send as another tenant's alias.

---

## 0. Context (what already exists — do NOT fork)

- Email runs through **Resend**. `yourcondomanager.org` is being DKIM/SPF/DMARC-verified in
  Resend right now. **Once verified, ANY `<anything>@yourcondomanager.org` from-address can send.**
- Send paths (read first):
  - `server/email/send.ts` — the typed `sendEmail()` wrapper (templated; resolves From from `EMAIL_FROM`).
  - `server/email/resend-client.ts` — raw Resend REST client (`from`, `replyTo`, `tags`, `headers`).
  - `server/email-provider.ts::sendPlatformEmail()` — the **legacy/primary owner-facing path**
    (used by 17 call sites in `server/routes.ts`: announcements, election ballots, receipts, OTP…).
    Today its From is the GLOBAL `EMAIL_FROM_ADDRESS`/`EMAIL_FROM_NAME`. It accepts `associationId`.
- Tenant model:
  - `associations` (HOAs) — **no slug column today** (we add one).
  - There is **no first-class management-company table**. A PM is represented per-association via
    `tenant_configs.managementType = 'pm-managed'` + `tenant_configs.managementCompanyName` (a string).
  - `tenant_configs.supportEmail` already exists = the tenant's real contact inbox (our Reply-To source).
- Tenant isolation primitive (load-bearing for security): `requireAdmin` → `req.adminScopedAssociationIds`
  + `assertAssociationScope(req, associationId)` (fail-closed; platform-admin bypasses by design).
- Admin settings UI for a tenant lives at `client/src/pages/platform-controls.tsx`
  (`GET/POST /api/platform/tenant-config`), where `portalName` + `supportEmail` are already edited.
- DNS is Cloudflare; apex SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, MX → CF Email Routing.

---

## 1. Alias scheme

### 1a. Default (ships now, no per-tenant DNS): per-tenant alias under the verified domain

- HOA alias: `<association-slug>@yourcondomanager.org`
- PM alias: `<association-slug>@yourcondomanager.org` as well — **the alias is per-ASSOCIATION**, not
  per-PM-company. Rationale: a PM manages MANY associations; owners recognize **their HOA's** name, and
  per-association keeps the ownership binding 1:1 with the existing tenant-isolation primitive
  (`associationId`). A PM-company-wide alias would require a real PM table + a cross-association ownership
  model we do not have — out of scope for v1 (see 1c).
- **Display name** carries the human-recognizable identity: `"Cherry Hill Court" <cherryhill@yourcondomanager.org>`.
  For a PM-managed HOA, the display name MAY be `"Cherry Hill Court (managed by Acme Property Mgmt)"`
  (derived from `managementCompanyName`) — a label only; the address is still the per-association alias.

**Slug rules** (uniqueness + safety):
- Lowercased; `[a-z0-9-]` only; derived from association name; collapse runs of `-`; trim leading/trailing `-`.
- Length 3–40. Must NOT be one of the **reserved system local-parts**:
  `noreply, no-reply, support, contact, privacy, legal, security, sales, admin, info, postmaster,
  abuse, hostmaster, webmaster, mailer-daemon, bounce, bounces, dmarc, www`.
- **Globally unique** across all associations (a DB unique index on `associations.email_slug`).
- On collision, suffix a short stable disambiguator (e.g. `-2`, or first 4 of the association id).
- Auto-generated at first use if unset; an admin MAY override to any valid, available, non-reserved slug.

### 1b. From-address composition

`From = "<DisplayName>" <<slug>@yourcondomanager.org>`
`Reply-To = <tenant support inbox>` (see §3).

### 1c. Advanced (gated behind a flag, NOT enabled): tenant's OWN domain

- A tenant supplies `custom_send_domain` (e.g. `mail.cherryhillhoa.com`).
- Requires **per-domain Resend verification** (separate DKIM/SPF/DMARC records the tenant adds to
  THEIR DNS) + a Resend "domain" object per tenant. Until that domain shows `verified` in Resend,
  sends fall back to the default alias.
- Shipped as **design + a feature flag** `TENANT_CUSTOM_DOMAIN_ENABLED` (default OFF) + schema columns,
  but the verification workflow + Resend domain-provisioning are **NOT built in v1** (explicitly deferred).

---

## 2. Send path (integrate, do NOT fork the mailer)

- Add a single resolver `resolveTenantSender(associationId)` →
  `{ fromAddress, fromName, replyTo, source }`.
  - Reads the association's alias row; composes From + display name; resolves Reply-To from
    `tenant_configs.supportEmail` (fallback `EMAIL_REPLY_TO`).
  - If the tenant has no alias configured / association is null → returns the **global default**
    (`EMAIL_FROM_ADDRESS` / `EMAIL_FROM`) so existing behavior is unchanged (reversible).
  - Gated by feature flag `TENANT_SENDING_ALIAS_ENABLED` (default OFF). Flag OFF → always global default.
- `sendPlatformEmail()` (legacy path): when `payload.associationId` is set AND the flag is ON, override
  `fromHeader` + `replyTo` from the resolver. Otherwise unchanged.
- `sendEmail()` (typed wrapper): accept an optional `associationId`; same resolver override on the Resend path.
- **The resolver NEVER trusts a client-supplied from-address.** Callers pass `associationId` only; the
  server derives the alias. (This is the anti-spoofing core — see §4.)

---

## 3. Reply handling

**Recommended (simplest correct option): Reply-To header → the tenant's real inbox.**
- `Reply-To = tenant_configs.supportEmail`. Owner hits "reply" → it goes straight to the HOA/PM inbox.
  No Cloudflare Email Routing rule needed; works the instant the domain is verified.
- The alias itself does NOT need to receive mail for the owner-facing flow to work. (If a tenant wants
  the alias address itself to forward, that's the optional CF Email-Routing forward in §6 — additive,
  not required for "works perfectly".)

---

## 4. Security / anti-spoofing (CRITICAL — the load-bearing correctness requirement)

1. **From is server-derived, never client-supplied.** Callers provide `associationId`; the resolver
   produces the alias. There is no API surface that lets a caller set an arbitrary `from`.
2. **Alias↔tenant binding is 1:1 and DB-enforced.** `associations.email_slug` is UNIQUE. The resolver
   looks up the alias BY `associationId`, so a tenant can only ever resolve to ITS OWN alias.
3. **Admin write is scope-gated.** Setting/changing an association's alias goes through
   `assertAssociationScope(req, associationId)` (fail-closed) — a non-platform admin cannot set another
   association's alias. Slug uniqueness + reserved-list enforced server-side at write time.
4. **Reserved local-parts blocked.** No tenant can claim `support@`, `privacy@`, `legal@`, `noreply@`, etc.
   (protects the legal/system aliases — see Phase 1b).
5. **Rate limit.** Per-association outbound send cap (reuse existing email-send infra; the alias does not
   change volume limits). Alias *write* endpoint rate-limited via the standard admin middleware.
6. **Validation at write time:** slug regex, length, reserved-list, global-uniqueness — all server-side;
   a bad slug is rejected with 400 (never silently coerced into another tenant's space).

---

## 5. Admin UI

In `platform-controls.tsx` tenant-config card (where `portalName`/`supportEmail` already live), add:
- **Sending alias** (read-only computed preview `slug@yourcondomanager.org` + an editable slug field with
  availability/validation feedback).
- **Display name** (the friendly "From" name owners see).
- **Reply-to** (defaults to `supportEmail`; editable).
- A "Send test email" affordance (platform-admin) that POSTs to the validated test endpoint.

---

## 6. Optional (additive, not v1-blocking): CF Email Routing forward

If a tenant wants the alias address itself to receive replies (vs. Reply-To), add a CF Email Routing rule
`<slug>@yourcondomanager.org → supportEmail`. Requires the working CF API token. Deferred; Reply-To covers
the requirement without it.

---

## 7. Requirements → Definition of Done (acceptance tests)

| # | Requirement | Acceptance test |
|---|---|---|
| R1 | Per-association alias slug is generated, unique, valid | unit: slug generator + validator (regex, length, reserved-list, collision suffix) — `server/email/tenant-sender.test.ts` |
| R2 | Reserved system local-parts (support/privacy/legal/noreply/…) cannot be claimed by a tenant | unit: validator rejects each reserved local-part |
| R3 | Resolver derives From + display name + Reply-To from `associationId` only | unit: `resolveTenantSender()` returns alias for a configured association; global default for an unconfigured/null one |
| R4 | A tenant CANNOT resolve/send as another tenant's alias | unit: resolver keyed by associationId returns only that association's alias; route test: `assertAssociationScope` rejects cross-tenant write (403) |
| R5 | Flag OFF → behavior identical to today (global From) | unit: resolver returns global default when `TENANT_SENDING_ALIAS_ENABLED` unset |
| R6 | Admin can view/set alias + display name + reply-to, scope-gated | route test: scoped admin sets own alias (200); cross-scope set (403); bad slug (400) |
| R7 | Owner-facing send uses the alias when flag ON + associationId present | unit: `sendPlatformEmail` override path picks resolver From/Reply-To |
| R8 | tsc clean, no new test failures | `npm run check` + `vitest run` for new + adjacent suites |
| R9 (validate) | Deliverability: a real alias send lands at the inbox with correct From + Reply-To | Phase 3: send via deployed app to pocketpm.io@gmail.com; confirm 200 + message id + headers |
| R10 (validate) | Security proven end-to-end: a tenant cannot send as another's alias | Phase 3: test asserting the cross-tenant resolver/scope denial |

---

## 8. Reversibility

- Schema: forward-only additive columns (`email_slug`, `email_display_name`, `email_reply_to_override`,
  `custom_send_domain`, `custom_send_domain_verified`). No destructive DDL.
- Behavior change gated by `TENANT_SENDING_ALIAS_ENABLED` (default OFF) → flag off = exact current behavior.

---

## Phase 1b — Existing legal/system alias verification (LIVE results, 2026-06-30)

Method: live SMTP `RCPT TO` probe against the Cloudflare MX (`route1/2/3.mx.cloudflare.net`),
stable across all three hosts. (The Cloudflare Email Routing API could NOT be queried directly —
the available `cloudflare-api-token` keychain entry returns `Invalid API Token` / is a `cfat_…`
service-token, not a zone API token. Reported as a credential blocker.)

Addresses referenced in the legal pages:
- Privacy Policy (`client/src/pages/privacy-policy.tsx`): `privacy@`, `support@`
- Terms of Service (`client/src/pages/terms-of-service.tsx`): `legal@`, `support@`
- Footer (`client/src/components/site-footer.tsx`): `contact@`

| Alias | Referenced in | Live? (RCPT TO) | Action |
|---|---|---|---|
| `support@yourcondomanager.org` | Privacy + Terms | ✅ 250 OK | none — live |
| `contact@yourcondomanager.org` | Footer | ✅ 250 OK | none — live |
| `privacy@yourcondomanager.org` | **Privacy Policy** | ❌ 550 Address does not exist | **MISSING — FLAG: add CF Email Routing rule** |
| `legal@yourcondomanager.org` | **Terms of Service** | ❌ 550 Address does not exist | **MISSING — FLAG: add CF Email Routing rule** |
| `security@yourcondomanager.org` | security/policy docs | ❌ 550 Address does not exist | MISSING (non-legal) — recommend adding |
| `definitely-not-a-real-alias-zzq9@` (control) | — | ❌ 550 | confirms there is **NO catch-all** — each alias needs an explicit rule |

**FLAG (cannot self-fix — CF API token invalid):** `privacy@` and `legal@` are referenced in the
live Privacy Policy + Terms of Service but are NOT configured in Cloudflare Email Routing, so a user
who emails them per those pages gets a hard bounce. Fix = add CF Email Routing forwarding rules
`privacy@ → ops mailbox` and `legal@ → ops mailbox` (and ideally `security@`). This requires a valid
Cloudflare zone API token (the keychain token is invalid); add the two rules via the CF dashboard or
`POST /zones/<zone>/email/routing/rules` once a working token is available.

Note: the subprocessor/privacy policy docs describe routing as a `*@` catch-all to a single ops
mailbox, but the live probe shows routing is **per-address (no catch-all)** — so the docs' "catch-all"
description is inaccurate AND the two legal aliases were never individually added.

## Phase 3 — Deliverability + security validation (LIVE results, 2026-06-30)

Sent via the deployed app's Resend key (send-only restricted key; never extracted).

| Check | Result |
|---|---|
| Send FROM `Cherry Hill Court <cherryhill@yourcondomanager.org>` → pocketpm.io@gmail.com, with Reply-To | ✅ HTTP 200, message id `90cde46e-e0af-4822-9549-abcbb437e466` — **alias delivers on the verified domain (no per-tenant DNS needed)** |
| Domain verified? | ✅ implied — Resend rejects unverified-domain sends with 403; this send succeeded |
| Spoof guard at provider layer: send FROM `attacker@gmail.com` | ✅ HTTP 403 `gmail.com domain is not verified` — foreign-domain From rejected |
| Security: From is server-derived; tenant cannot resolve another's alias | ✅ unit tests R4 (resolver keyed by associationId) + R2 (reserved-list) + R6 (scope-gated write) pass |
