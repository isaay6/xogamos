# Cumprimento das bases do I Certame GOBTEC

Cada requisito das bases (v3, punto 1), **onde se pode comprobar** (pantalla da demo, código ou
proba automática) e **que falta**. Estados: ✅ cumprido e demostrable · 🟡 parcial, co límite indicado.

Rutas relativas a un concello da demo, por exemplo `/viana-do-bolo`. Código en `src/`, probas en
ficheiros `*.test.ts` xunto ao código.

## 1.1 Alcance funcional mínimo

| ID | Requisito | Estado | Onde se comproba | Límite |
|---|---|---|---|---|
| C1 | Consulta de instalacións | ✅ | Inicio por deportes, ficha con fotos, prezos, normas e accesibilidade (`/[slug]/reservar/[id]`); busca (`services/search.ts`) | Sen mapa (folla de ruta) |
| C2 | Reserva en liña | ✅ | Reserva e Reserva fácil; PIN e QR (`/[slug]/reserva/[id]`); `services/bookings.ts`, `bookings.test.ts` | |
| C3 | Modificación e cancelación | ✅ | «As miñas reservas»; prazo do concello; `booking-lifecycle.test.ts` | |
| C4 | Historial e avisos | ✅ | `/[slug]/eu/historial`, `/[slug]/avisos`; correo opcional con consentimento; `notifications.test.ts` | Sen notificacións push (folla de ruta) |
| M1 | Alta e mantemento de instalacións | ✅ | `/[slug]/admin/instalacions` (asistente, modelos, CSV, fotos, unidades); `instalacions.test.ts` | |
| M2 | Horarios e normas de uso | ✅ | `/[slug]/admin/horarios`, `/admin/normas`, `/admin/temporadas`; `horarios.test.ts`, `temporadas.test.ts` | |
| M3 | Información e indicadores | ✅ | `/[slug]/admin` (resumo), `/admin/informe`, `/admin/exportar`; `indicators.test.ts`, `informe.test.ts` | |
| R1 | Replicable e configurable | ✅ | Todo se configura desde administración; nada específico dun concello no código; instalación con Docker (`docs/instalacion.md`) | |
| R2 | Escalable | ✅ | Unha instalación serve a moitos concellos; PostgreSQL con índices e bloqueos por instalación (ADR-2, ADR-3) | Límite de peticións por proceso (ver `seguridade.md`) |
| R3 | Multi-municipio | ✅ | 11 concellos na demo; `/deputacion` (comparativa e alta de concellos); `services/deputacion.ts` | |

## 1.2 Condicionantes técnicos obrigatorios

| ID | Requisito | Estado | Onde se comproba | Límite |
|---|---|---|---|---|
| T1 | Software libre | ✅ | Licenza **EUPL-1.2** (`LICENSE`); SPDX en cada ficheiro (`npm run spdx`); dependencias só de licenzas permitidas (`npm run licenses`); ambas na CI | |
| T2 | Web, responsive e modular | ✅ | Desde 320 px; formularios sen JavaScript; capas rutas → servizos → dominio (`docs/arquitectura.md`); API REST | |
| T3 | Autenticación pública e estándares abertos | 🟡 | Identidade só por aserción asinada de Cl@ve ou Chave365 (`auth/assertion.ts`, `assertion.test.ts`); OpenAPI 3.1 (`/api/v1/openapi.json`), iCalendar, CSV, XLSX, JSON (`docs/interoperabilidade.md`) | **Cl@ve e Chave365 simulados**: a alta real é a fase 1 do piloto |
| T4 | RXPD e xestión segura de usuarios | ✅ | Sen contrasinais; DNI en HMAC; sesións con hash; descarga e **borrado da conta**; conservación automática; rexistro de actividade (`docs/rgpd.md`, `docs/seguridade.md`, `docs/encargo-tratamento.md`) | Sen auditoría independente aínda |
| T5 | WCAG 2.1 AA (RD 1112/2018, EN 301 549) | 🟡 | axe-core en 50 pantallas, 320 px, letra moi grande e alto contraste, teclado; matriz e declaración (`docs/accesibilidade.md`) | **Parcialmente conforme**: falta a proba con lectores de pantalla (1.4.12 e 4.1.3) |

## 1.3 Aspectos valorables

| Aspecto | Estado | Onde se comproba |
|---|---|---|
| App móbil | ✅ | PWA instalable con pantalla sen conexión e menú inferior (`src/service-worker.ts`) |
| Calendarios persoais | ✅ | Subscrición iCalendar desde «As miñas reservas» |
| Accesos con QR | ✅ | PIN e QR asinado; lector na conserxería (`/conserxeria/validar`); papel «Apertura» (`apertura.test.ts`) |
| Analítica de uso | ✅ | Indicadores, informe mensual, comparativa provincial, datos abertos de ocupación (`/api/v1/m/{concello}/open-data/occupancy`) |
| Recomendación horaria | ✅ | Primeira hora libre de cada deporte no inicio e na Reserva fácil (`services/home.ts`) |

## Calidade

- **Probas automáticas** con PostgreSQL en memoria (PGlite): `npm test`.
- **Integración continua** (`.github/workflows/ci.yml`): tipos, probas, compilación, SPDX e licenzas en cada cambio.
