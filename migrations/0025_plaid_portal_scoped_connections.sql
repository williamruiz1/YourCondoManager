-- Adds optional portal-scoped linkage to Plaid bank connections + accounts.
-- A connection with portal_access_id set is owned by an owner via the portal
-- (Use Case 2 — owner Pay Now). NULL portal_access_id = admin/association
-- scope (Use Case 1 — admin connects HOA bank account). association_id is
-- still required on every row for tenant isolation.

ALTER TABLE bank_connections
  ADD COLUMN IF NOT EXISTS portal_access_id varchar
    REFERENCES portal_access(id) ON DELETE SET NULL;

ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS portal_access_id varchar
    REFERENCES portal_access(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bank_connections_portal_access_id_idx
  ON bank_connections(portal_access_id);
CREATE INDEX IF NOT EXISTS bank_accounts_portal_access_id_idx
  ON bank_accounts(portal_access_id);
