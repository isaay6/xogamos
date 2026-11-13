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

```bash
./scripts/backup.sh                      # 1. copia antes de nada
git fetch --tags && git checkout vX.Y.Z  # 2. versión nova (ver CHANGELOG.md)
docker compose build app                 # 3. construír a imaxe
docker compose up -d app                 # 4. arrinca; as migracións aplícanse soas
curl -fsS http://127.0.0.1:${APP_PORT:-3000}/healthz   # 5. debe responder {"ok":true}
```

As migracións só engaden cambios e aplícanse en orde ao arrincar. Se fallan, a aplicación non
arrinca e a base queda como estaba.

## 3. Reverter

Se a versión nova dá problemas:

```bash
git checkout vANTERIOR
./scripts/restore.sh backups/<copia-de-antes>.dump   # volve ao estado previo á actualización
docker compose build app && docker compose up -d app
```

Restaurar a copia é necesario porque as migracións non se desfán. As reservas feitas despois da
copia pérdense: por iso convén actualizar fóra de horas.

## 4. Copias

- **Diarias** con `scripts/backup.sh` (por exemplo, nun `cron` ás 03:00), gardadas **fóra do servidor**.
- **Proba de restauración** trimestral nunha máquina á parte.
- Conservación recomendada: 7 diarias, 4 semanais e 12 mensuais.

## 5. Vixilancia

- `GET /healthz` responde 200 se a aplicación e a base están ben (o `compose.yml` xa o usa como *healthcheck*).
- Rexistros: `docker compose logs app`. Os traballos diarios (lembranzas, conservación) avisan alí se fallan.

## 6. Soporte

| Nivel | Quen | Exemplos |
|---|---|---|
| 1 | Conserxería e administración do concello | Dúbidas da veciñanza, reservas por teléfono |
| 2 | Técnico da Deputación ou do encargado | Caídas, copias, actualizacións |
| 3 | Proxecto Xogamos (incidencias no repositorio) | Erros do software e melloras |
