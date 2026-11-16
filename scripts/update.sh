#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Actualiza a imaxe e volve atrás se falla a saúde.
set -euo pipefail

compose() {
	if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
		docker compose --env-file "$COMPOSE_ENV_FILE" "$@"
	else
		docker compose "$@"
	fi
}

health() {
	for _ in $(seq 1 24); do
		if compose exec -T app node -e "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
			return 0
		fi
		sleep 5
	done
	return 1
}

mkdir -p backups
# Gárdase a imaxe actual cunha etiqueta propia: «latest» vai cambiar ao descargar a nova.
previous_id="$(compose images -q app | head -n 1)"
if [[ -z "$previous_id" ]]; then
	echo "A aplicación non está arrincada: non hai versión anterior á que volver." >&2
	exit 1
fi
docker tag "$previous_id" xogamos-rollback:previous
printf '%s\n' "xogamos-rollback:previous" > backups/.previous-version
scripts/backup.sh
latest_backup="$(find backups -maxdepth 1 -type f -name 'reservas-*.dump' -print | sort -r | head -n 1)"
printf '%s\n' "$latest_backup" > backups/.previous-backup

if [[ $# -gt 0 ]]; then
	export XOGAMOS_VERSION="$1"
fi

if compose pull app; then
	:
else
	compose build app
fi
compose up -d app
if health; then
	echo "Actualización completada."
	exit 0
fi

echo "A actualización fallou. Volvendo á versión anterior..." >&2
scripts/rollback.sh --yes
echo "A actualización fallou e restaurouse a versión anterior." >&2
exit 1
