ALTER TABLE players ADD COLUMN paypal_verified BOOLEAN;
ALTER TABLE log_entries ADD COLUMN verification_source TEXT CHECK (verification_source IS NULL OR verification_source = 'paypal_csv');
CREATE TABLE paypal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  txn_id VARCHAR(120) NOT NULL,
  occurred_on DATE NOT NULL,
  payer VARCHAR(120) NOT NULL,
  gross_cents INTEGER NOT NULL CHECK (abs(gross_cents::bigint) <= 1000000),
  fee_cents INTEGER NOT NULL CHECK (fee_cents BETWEEN 0 AND 1000000),
  net_cents INTEGER NOT NULL CHECK (abs(net_cents::bigint) <= 1000000),
  currency VARCHAR(3) NOT NULL,
  kind VARCHAR(120) NOT NULL,
  routed_app TEXT CHECK (routed_app IN ('first','spotlight','freelance','market_delivery','market_selling')),
  routed_record_type TEXT CHECK (routed_record_type IN ('first','income','gigs','shifts','sales')),
  routed_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, txn_id),
  UNIQUE (player_id, routed_record_type, routed_record_id),
  CHECK ((routed_app IS NULL AND routed_record_type IS NULL AND routed_record_id IS NULL) OR
    (routed_app IS NOT NULL AND routed_record_type IS NOT NULL AND routed_record_id IS NOT NULL))
);
CREATE INDEX paypal_transactions_player_idx ON paypal_transactions(player_id);
CREATE FUNCTION unlink_paypal_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE paypal_transactions SET routed_app = NULL, routed_record_type = NULL, routed_record_id = NULL
  WHERE player_id = OLD.player_id AND routed_record_type = TG_ARGV[0] AND routed_record_id = OLD.id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER log_entry_paypal_unlink AFTER DELETE ON log_entries FOR EACH ROW EXECUTE FUNCTION unlink_paypal_record('first');
CREATE TRIGGER income_paypal_unlink AFTER DELETE ON creator_income FOR EACH ROW EXECUTE FUNCTION unlink_paypal_record('income');
CREATE TRIGGER gig_paypal_unlink AFTER DELETE ON freelance_gigs FOR EACH ROW EXECUTE FUNCTION unlink_paypal_record('gigs');
CREATE TRIGGER shift_paypal_unlink AFTER DELETE ON delivery_shifts FOR EACH ROW EXECUTE FUNCTION unlink_paypal_record('shifts');
CREATE TRIGGER sale_paypal_unlink AFTER DELETE ON sales FOR EACH ROW EXECUTE FUNCTION unlink_paypal_record('sales');
ALTER TABLE payouts ADD COLUMN recipient_email VARCHAR(127);
ALTER TABLE payouts ADD COLUMN sender_batch_id TEXT UNIQUE;
ALTER TABLE payouts ADD COLUMN amount_cents INTEGER CHECK (amount_cents BETWEEN 10 AND 1000000);
ALTER TABLE payouts ADD COLUMN attempt_started_at TIMESTAMPTZ;
ALTER TABLE payouts ADD COLUMN first_attempt_at TIMESTAMPTZ;
ALTER TABLE payouts ADD COLUMN last_attempt_at TIMESTAMPTZ;
ALTER TABLE payouts ADD CONSTRAINT payouts_player_rung_key UNIQUE (player_id, rung_cents);
CREATE TABLE webhook_events (
  event_id VARCHAR(120) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
