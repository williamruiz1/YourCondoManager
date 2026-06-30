-- Migration 0049 — Tenant sending alias on tenant_configs
--
-- Lets each HOA (association) / PM-managed tenant send owner-facing email FROM a
-- recognizable per-association alias on the verified yourcondomanager.org domain,
-- e.g. "Cherry Hill Court <cherryhill@yourcondomanager.org>", instead of the
-- generic system noreply@ address. Reply-To points at the tenant's real inbox.
--
-- Anti-spoofing: email_slug is GLOBALLY UNIQUE (partial unique index below), so a
-- tenant's alias resolves to exactly one association. The From address is always
-- SERVER-DERIVED from associationId — never client-supplied — so one tenant can
-- never send as another's alias.
--
-- Behavior is gated by the TENANT_SENDING_ALIAS_ENABLED env flag (default OFF):
-- flag off, or slug null → the global EMAIL_FROM default is used (unchanged).
--
-- Forward-only, additive. No destructive DDL, no data backfill.

ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS email_slug text;
ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS email_display_name text;
ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS email_reply_to_override text;

-- Advanced (design only, flag-gated, NOT live in v1): a tenant's own send domain.
-- Requires per-domain Resend verification before it can be used to send.
ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS custom_send_domain text;
ALTER TABLE tenant_configs ADD COLUMN IF NOT EXISTS custom_send_domain_verified integer NOT NULL DEFAULT 0;

-- Global uniqueness of the alias local-part across ALL tenants. Partial index so
-- unconfigured tenants (email_slug IS NULL) never collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_configs_email_slug_uq
  ON tenant_configs (email_slug)
  WHERE email_slug IS NOT NULL;
