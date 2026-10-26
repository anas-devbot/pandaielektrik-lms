#!/usr/bin/env bash
# Backup malam: pg_dump (custom format) -> semak -> upload R2 -> pangkas salinan lokal.
# Dump/restore guna stdin/stdout supaya PG_DUMP boleh dibungkus (cth. docker exec -i) bila klien host lebih lama dari server.
# Env: BACKUP_DATABASE_URL (wajib), BACKUP_DIR (default ./backups), BACKUP_KEEP_DAYS (7),
#      PG_DUMP / PG_RESTORE (default pg_dump / pg_restore; klien mesti >= versi server),
#      R2_* (lihat r2-upload.mjs). REQUIRE_UPLOAD=1 => gagal jika R2 tiada (guna di produksi).
set -euo pipefail
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL tiada}"
DIR="${BACKUP_DIR:-./backups}"; KEEP="${BACKUP_KEEP_DAYS:-7}"
PG_DUMP="${PG_DUMP:-pg_dump}"; PG_RESTORE="${PG_RESTORE:-pg_restore}"
mkdir -p "$DIR"; umask 077
OUT="$DIR/pandaielektrik-$(date -u +%Y%m%d-%H%M%S).dump"

# public (data aplikasi) + auth (auth.users dirujuk profiles). Tiada owner/privilege: restore ke projek lain.
$PG_DUMP --format=custom --no-owner --no-privileges --schema=public --schema=auth \
  --dbname="$BACKUP_DATABASE_URL" > "$OUT"
# dump rosak = backup palsu: semak TOC boleh dibaca dan bukan kosong
$PG_RESTORE --list < "$OUT" >/dev/null
[ "$(wc -c <"$OUT")" -gt 1000 ] || { echo "dump terlalu kecil: $OUT" >&2; exit 1; }
echo "dump ok: $OUT"

if [ -n "${R2_BACKUP_BUCKET:-}" ]; then
  node "$(dirname "$0")/r2-upload.mjs" "$OUT"
elif [ "${REQUIRE_UPLOAD:-0}" = 1 ]; then
  echo "REQUIRE_UPLOAD=1 tetapi R2_BACKUP_BUCKET tiada" >&2; exit 1
else
  echo "AMARAN: tiada upload R2 (R2_BACKUP_BUCKET kosong). Salinan lokal sahaja." >&2
fi
find "$DIR" -name 'pandaielektrik-*.dump' -mtime +"$KEEP" -delete
