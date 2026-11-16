#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Comproba nun proxecto illado que unha copia se pode restaurar.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
env_file="$(mktemp)"
export COMPOSE_PROJECT_NAME=xogamos-restore-test
export COMPOSE_ENV_FILE="$env_file"

cleanup() {
	docker compose --env-file "$env_file" down -v --remove-orphans || true
	rm -f "$env_file"
}
trap cleanup EXIT

password="$(openssl rand -hex 24)"
secret="$(openssl rand -base64 48)"
cat > "$env_file" <<EOF
POSTGRES_USER=reservas
POSTGRES_PASSWORD=$password
POSTGRES_DB=reservas
DATABASE_URL=postgres://reservas:$password@db:5432/reservas
AUTH_SECRET=$secret
IDENTITY_MODE=simulated
PUBLIC_ORIGIN=http://localhost:3999
DEMO=1
DEMO_DATABASE_IS_DISPOSABLE=1
SMTP_URL=
MAIL_FROM=avisos@localhost
APP_PORT=3999
XOGAMOS_IMAGE=xogamos-restore-test
XOGAMOS_VERSION=latest
EOF

compose() {
	docker compose --env-file "$env_file" "$@"
}

compose build app seed
compose up -d db app
healthy=0
for _ in $(seq 1 24); do
	if compose exec -T app node -e "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
		healthy=1
		break
	fi
	sleep 5
done
[[ "$healthy" -eq 1 ]]
compose --profile demo run --rm seed
before="$(compose exec -T db sh -c 'psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (SELECT count(*) FROM municipalities), (SELECT count(*) FROM facilities), (SELECT count(*) FROM bookings);"')"
scripts/backup.sh
compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "TRUNCATE municipalities, facilities, bookings CASCADE;"'
dump="$(find backups -maxdepth 1 -type f -name 'reservas-*.dump' -print | sort -r | head -n 1)"
scripts/restore.sh "$dump" --yes
after="$(compose exec -T db sh -c 'psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (SELECT count(*) FROM municipalities), (SELECT count(*) FROM facilities), (SELECT count(*) FROM bookings);"')"
[[ "$before" = "$after" ]]
curl -fsS http://127.0.0.1:3999/healthz >/dev/null
echo "Proba de restauración correcta."
