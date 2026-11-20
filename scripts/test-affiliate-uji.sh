#!/usr/bin/env bash
# Ujian skrip B9 (scripts/affiliate-uji.sql) pada Supabase local sahaja.
# Jalan: bash scripts/test-affiliate-uji.sh   (perlukan container supabase_db_pandaielektrik)
# Semua dalam satu transaksi, ROLLBACK di hujung. Kes: mula, idempotent, bukan admin, affiliate bukan ujian, emel tiada.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
DB=supabase_db_pandaielektrik
EMEL='planetrizq+uji@gmail.com'
ADM='11111111-b900-0000-0000-000000000001'
BUK='33333333-b900-0000-0000-000000000003'
BUYER='22222222-b900-0000-0000-000000000002'
fail=0
ok()  { echo "lulus: $1"; }
bad() { echo "GAGAL: $1"; fail=1; }

# Fixture tanpa SQL skrip; skrip B9 dimasukkan sebagai teks.
fixture() {
cat <<SQL
begin;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('$ADM'::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','adm9@test.local','{"full_name":"Adm9","privacy_accepted":true,"phone":"0123456789"}'),
  ('$BUK'::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','bukan9@test.local','{"full_name":"Bukan9","privacy_accepted":true,"phone":"0123456789"}'),
  ('$BUYER'::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','$EMEL','{"full_name":"Uji","privacy_accepted":true,"phone":"0123456789"}');
update profiles set role = 'admin' where id = '$ADM'::uuid;
insert into courses (slug, title, price, config) values ('b9', 'B9', 14900, '{"access_months":6,"affiliate_rate_pct":20}');
SQL
}
run_script() { # $1 = actor uuid
  { fixture; echo "\\set ON_ERROR_STOP on"; echo "\\set email '$EMEL'"; echo "\\set actor '$1'"; cat "$DIR/affiliate-uji.sql"; }
}
q() { docker exec -i "$DB" psql -U postgres -X -t -A -q -v ON_ERROR_STOP=1 -c "$1"; }

# 1) Mula: diluluskan sebagai ujian, kadar dari config
OUT=$( { run_script "$ADM"; echo "select count(*) from affiliates a join auth.users u on u.id=a.user_id where u.email='$EMEL' and a.status='approved' and a.is_test and a.rate_pct=20;"; echo "rollback;"; } | docker exec -i "$DB" psql -U postgres -X -t -A -v ON_ERROR_STOP=1 2>&1)
echo "$OUT" | grep -q "ERROR" && bad "mula: ralat: $(echo "$OUT" | grep ERROR | head -1)" || { echo "$OUT" | grep -q "^1$" && ok "mula: approved, is_test, kadar 20" || bad "mula: tidak tepat ($OUT)"; }

# 2) Idempotent: skrip dijalankan dua kali (larian kedua hanya skrip, tanpa fixture); affiliate kekal satu dan kekal approved
OUT=$( { run_script "$ADM"; echo "\\set ON_ERROR_STOP on"; echo "\\set email '$EMEL'"; echo "\\set actor '$ADM'"; cat "$DIR/affiliate-uji.sql"; echo "select count(*) from affiliates a join auth.users u on u.id=a.user_id where u.email='$EMEL' and a.status='approved';"; echo "rollback;"; } | docker exec -i "$DB" psql -U postgres -X -t -A -v ON_ERROR_STOP=1 2>&1)
echo "$OUT" | grep -q "ERROR" && bad "idempotent: ralat: $(echo "$OUT" | grep ERROR | head -1)" || { echo "$OUT" | grep -q "sudah diluluskan" && echo "$OUT" | grep -q "^1$" && ok "idempotent: larian kedua tiada perubahan, satu affiliate approved" || bad "idempotent: ($OUT)"; }

# 3) Bukan admin ditolak
OUT=$( { run_script "$BUK"; echo "rollback;"; } | docker exec -i "$DB" psql -U postgres -X -v ON_ERROR_STOP=1 2>&1)
echo "$OUT" | grep -q "actor_not_admin" && ok "bukan admin ditolak" || bad "bukan admin tidak ditolak"

# 4) Emel tiada ditolak
OUT=$( { fixture; echo "\\set ON_ERROR_STOP on"; echo "\\set email 'tiada@test.local'"; echo "\\set actor '$ADM'"; cat "$DIR/affiliate-uji.sql"; echo "rollback;"; } | docker exec -i "$DB" psql -U postgres -X -v ON_ERROR_STOP=1 2>&1)
echo "$OUT" | grep -q "emel_tidak_dijumpai" && ok "emel tiada ditolak" || bad "emel tiada tidak ditolak"

# 5) Affiliate sedia ada bukan ujian ditolak (tiada tukar senyap)
OUT=$( { run_script "$ADM"; echo "update affiliates set is_test=false where true;"; echo "\\set ON_ERROR_STOP on"; echo "\\set email '$EMEL'"; echo "\\set actor '$ADM'"; cat "$DIR/affiliate-uji.sql"; echo "rollback;"; } | docker exec -i "$DB" psql -U postgres -X -v ON_ERROR_STOP=1 2>&1)
echo "$OUT" | grep -q "affiliate_sedia_ada_bukan_ujian" && ok "affiliate bukan ujian tidak ditukar senyap" || bad "affiliate bukan ujian tidak dikesan"

echo; [ $fail -eq 0 ] && echo "SEMUA ujian B9 lulus" || { echo "ADA KEGAGALAN"; exit 1; }
