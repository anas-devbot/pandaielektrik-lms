#!/usr/bin/env bash
# Deploy ke VPS: build di mesin ini, hantar ke release baharu, tukar symlink, restart.
# NEXT_PUBLIC_* diambil dari /etc/pandaielektrik/env di VPS (nilai dalam memori sahaja, tidak dicetak).
# Guard: build dibatalkan jika URL Supabase menunjuk ke local, atau bundle mengandungi 127.0.0.1 (insiden 12 Nov 2026).
# Jalankan selepas migration produksi (docs/DEPLOY-PLAN.md): DEPLOY_HOST=root@<ip> DEPLOY_KEY=~/.ssh/<key> ./scripts/deploy.sh
set -euo pipefail
HOST="${DEPLOY_HOST:?set DEPLOY_HOST=user@ip}"
KEY="${DEPLOY_KEY:?set DEPLOY_KEY=path/ke/key}"
REL="$(date +%Y%m%d-%H%M%S)"
DEST="/opt/pandaielektrik/releases/$REL"
SSH="ssh -i $KEY -o BatchMode=yes"

PUB="$($SSH "$HOST" "grep '^NEXT_PUBLIC_' /etc/pandaielektrik/env")"
[ -n "$PUB" ] || { echo "GAGAL: NEXT_PUBLIC_* tiada dalam /etc/pandaielektrik/env" >&2; exit 1; }
while IFS='=' read -r k v; do export "$k=$v"; done <<< "$PUB"

case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
  "" | *127.0.0.1* | *localhost*) echo "GAGAL: NEXT_PUBLIC_SUPABASE_URL kosong atau menunjuk ke local. Build dibatalkan." >&2; exit 1 ;;
esac

npm ci && npm run build
# standalone tidak salin static/public: lengkapkan secara manual
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# Guard: URL Supabase local (port 54321) tak boleh masuk bundle. Jangan guna "127.0.0.1" mentah: pustaka Next boleh mengandunginya.
if grep -rl "127\.0\.0\.1:54321" .next/standalone .next/static 2>/dev/null | grep -q .; then
  echo "GAGAL: bundle mengandungi URL Supabase local (127.0.0.1:54321). Deploy dibatalkan." >&2; exit 1
fi

rsync -az -e "$SSH" .next/standalone/ "$HOST:$DEST/"
$SSH "$HOST" "chown -R pandaielektrik:pandaielektrik $DEST && ln -sfn $DEST /opt/pandaielektrik/current && systemctl restart pandaielektrik && ls -1dt /opt/pandaielektrik/releases/* | tail -n +4 | xargs -r rm -rf"
echo "Deployed $REL. Rollback: tukar symlink 'current' ke release sebelumnya, systemctl restart pandaielektrik."
