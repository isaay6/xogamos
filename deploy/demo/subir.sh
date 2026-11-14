#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Sobe a versión actual (HEAD) ao servidor e (re)arrinca a demo. Desde o ordenador local:
#   bash deploy/demo/subir.sh ubuntu@1.2.3.4 [~/.ssh/chave-oracle]
# Non precisa que o repositorio sexa público: envía un paquete co código.
set -euo pipefail
SERVER="${1:?Indica o servidor, por exemplo ubuntu@1.2.3.4}"
KEY="${2:-}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "$KEY" ]] && SSH_OPTS+=(-i "$KEY")

cd "$(git rev-parse --show-toplevel)"
PAQUETE="$(mktemp -t xogamos).tar.gz"
git archive --format=tar.gz -o "$PAQUETE" HEAD
echo "== Enviando $(du -h "$PAQUETE" | cut -f1) a $SERVER"
scp "${SSH_OPTS[@]}" "$PAQUETE" "$SERVER:xogamos.tar.gz"
rm -f "$PAQUETE"

ssh "${SSH_OPTS[@]}" "$SERVER" bash -s <<'REMOTO'
set -euo pipefail
mkdir -p ~/xogamos
# Conserva o .env da demo entre versións.
[[ -f ~/xogamos/deploy/demo/.env ]] && cp ~/xogamos/deploy/demo/.env ~/xogamos-demo.env
tar -xzf ~/xogamos.tar.gz -C ~/xogamos
[[ -f ~/xogamos-demo.env ]] && cp ~/xogamos-demo.env ~/xogamos/deploy/demo/.env
cd ~/xogamos
if [[ ! -f deploy/demo/.env ]]; then
	echo "Falta deploy/demo/.env: cópiao desde deploy/demo/env.example e enche os valores."
	exit 1
fi
C="docker compose -f compose.yml -f deploy/demo/compose.demo.yml --env-file deploy/demo/.env"
$C up -d --build
$C --profile demo run --rm seed
$C ps
REMOTO
echo "== Feito"
