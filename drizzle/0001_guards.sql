-- Aplikasi hanya untuk dua orang: user ketiga ditolak di level database
CREATE OR REPLACE FUNCTION enforce_max_two_users() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM users) >= 2 THEN
    RAISE EXCEPTION 'Kas Kita hanya mendukung dua pengguna' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER users_max_two BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION enforce_max_two_users();
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS transactions_note_trgm_idx ON transactions USING gin (note gin_trgm_ops);
--> statement-breakpoint
-- audit_log append-only: update dan delete ditolak apa pun role-nya
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log hanya bisa ditambah';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
