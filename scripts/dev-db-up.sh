#!/usr/bin/env bash
# PostgreSQL 16 lokal untuk container pengembangan tanpa Docker: jalankan cluster, buat role dan database bila belum ada, lalu migrasi.
# Aman diulang. Di mesin dengan Docker, pakai docker/compose.dev.yml saja.
set -euo pipefail
PGBIN=/usr/lib/postgresql/16/bin
DATA=${KASKITA_PGDATA:-/var/lib/postgresql/kasdata}
cd "$(dirname "$0")/.."

if [ ! -f "$DATA/PG_VERSION" ]; then
  mkdir -p "$DATA" && chown postgres:postgres "$DATA"
  su postgres -c "$PGBIN/initdb -D $DATA -U postgres --auth=trust -E UTF8" >/dev/null
fi
if ! pg_isready -h localhost -q; then
  su postgres -c "$PGBIN/pg_ctl -D $DATA -l $DATA/log -o '-p 5432 -k /tmp' -w start" >/dev/null
fi

psql -h localhost -U postgres -tAc "select 1 from pg_roles where rolname='kaskita'" | grep -q 1 \
  || psql -h localhost -U postgres -qc "create role kaskita login password 'kaskita' superuser"
for db in kaskita kaskita_test kaskita_test_auth; do
  psql -h localhost -U postgres -tAc "select 1 from pg_database where datname='$db'" | grep -q 1 \
    || psql -h localhost -U postgres -qc "create database $db owner kaskita"
done

set -a; . ./.env.local; set +a
for db in kaskita kaskita_test kaskita_test_auth; do
  DATABASE_MIGRATION_URL="postgres://kaskita:kaskita@localhost:5432/$db" npx tsx scripts/migrate.ts >/dev/null
done
users=$(psql "$DATABASE_URL" -tAc "select count(*) from users")
if [ "$users" = "0" ]; then npx tsx scripts/seed.ts; fi
echo "Database dev siap (users: $(psql "$DATABASE_URL" -tAc 'select count(*) from users'))"
