#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Restaura unha copia e garda antes outra de seguridade.
set -euo pipefail

compose() {
	if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
		docker compose --env-file "$COMPOSE_ENV_FILE" "$@"
	else
		docker compose "$@"
	fi
}

backup_file="${1:-}"
yes="${2:-}"
if [[ -z "$backup_file" || "$yes" != "" && "$yes" != "--yes" ]]; then
	echo "Uso: scripts/restore.sh <ficheiro> [--yes]" >&2
	exit 1
fi
if [[ ! -f "$backup_file" ]]; then
	echo "Non existe o ficheiro de copia: $backup_file" >&2
	exit 1
fi

compose exec -T db sh -c 'pg_restore --list >/dev/null' < "$backup_file"
if [[ "$yes" != "--yes" ]]; then
	read -r -p "Isto substituirá os datos actuais. Continuar? [s/N] " answer
	if [[ "$answer" != "s" && "$answer" != "S" ]]; then
		echo "Restauración cancelada."
		exit 0
	fi
fi

scripts/backup.sh
compose stop app
compose exec -T db sh -c \
	'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$backup_file"
compose up -d app

for _ in $(seq 1 24); do
	if compose exec -T app node -e "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
		echo "Copia restaurada desde $backup_file"
		exit 0
	fi
	sleep 5
done

echo "A restauración rematou, pero a aplicación non está sa." >&2
exit 1
