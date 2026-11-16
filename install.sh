#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Instala Xogamos cunha configuración segura nun só paso.
set -euo pipefail

demo=0
local=0
yes=0
for option in "$@"; do
	case "$option" in
		--demo) demo=1 ;;
		--local) local=1 ;;
		--yes) yes=1 ;;
		*) echo "Uso: ./install.sh [--demo] [--local] [--yes]" >&2; exit 1 ;;
	esac
done

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
	echo "Precísanse Docker Engine e o complemento Docker Compose." >&2
	exit 1
fi
if [[ -f .env ]]; then
	echo "Xa existe .env. Revise ese ficheiro ou elimínea para crear unha configuración nova." >&2
	exit 1
fi

domain="${XOGAMOS_DOMAIN:-}"
email="${XOGAMOS_EMAIL:-}"
if [[ "$local" -eq 1 ]]; then
	domain="localhost"
	public_origin="http://localhost:3000"
else
	if [[ "$yes" -eq 0 ]]; then
		[[ -n "$domain" ]] || read -r -p "Dominio público: " domain
		[[ -n "$email" ]] || read -r -p "Correo para os certificados: " email
	fi
	if [[ -z "$domain" || -z "$email" ]]; then
		echo "Indique XOGAMOS_DOMAIN e XOGAMOS_EMAIL, ou execute sen --yes." >&2
		exit 1
	fi
	public_origin="https://$domain"
fi

password="$(openssl rand -hex 24)"
secret="$(openssl rand -base64 48)"
cp .env.example .env
sed -i.bak \
	-e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$password|" \
	-e "s|^DATABASE_URL=.*|DATABASE_URL=postgres://reservas:$password@db:5432/reservas|" \
	-e "s|^AUTH_SECRET=.*|AUTH_SECRET=$secret|" \
	-e "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=$public_origin|" \
	-e "s|^XOGAMOS_DOMAIN=.*|XOGAMOS_DOMAIN=$domain|" \
	-e "s|^XOGAMOS_EMAIL=.*|XOGAMOS_EMAIL=$email|" .env
rm -f .env.bak
if [[ "$demo" -eq 1 ]]; then
	sed -i.bak \
		-e 's|^DEMO=.*|DEMO=1|' \
		-e 's|^IDENTITY_MODE=.*|IDENTITY_MODE=simulated|' \
		-e 's|^DEMO_DATABASE_IS_DISPOSABLE=.*|DEMO_DATABASE_IS_DISPOSABLE=1|' .env
	rm -f .env.bak
fi
chmod 600 .env

if [[ "$local" -eq 0 ]]; then
	cat > Caddyfile <<EOF
# SPDX-License-Identifier: EUPL-1.2
{
	email $email
}

$domain {
	encode zstd gzip
	header {
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "geolocation=(), microphone=(), camera=()"
	}
	reverse_proxy app:3000
}
EOF
fi

if docker compose pull; then
	:
else
	docker compose build
fi
if [[ "$local" -eq 1 ]]; then
	docker compose up -d
else
	docker compose --profile proxy up -d
fi
if [[ "$demo" -eq 1 ]]; then
	docker compose --profile demo run --rm seed
fi
for _ in $(seq 1 24); do
	if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
		echo "Instalación lista en $public_origin"
		echo "As copias gárdanse en backups/."
		echo "Seguinte paso: garde unha copia fóra do servidor con scripts/backup.sh."
		exit 0
	fi
	sleep 5
done
echo "A aplicación non respondeu en 120 segundos. Consulte: docker compose logs app" >&2
exit 1
