#!/usr/bin/env bash
# Uji restore: pulihkan dump ke DB KOSONG baharu dan sahkan jadual + data. Jangan tunjuk ke DB produksi.
# Guna: restore-test.sh <fail.dump>. Env: RESTORE_ADMIN_URL (URL DB 'postgres' pada server UJIAN),
#      PG_RESTORE / PSQL (default pg_restore / psql).
set -euo pipefail
DUMP="${1:?guna: restore-test.sh <fail.dump>}"
: "${RESTORE_ADMIN_URL:?RESTORE_ADMIN_URL tiada}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"; PSQL="${PSQL:-psql}"
DB="restore_test_$(date +%s)"
BASE="${RESTORE_ADMIN_URL%/*}"
trap '$PSQL "$RESTORE_ADMIN_URL" -qc "drop database if exists $DB" >/dev/null 2>&1 || true' EXIT

$PSQL "$RESTORE_ADMIN_URL" -qc "create database $DB"
# DB baharu ada schema public kosong; buang supaya dump boleh cipta semula (ciri dump, bukan --clean yang ralat pada polisi).
$PSQL "$BASE/$DB" -qc "drop schema public cascade; create schema extensions; create extension pgcrypto schema extensions; create extension \"uuid-ossp\" schema extensions"
# Projek Supabase baharu sudah ada schema extensions (pgcrypto); DB kosong biasa tidak, jadi sediakan setara itu.
# --exit-on-error: sebarang ralat restore = gagal (tiada restore "separa")
$PG_RESTORE --no-owner --no-privileges --exit-on-error --dbname="$BASE/$DB" < "$DUMP"
TABLES=$($PSQL "$BASE/$DB" -Atc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
COURSES=$($PSQL "$BASE/$DB" -Atc "select count(*) from public.courses")
echo "restore ok: $TABLES jadual public, $COURSES kursus"
[ "$TABLES" -ge "${EXPECT_TABLES:-19}" ] || { echo "GAGAL: jadual kurang dari jangkaan" >&2; exit 1; }
[ "$COURSES" -ge 1 ] || { echo "GAGAL: data courses kosong" >&2; exit 1; }
