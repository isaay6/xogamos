# Instalación

## Instalación nun comando

Nun servidor con Docker, execute:

```sh
git clone https://github.com/[⚠ usuario]/[⚠ repositorio].git xogamos && cd xogamos
./install.sh
```

O asistente pide o dominio e o correo para o certificado HTTPS, crea `.env` con segredos aleatorios,
descarga a imaxe publicada e arrinca Caddy, a aplicación, PostgreSQL e as copias diarias. Para unha
demo con datos ficticios use `./install.sh --demo`; para probala só no propio servidor use
`./install.sh --local`. En automatización, indique `XOGAMOS_DOMAIN`, `XOGAMOS_EMAIL` e `--yes`.

Nunha instalación real, o paso seguinte é conectar a identidade e crear a primeira persoa operadora:
ver [despregar nunha Deputación](guias/despregamento-deputacion.md).

## Requisitos

Precísase un servidor con Docker Engine e o complemento Docker Compose. A aplicación publica o
porto 3000; coloque un proxy HTTPS diante dela antes de abrila á cidadanía.

## Primeiro arranque

1. Copie a configuración e complete os valores reais:

	```sh
	cp .env.example .env
	openssl rand -base64 48
	```

	Pegue o resultado en `AUTH_SECRET`. Defina tamén `PUBLIC_ORIGIN` coa URL pública
	HTTPS da instalación, e cambie o contrasinal de PostgreSQL.

2. Arranque os servizos:

	```sh
	docker compose up -d
	```

	As migracións aplícanse automaticamente antes de arrancar a aplicación.

3. Só para unha demostración, active no `.env` o bloque comentado de `DEMO=1`,
	`IDENTITY_MODE=simulated` e `DEMO_DATABASE_IS_DISPOSABLE=1`. Despois cargue os datos ficticios:

	```sh
	docker compose --profile demo run --rm seed
	```

	Este modo é exclusivamente para demos e nunca debe empregarse cunha base de datos real.

## Actualización

Use a actualización con copia previa e volta atrás automática:

```sh
scripts/update.sh
```

As migracións necesarias execútanse no inicio do contedor da aplicación.

## Copias de seguridade

Caddy executa unha copia verificada cada día ás 03:00. Están en `backups/`; cambie `BACKUP_HOUR` e
`BACKUP_KEEP_DAYS` no `.env` se cómpre. Cree tamén unha copia manual:

```sh
scripts/backup.sh
```

Para restaurala (a operación substitúe os datos existentes):

```sh
scripts/restore.sh backups/reservas-AAAAMMDD-HHMM.dump --yes
```

Garde esas copias fóra do servidor de produción de forma periódica.

## Proxy HTTPS

Por exemplo, un `Caddyfile` mínimo diante da aplicación é:

```caddy
reservas.exemplo.gal {
	reverse_proxy 127.0.0.1:3000
}
```

Caddy obtén e renova o certificado HTTPS se o dominio apunta ao servidor e envía a cabeceira
`X-Forwarded-Proto`, que a aplicación le grazas a `PROTOCOL_HEADER`. A aplicación só escoita en
`127.0.0.1`, así que non se pode chegar a ela sen pasar polo proxy. Non expoña directamente o porto
de PostgreSQL.

## Identidade dixital real

Use `IDENTITY_MODE=oidc`, `PUBLIC_ORIGIN` e, para cada provedor activado, `OIDC_<PROVEDOR>_ISSUER` e `OIDC_<PROVEDOR>_CLIENT_ID`; `OIDC_<PROVEDOR>_CLIENT_SECRET` é opcional para clientes públicos con PKCE. `OIDC_SCOPES` vale por defecto `openid profile email` e `OIDC_SUBJECT_CLAIM` vale `sub`.

A integración real con Cl@ve ou Chave365 require tramitar a alta correspondente ante a AGE ou a
Xunta de Galicia. O modo `simulated` non é un substituto desa alta.
