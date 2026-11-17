# Despregar Xogamos nunha Deputación

**Para quen:** o servizo de informática da Deputación ou do concello que aloxa a plataforma.
**Resultado:** unha instalación con HTTPS, copias diarias e a primeira persoa operadora creada.
**Tempo:** arredor dunha hora, sen contar a alta en Cl@ve.

## Que se necesita

| Recurso | Mínimo | Para unha provincia enteira |
|---|---|---|
| Servidor Linux con Docker e Docker Compose | 2 vCPU, 4 GB de RAM, 40 GB de disco | 4 vCPU, 8 GB de RAM, 100 GB de disco |
| Dominio | Un, por exemplo `deportes.depourense.gal` | O mesmo: os concellos van en `/viana`, `/trives`... |
| Portos abertos | 80 e 443 | Os mesmos |
| Correo de saída (SMTP) | Opcional | Recomendado, para os avisos por correo |

Non fai falta nada máis: unha aplicación e unha base PostgreSQL. Non hai servizos de terceiros.

## Pasos

1. **Descargar e instalar.**

	```sh
	git clone https://github.com/isaay6/xogamos.git xogamos && cd xogamos
	./install.sh
	```

	O instalador pregunta o dominio e un correo de contacto, xera os segredos, arrinca os servizos
	e agarda a que a aplicación responda. Ao rematar di o enderezo.

2. **Comprobar.** Abra `https://o-seu-dominio/healthz`. Debe responder `{"ok":true}`.

3. **Conectar a identidade.** Complete no `.env` as variables `OIDC_...` de Cl@ve ou Chave365
	(ver [interoperabilidade](../interoperabilidade.md) e `deploy/keycloak/`) e reinicie:
	`docker compose up -d`.

4. **Crear a primeira persoa operadora.** É quen vai dar de alta os concellos.

	```sh
	docker compose exec app node scripts/create-operator.mjs \
	  --provider clave --subject 12345678Z --name "Nome Apelido"
	```

	O `subject` é o identificador co que esa persoa chega desde Cl@ve (o DNI ou NIE).

5. **Copias fóra do servidor.** As copias diarias gárdanse soas en `backups/`. Programe a súa
	copia a outro equipo co sistema que xa use a Deputación (`rsync`, almacenamento de rede...).

6. **Probar a restauración** unha vez antes de abrir ao público: [restaurar unha copia](restauracion.md).

7. **Asinar o encargo de tratamento** con cada concello: [modelo](../encargo-tratamento.md).

## Despois

- Altas de concellos: [dar de alta un concello](alta-concello.md).
- Actualizacións e volta atrás: [operación](../operacion.md).
- Vixilancia: engada `https://o-seu-dominio/healthz` ao sistema de monitorización da Deputación.

## Se algo falla

| Síntoma | Que mirar |
|---|---|
| O instalador non remata | `docker compose logs app`. O máis habitual: o dominio aínda non apunta ao servidor. |
| «Non seguro» no navegador | O certificado tarda un par de minutos. Os portos 80 e 443 deben estar abertos. |
| Os formularios dan erro 403 | `PUBLIC_ORIGIN` no `.env` debe ser exactamente o enderezo público, con `https://`. |
| Non entra ninguén | Revise as variables `OIDC_...` e que a persoa operadora estea creada (paso 4). |
