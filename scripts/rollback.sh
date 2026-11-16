#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Volve á imaxe e á copia anteriores á actualización.
set -euo pipefail

compose() {
	if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
		docker compose --env-file "$COMPOSE_ENV_FILE" "$@"
	else
		docker compose "$@"
	fi
}

previous_file="backups/.previous-version"
backup_file="backups/.previous-backup"
if [[ ! -s "$previous_file" || ! -s "$backup_file" ]]; then
	echo "Falta a información da actualización anterior en backups/." >&2
	exit 1
fi

previous="$(<"$previous_file")"
image="${previous%:*}"
version="${previous##*:}"
if [[ "$image" = "$previous" ]]; then
	echo "A imaxe anterior non ten etiqueta utilizable: $previous" >&2
	exit 1
fi
export XOGAMOS_IMAGE="$image"
export XOGAMOS_VERSION="$version"
compose up -d app
scripts/restore.sh "$(<"$backup_file")" --yes
echo "Volta atrás completada. A aplicación usa a imaxe gardada antes de actualizar."
echo "Para fixala, poña XOGAMOS_IMAGE=$image e XOGAMOS_VERSION=$version no .env."
