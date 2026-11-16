#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Copia verificada da base de datos en backups/.
set -euo pipefail

compose() {
	if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
		docker compose --env-file "$COMPOSE_ENV_FILE" "$@"
	else
		docker compose "$@"
	fi
}

mkdir -p backups
file="backups/reservas-$(date +%Y%m%d-%H%M).dump"
if [[ -e "$file" ]]; then
	file="backups/reservas-$(date +%Y%m%d-%H%M-%S)-$$.dump"
fi
temporary="${file}.tmp.$$"
trap 'rm -f "$temporary"' EXIT
compose exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$temporary"
compose exec -T db sh -c 'pg_restore --list >/dev/null' < "$temporary"
mv "$temporary" "$file"
trap - EXIT
echo "Copia gardada en $file"
