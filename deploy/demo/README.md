# Demo pública (datos ficticios)

Despregamento da demo para o xurado: a aplicación en modo demostración, PostgreSQL e Caddy con
HTTPS automático. **Non serve para datos reais** (para iso, ver [docs/instalacion.md](../../docs/instalacion.md)).

## 1. Servidor

Calquera servidor Ubuntu con 1 GB de RAM ou máis. Pensado para unha máquina **Oracle Cloud
Always Free** (Ampere ARM, Ubuntu 24.04); probado en local con Docker:

1. Crear a instancia con Ubuntu e gardar a chave SSH.
2. Na **lista de seguridade da VCN**, engadir regras de entrada para os portos **80 e 443** (TCP, orixe `0.0.0.0/0`).
3. Copiar e executar `servidor.sh` unha vez:

```bash
scp -i ~/.ssh/chave-oracle deploy/demo/servidor.sh ubuntu@IP:
ssh -i ~/.ssh/chave-oracle ubuntu@IP 'bash servidor.sh'
```

Instala Docker, abre os portos no cortalumes do sistema e programa unha semente nova cada noite ás
04:00, porque as reservas da demo calcúlanse arredor do día de hoxe.

## 2. Configuración

No servidor, crear `~/xogamos/deploy/demo/.env` a partir de [env.example](env.example):

- `DEMO_HOST`: sen dominio propio, a IP con guións e `.sslip.io` (IP `1.2.3.4` → `1-2-3-4.sslip.io`).
- `DEMO_PASS_HASH`: hash bcrypt do contrasinal temporal, cos `$` dobrados.
- Contrasinal de PostgreSQL e `AUTH_SECRET` (`openssl rand -base64 48`).

## 3. Subir e arrincar

Desde o ordenador, na raíz do repositorio:

```bash
bash deploy/demo/subir.sh ubuntu@IP ~/.ssh/chave-oracle
```

Envía o código da versión actual (non precisa que o repositorio sexa público), constrúe as imaxes,
arrinca e carga os datos ficticios. Repetir despois de cada cambio.

## 4. Abrir a demo ao público

No `.env` do servidor, cambiar `CADDYFILE=Caddyfile.privado` por `CADDYFILE=Caddyfile.publico` e:

```bash
cd ~/xogamos && docker compose -f compose.yml -f deploy/demo/compose.demo.yml --env-file deploy/demo/.env up -d caddy
```

## Comprobación

- Sen contrasinal: `curl -I https://DEMO_HOST/demo` → `401` (privada) ou `200` (pública).
- Saúde: `curl https://DEMO_HOST/healthz` → `{"ok":true}`.
