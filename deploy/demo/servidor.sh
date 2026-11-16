#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
# Prepara un servidor Ubuntu (por exemplo Oracle Cloud Always Free, ARM) para a demo.
# Executar unha vez no servidor: bash servidor.sh
set -euo pipefail

echo "== Docker"
if ! command -v docker >/dev/null; then
	curl -fsSL https://get.docker.com | sudo sh
	sudo usermod -aG docker "$USER"
fi

echo "== Cortalumes do sistema: abrir 80 e 443"
# As imaxes Ubuntu de Oracle traen regras iptables que bloquean todo agás SSH.
if command -v iptables >/dev/null; then
	sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
	sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
	if command -v netfilter-persistent >/dev/null; then sudo netfilter-persistent save; fi
fi

echo "== Datos ficticios novos cada noite (a historia da demo é relativa ao día de hoxe)"
CRON="0 4 * * * cd $HOME/xogamos && docker compose -f compose.yml -f deploy/demo/compose.demo.yml --env-file deploy/demo/.env --profile demo run --rm seed >> $HOME/xogamos-seed.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'xogamos-seed.log' ; echo "$CRON" ) | crontab -

echo "Listo. Lembra abrir tamén os portos 80 e 443 na lista de seguridade da VCN de Oracle."
echo "Pecha a sesión SSH e volve entrar para usar docker sen sudo."
