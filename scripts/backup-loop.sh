#!/bin/sh
# SPDX-License-Identifier: EUPL-1.2
# Fai unha copia diaria e conserva sempre as tres últimas.
set -eu

hour="${BACKUP_HOUR:-03}"
keep="${BACKUP_KEEP_DAYS:-14}"

backup() {
	stamp="$(date +%Y%m%d-%H%M)"
	temporary="/backups/reservas-${stamp}.dump.tmp"
	file="/backups/reservas-${stamp}.dump"
	PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB" > "$temporary"
	pg_restore --list "$temporary" >/dev/null
	mv "$temporary" "$file"
	find /backups -type f -name 'reservas-*.dump' -mtime "+$keep" | sort | head -n -3 | xargs -r rm -f
	echo "Copia diaria gardada en $file"
}

last=""
while true; do
	now="$(date +%H)"
	day="$(date +%Y%m%d)"
	if [ "$now" = "$hour" ] && [ "$last" != "$day" ]; then
		backup
		last="$day"
	fi
	sleep 300
done
