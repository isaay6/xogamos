# Soporte e incidencias

**Para quen:** o persoal do concello e o servizo de informática.

## A quen acudir

| Que pasa | Quen o resolve | Como |
|---|---|---|
| Unha veciña non sabe reservar ou non ten Cl@ve | Conserxería | Reserva por teléfono no seu nome |
| Hai que cambiar un horario, un prezo ou unha norma | Administración do concello | Panel de administración |
| Alguén pide os seus datos ou borrar a conta | Administración do concello | A persoa pode facelo soa en «Os meus datos»; ver [RXPD](../rgpd.md) |
| A páxina non carga ou vai lenta | Informática da Deputación | [Diagnóstico](#diagnóstico-rápido) |
| Perdéronse datos | Informática da Deputación | [Restaurar unha copia](restauracion.md) |
| A aplicación fai algo mal | Proxecto Xogamos | Incidencia no repositorio, coa plantilla «Erro» |
| Falta unha función | Proxecto Xogamos | Incidencia coa plantilla «Mellora» |
| Un problema de seguridade | Proxecto Xogamos | **Nunca en público:** [SECURITY.md](../../SECURITY.md) |

## Diagnóstico rápido

```sh
docker compose ps                 # todos os servizos deben estar «healthy»
curl -fsS http://127.0.0.1:3000/healthz
docker compose logs --tail=100 app
df -h                             # o disco non debe estar cheo
ls -lh backups/ | tail -3         # a última copia debe ser de hoxe
```

| Síntoma | Causa habitual | Solución |
|---|---|---|
| `app` reinicia sen parar | Unha variable do `.env` falta ou está mal | O rexistro di cal; corríxaa e `docker compose up -d` |
| Erro 502 | A aplicación está arrincando ou parada | `docker compose up -d` e agardar 30 segundos |
| Non chegan os correos | `SMTP_URL` baleira ou incorrecta | Os avisos seguen chegando dentro da aplicación |
| Non hai copia de hoxe | O servizo `backup` está parado ou o disco cheo | `docker compose logs backup` |

## Que incluír nunha incidencia

1. Que facía a persoa e que esperaba.
2. O papel (veciñanza, conserxería, administración...).
3. A hora aproximada.
4. A versión (`CHANGELOG.md` ou a etiqueta da imaxe).
5. Unha captura **sen datos persoais**.

## Prazos do proxecto

| Tipo | Resposta | Corrección |
|---|---|---|
| Seguridade grave | 3 días hábiles | Canto antes; aviso previo ás instalacións coñecidas |
| Non se pode reservar ou xestionar | 3 días hábiles | Na seguinte versión de corrección |
| Outros erros e melloras | 10 días hábiles | Segundo a [folla de ruta](../folla-de-ruta.md) |

Estes prazos son os do compromiso de [gobernanza](../../GOBERNANZA.md) durante o ano de piloto. Un
concello que necesite prazos máis curtos pode contratalos con calquera empresa.
