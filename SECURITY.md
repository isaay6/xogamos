# Política de seguridade

## Versións con soporte

| Versión | Soporte |
|---|---|
| 0.x (rama `main`) | Si: correccións de seguridade |

Mentres o proxecto estea na versión 0, só se manteñen correccións na última versión publicada.

## Como informar dunha vulnerabilidade

**Non abras unha incidencia pública.** Escribe a **isay6rodfidal@gmail.com** con:

- unha descrición do problema e do seu impacto;
- os pasos para reproducilo (versión, configuración, petición);
- se o sabes, unha proposta de corrección.

Compromisos:

- **Acuse de recibo** en 3 días hábiles.
- **Primeira valoración** (gravidade e plan) en 10 días hábiles.
- **Corrección** das vulnerabilidades graves canto antes, e aviso ás instalacións coñecidas antes da publicación.
- **Recoñecemento** de quen informou no `CHANGELOG.md`, se o desexa.

## Alcance

Dentro: o código deste repositorio e a configuración de despregamento que se distribúe (`Dockerfile`,
`compose.yml`, `.env.example`).

Fóra: as instalacións de terceiros (cada concello ou Deputación é responsable da súa) e os ataques
que requiren acceso físico ao servidor ou credenciais de administración.

## Medidas que xa aplica a plataforma

Ver [docs/seguridade.md](docs/seguridade.md).
