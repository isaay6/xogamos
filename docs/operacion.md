# Operación: actualizar, reverter, soporte e quen fai que

Complementa a [instalación](instalacion.md). Pensado para unha persoa técnica do concello ou da Deputación.

## 1. Quen fai que

| Tarefa | Concello | Deputación ou encargado técnico | Proxecto Xogamos |
|---|---|---|---|
| Instalacións, horarios, normas, prezos | ✔ | | |
| Persoal e papeis (administración, conserxería, apertura) | ✔ | | |
| Atención á veciñanza e dereitos RXPD | ✔ | | |
| Servidor, proxy HTTPS e dominio | | ✔ | |
| Copias diarias e proba de restauración | | ✔ | |
| Aplicar actualizacións | | ✔ | |
| Alta de concellos novos nunha instalación compartida | | ✔ (Deputación) | |
| Correccións, versións novas e documentación | | | ✔ |
| Avisos de seguridade | | | ✔ (`SECURITY.md`) |

## 2. Actualizar

1. Execute a actualización publicada:

	```sh
	scripts/update.sh
	```

2. Para unha versión concreta, indique a etiqueta:

	```sh
	scripts/update.sh v0.1.0
	```

O script garda unha copia, comproba a saúde e, se falla, restaura automaticamente a imaxe e a copia anteriores.

## 3. Reverter

1. Volva manualmente á última actualización gardada:

 	```sh
	scripts/rollback.sh
	```

2. Confirme que a saúde responde:

	```sh
	curl -fsS http://127.0.0.1:${APP_PORT:-3000}/healthz
	```

As reservas feitas despois da copia previa pérdense; actualice fóra de horas.

## 4. Copias

1. As copias automáticas execútanse ás 03:00 en `backups/`. Axuste `BACKUP_HOUR` e
	`BACKUP_KEEP_DAYS` no `.env`; as tres máis novas nunca se borran.

2. Cree unha copia antes dunha intervención:

	```sh
	scripts/backup.sh
	```

3. Copie periodicamente `backups/` fóra do servidor.

## 5. Restauración probada

1. Consulte primeiro a copia dispoñible:

	```sh
	ls -lt backups/
	```

2. Restaure unha copia. O script pide confirmación, fai outra copia de seguridade e comproba a saúde:

	```sh
	scripts/restore.sh backups/reservas-AAAAMMDD-HHMM.dump
	```

3. Para comprobar o procedemento completo nun proxecto illado:

	```sh
	scripts/test-restore.sh
	```

## 6. Vixilancia

- `GET /healthz` responde 200 se a aplicación e a base están ben (o `compose.yml` xa o usa como *healthcheck*).
- Rexistros: `docker compose logs app`. Os traballos diarios (lembranzas, conservación) avisan alí se fallan.

## 7. Soporte

| Nivel | Quen | Exemplos |
|---|---|---|
| 1 | Conserxería e administración do concello | Dúbidas da veciñanza, reservas por teléfono |
| 2 | Técnico da Deputación ou do encargado | Caídas, copias, actualizacións |
| 3 | Proxecto Xogamos (incidencias no repositorio) | Erros do software e melloras |
