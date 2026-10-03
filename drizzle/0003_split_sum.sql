-- Jumlah split struk wajib sama dengan nominal transaksi (DATA-MODEL transaction_splits), dicek saat commit
CREATE OR REPLACE FUNCTION check_transaction_splits_sum() RETURNS trigger AS $$
DECLARE
  tid uuid;
  tx_amount bigint;
  split_total bigint;
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    tid := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    tid := OLD.transaction_id;
  ELSE
    tid := NEW.transaction_id;
  END IF;
  SELECT sum(amount) INTO split_total FROM transaction_splits WHERE transaction_id = tid;
  IF split_total IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT amount INTO tx_amount FROM transactions WHERE id = tid;
  IF tx_amount IS NULL THEN
    RETURN NULL;
  END IF;
  IF split_total <> tx_amount THEN
    RAISE EXCEPTION 'Jumlah split % tidak sama dengan nominal transaksi %', split_total, tx_amount USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER transaction_splits_sum AFTER INSERT OR UPDATE OR DELETE ON transaction_splits
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_transaction_splits_sum();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER transactions_splits_sum AFTER UPDATE OF amount ON transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_transaction_splits_sum();
