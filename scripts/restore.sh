#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Restaura unha copia feita con backup.sh. Substitúe os datos actuais.
set -euo pipefail

backup_file="${1:?Indique o ficheiro de copia a restaurar}"
if [[ ! -f "$backup_file" ]]; then
	echo "Non existe o ficheiro de copia: $backup_file" >&2
	exit 1
fi

docker compose exec -T db sh -c \
	'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$backup_file"
echo "Copia restaurada desde $backup_file"
