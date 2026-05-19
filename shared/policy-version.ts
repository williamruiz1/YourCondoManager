// #342 (WS3) — canonical policy version constant. Bumping this date string
// causes every logged-in user to see the consent modal again on their next
// session (because the (user_id, policy_version) row will be missing). Use
// when Privacy / ToS materially changes; do NOT bump for typo fixes.
//
// Format: ISO date (yyyy-mm-dd). The string is opaque to the schema —
// "policy_version" is `text`, so anything stable works. Date format is the
// convention to keep the audit trail human-readable.

export const CURRENT_POLICY_VERSION = "2026-05-19";
