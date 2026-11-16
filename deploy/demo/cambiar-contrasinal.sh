#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Cambia o usuario e o contrasinal da demo privada. Pídeos sen mostralos; o contrasinal non sae
# do ordenador en claro máis que cara ao servidor por SSH, onde só se garda o hash bcrypt.
#   bash deploy/demo/cambiar-contrasinal.sh root@1.2.3.4 [~/.ssh/chave] [ficheiro-de-acceso]
set -euo pipefail
SERVER="${1:?Indica o servidor, por exemplo root@1.2.3.4}"
KEY="${2:-}"
ACCESO="${3:-}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[[ -n "$KEY" ]] && SSH_OPTS+=(-i "$KEY")

read -r -p "Usuario [xurado]: " USUARIO
USUARIO="${USUARIO:-xurado}"
[[ "$USUARIO" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Usuario: só letras, números, . _ -"; exit 1; }
read -r -s -p "Contrasinal novo: " PASS; echo
read -r -s -p "Repíteo: " PASS2; echo
[[ "$PASS" == "$PASS2" ]] || { echo "Non coinciden."; exit 1; }
(( ${#PASS} >= 8 )) || { echo "Mínimo 8 caracteres."; exit 1; }

# O hash xérase no servidor; o contrasinal vai pola entrada estándar, nunca na liña de ordes.
HASH="$(printf '%s\n' "$PASS" | ssh "${SSH_OPTS[@]}" "$SERVER" \
	'docker run --rm -i caddy:2.8-alpine caddy hash-password' | tr -d '\r\n')"
[[ "$HASH" == \$2* ]] || { echo "Non se puido xerar o hash."; exit 1; }
HASH_ENV="${HASH//\$/\$\$}"

ssh "${SSH_OPTS[@]}" "$SERVER" USUARIO="$USUARIO" HASH_ENV="'$HASH_ENV'" bash -s <<'REMOTO'
set -euo pipefail
cd ~/xogamos
F=deploy/demo/.env
grep -v -e '^DEMO_USER=' -e '^DEMO_PASS_HASH=' "$F" > "$F.novo" || true
printf 'DEMO_USER=%s\nDEMO_PASS_HASH=%s\n' "$USUARIO" "$HASH_ENV" >> "$F.novo"
chmod 600 "$F.novo" && mv "$F.novo" "$F"
docker compose -f compose.yml -f deploy/demo/compose.demo.yml --env-file "$F" up -d caddy
REMOTO

if [[ -n "$ACCESO" ]]; then
	HOST="$(sed -n 's/^Enderezo: //p' "$ACCESO" 2>/dev/null || true)"
	umask 077
	printf 'Demo privada de Xogamos (ata o día do envío)\nEnderezo: %s\nUsuario: %s\nContrasinal: %s\n' \
		"$HOST" "$USUARIO" "$PASS" > "$ACCESO"
	echo "== Gardado en $ACCESO"
fi
echo "== Feito. Proba a entrar co usuario «$USUARIO»."
