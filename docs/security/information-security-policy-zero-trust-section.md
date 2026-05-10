# Information Security Policy — Zero Trust Architecture Section

**Purpose:** Verbatim text to insert into the canonical Information Security Policy document (currently DB-backed per `docs/specs/security-compliance-ops-build-2026-05-10.md`). The canonical policy is owner-maintained outside this repo (Notion / Drive / DB); this file is the section-extract authored per Issue #388 §1.4 to be pasted into the canonical document during the next policy revision.

---

## Section to insert

Place after the existing "Access Control" section. Section header:

### X. Zero Trust Architecture

YCM operates a **zero trust access architecture**. No request — internal or external — is implicitly trusted based on network location, prior authentication, or session age. Every request is verified independently, server-side, against authoritative state.

#### Principles

- **Never trust, always verify.** Every API call resolves the caller's identity and authorization scope from the database on every request. Client-supplied claims (cookies, headers, request bodies) are never trusted as authority.
- **Authentication is not authorization.** A valid session proves only *who* you are. *What you can do* is checked per-resource per-request against the database.
- **Fail closed.** When scope cannot be proven from authoritative state, the request is denied. Absence of explicit allow is a deny.
- **Continuous verification.** Sessions have inactivity timeout (7 days, environment-configurable) and absolute timeout (30 days). Anomalous access events (login from a new IP) generate alerts even within an active session.
- **Network is not a trust boundary.** YCM does not rely on private-network trust. All requests pass through public internet and authenticate identically. Cookies are HTTPS-only (`secure`), JavaScript-inaccessible (`httpOnly`), and CSRF-bounded (`sameSite: lax`).

#### Controls

The principles above are enforced in code by:

1. **`requireAdmin`** middleware on every admin API route — verifies authenticated session against database state on each request.
2. **`assertAssociationScope`** check on every association-scoped resource handler — fails closed on empty/missing scope.
3. **`requireAdminRole`** factory — re-checks caller's role against the database authority per request.
4. **OAuth-only authentication** — no passwords stored. Google OAuth 2.0 is the only credential mechanism; structural mitigation against password-spray and credential-reuse attacks.
5. **Server-side session storage** — sessions live in Postgres (`user_sessions`); cookie carries only an opaque session ID. Role/scope changes take effect on the next request with no token TTL gap.
6. **Inactivity + absolute session timeouts** — `SESSION_MAX_AGE_MS` (default 7 days) + `SESSION_ABSOLUTE_MAX_AGE_MS` (30 days). On expiry: session destroyed, cookie cleared, client redirected to login.
7. **Authentication event logging** — every successful auth event writes a row to `auth_events` (user, IP, user-agent, timestamp, outcome). Used for forensic reconstruction and anomaly detection.
8. **New-IP login alerts** — on login from an IP not seen in the last 30 days for a given user, an email alert fires to the user's account email.

#### Reference

Full architecture documentation: `docs/security/zero-trust-architecture.md` in the YCM repo. That document is the technical evidence for the Plaid attestation *"Implementation of a zero trust access architecture"* (Nov 11 2026 deadline).

---

**Why this section is in a separate doc:** the canonical Information Security Policy is currently maintained outside the YCM repo (per `docs/specs/security-compliance-ops-build-2026-05-10.md`, the policy is intended to live in a DB-backed `policies` table or — pre-build — in Notion/Drive). This extract is the section text to paste during the next canonical-policy revision; the YCM repo carries the verbatim copy so the policy revision tracks against version control.

When the canonical policy is migrated to a `policies` table per the security-compliance-ops-build spec, this section extract becomes one of the seed entries.
