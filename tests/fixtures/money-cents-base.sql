CREATE TABLE owner_ledger_entries (
  id varchar PRIMARY KEY,
  association_id varchar NOT NULL,
  amount double precision NOT NULL
);

CREATE TABLE payment_webhook_events (
  id varchar PRIMARY KEY,
  association_id varchar NOT NULL,
  amount double precision
);

INSERT INTO owner_ledger_entries (id, association_id, amount) VALUES
  ('l1', 'a1', 1326.18994140625),
  ('l2', 'a1', -330.00),
  ('l3', 'a2', 415.70001220703125);

INSERT INTO payment_webhook_events (id, association_id, amount) VALUES
  ('w1', 'a1', 330.00),
  ('w2', 'a1', NULL);

