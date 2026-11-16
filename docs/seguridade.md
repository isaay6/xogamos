# Seguridade

Medidas técnicas da plataforma e a súa correspondencia orientativa co **Esquema Nacional de
Seguridade** (RD 311/2022), categoría **básica**. **Non é unha declaración de conformidade:** esta
corresponde á entidade que opera a instalación (concello ou Deputación), que debe completar as
medidas organizativas (política, persoas responsables, formación, xestión de incidentes).

## 1. Medidas que xa inclúe o produto

| Ámbito | Medida | Onde |
|---|---|---|
| Identificación | Sen contrasinais propios: OIDC Authorization Code con PKCE, validación de JWT; o HMAC queda só no simulador | `src/lib/server/auth/` |
| Sesións | Token aleatorio; na base só se garda o seu hash SHA-256. Cookie `HttpOnly`, `Secure` e `SameSite`. Caducan aos 30 días sen uso e bórranse cada día | `services/sessions.ts`, `jobs/retention.ts` |
| Autorización | Papeis por concello (administración, conserxería, apertura, Deputación), comprobados no servidor en cada ruta e operación da API | `routes/[slug]/admin/guard.ts` e equivalentes |
| Separación de datos | Cada fila leva o seu concello; claves foráneas compostas por concello impiden mesturar datos | `db/schema.ts` |
| Integridade | Restricións e bloqueos por instalación na base de datos: non pode haber dúas reservas da mesma pista á mesma hora, e o saldo do monedeiro cadra sempre | ADR-2 en `arquitectura.md` |
| Datos persoais | DNI só como HMAC (non se pode ler); QR das reservas asinado; sen categorías especiais de datos | `rgpd.md` |
| Navegador | CSP con *nonce*, HSTS en HTTPS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (cámara só para o lector QR), COOP | `src/hooks.server.ts`, `http/security-headers.ts` |
| Abuso | Límite de peticións por IP e tipo (identidade 10/min, escrituras 60/min, API 120/min); corpo máximo de 512 KB | `http/rate-limit.ts`, `compose.yml` |
| Exposición | A aplicación só escoita en `127.0.0.1`, detrás dun proxy HTTPS; corre como usuario sen privilexios no contedor | `compose.yml`, `Dockerfile` |
| Trazabilidade | Rexistro de actividade de todas as accións do persoal, co autor e a data | `services/activity-log.ts` |
| Conservación | Borrado automático diario de sesións caducadas, correos de máis de 30 días e avisos lidos de máis dun ano | `jobs/retention.ts` |
| Copias | Scripts de copia e restauración de PostgreSQL (`pg_dump` en formato personalizado) | `scripts/backup.sh`, `scripts/restore.sh` |
| Demo illada | O modo demostración só arrinca cunha base marcada como desbotable | ADR-6 |
| Cadea de subministración | Só dependencias libres dunha lista permitida e cabeceira SPDX en cada ficheiro, comprobadas na integración continua | `.github/workflows/ci.yml` |

## 2. Correspondencia orientativa co ENS (categoría básica)

| Medida ENS | Achega do produto | Queda para a entidade operadora |
|---|---|---|
| op.acc (control de acceso) | Identidade pública, papeis por concello, sesións seguras | Altas e baixas do persoal; revisión periódica de permisos |
| op.exp.8 / op.exp.10 (rexistro de actividade) | Rexistro das accións do persoal | Revisalo e conservalo segundo a súa política |
| op.cont (continuidade) | Scripts de copia e restauración | Programar copias diarias fóra do servidor e probar a restauración |
| mp.com (comunicacións) | HTTPS obrigatorio detrás do proxy; HSTS | Certificado e configuración do proxy |
| mp.info (información) | Minimización, DNI en HMAC, borrado automático | Clasificación da información e prazos propios |
| mp.sw (software) | Código aberto, probas automáticas, dependencias controladas | Aplicar as actualizacións de seguridade |
| op.exp.7 (incidentes) | Política de vulnerabilidades (`SECURITY.md`) | Procedemento interno e notificación á AEPD/CCN-CERT se procede |

## 3. Límites coñecidos

- O límite de peticións é por proceso: con varias réplicas hai que levalo ao proxy.
- Non houbo aínda unha auditoría de seguridade independente: está prevista antes de tratar datos reais (fase 1 do piloto).
- A integración real con Cl@ve e Chave365 require a alta administrativa (ver `interoperabilidade.md`).

## Análise automática en cada cambio

O fluxo `Seguridade` da integración continua (`.github/workflows/seguridade.yml`) execútase en cada cambio e cada luns:

| Que | Ferramenta | Falla se |
|---|---|---|
| Dependencias de produción | `npm audit` | hai unha vulnerabilidade alta ou crítica |
| Imaxe Docker (sistema e bibliotecas) | Trivy | hai unha alta ou crítica con corrección dispoñible |
| Código | CodeQL | (informa na pestana de seguridade do repositorio) |

A imaxe de produción non leva `npm` nin ferramentas de compilación, e execútase cun usuario sen privilexios.

