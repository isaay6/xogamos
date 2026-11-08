# Instalación

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

Obteña a nova versión do código e reconstrúa os contedores:

```sh
git pull
docker compose up -d --build
```

As migracións necesarias execútanse no inicio do contedor da aplicación.

## Copias de seguridade

Cree unha copia en `backups/`:

```sh
scripts/backup.sh
```

Para restaurala (a operación substitúe os datos existentes):

```sh
scripts/restore.sh backups/reservas-AAAAMMDD-HHMM.dump
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

A integración real con Cl@ve ou Chave365 require tramitar a alta correspondente ante a AGE ou a
Xunta de Galicia. O modo `simulated` non é un substituto desa alta.
