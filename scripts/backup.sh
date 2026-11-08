#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Copia da base de datos en backups/. Usa o usuario e a base do propio contedor db.
set -euo pipefail

mkdir -p backups
file="backups/reservas-$(date +%Y%m%d-%H%M).dump"
docker compose exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$file"
echo "Copia gardada en $file"
