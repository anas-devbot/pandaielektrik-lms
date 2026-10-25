#!/usr/bin/env bash
# DRAF: tidak dijalankan tanpa kelulusan Bos (docs/DEPLOY-PLAN.md). Build local, hantar ke VPS, tukar symlink, restart.
set -euo pipefail
HOST="${DEPLOY_HOST:?set DEPLOY_HOST=user@ip}"
KEY="${DEPLOY_KEY:?set DEPLOY_KEY=path/ke/key}"
REL="$(date +%Y%m%d-%H%M%S)"
DEST="/opt/pandaielektrik/releases/$REL"
SSH="ssh -i $KEY"

npm ci && npm run build
# standalone tidak salin static/public: lengkapkan secara manual
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

rsync -az -e "$SSH" .next/standalone/ "$HOST:$DEST/"
$SSH "$HOST" "chown -R pandaielektrik:pandaielektrik $DEST && ln -sfn $DEST /opt/pandaielektrik/current && systemctl restart pandaielektrik && ls -1dt /opt/pandaielektrik/releases/* | tail -n +4 | xargs -r rm -rf"
echo "Deployed $REL. Rollback: tukar symlink 'current' ke release sebelumnya, systemctl restart pandaielektrik."
