# plataforma-reservas

Plataforma libre de reserva de instalaciones deportivas municipais (nome de traballo: `plataforma-reservas`).

Proposta presentada ao **I Certame GOBTEC de Software Libre**. Licenza: **EUPL-1.2** (ver `LICENSE`).

Pila: SvelteKit + TypeScript. Requírese Node 22 (`.nvmrc`).

## Instalación

Para instalar a plataforma nun servidor municipal con Docker, consulte a guía de
[instalación](docs/instalacion.md).

## Scripts

- `npm run dev`: servidor de desenvolvemento.
- `npm run dev:demo`: desenvolvemento sen PostgreSQL: usa PGlite en memoria con datos de demostración e identidade simulada. Só para desenvolvemento.
- `npm run build`: compilación de produción.
- `npm test`: probas (Vitest).
- `npm run check`: comprobación de tipos (svelte-check).
- `npm run licenses`: verifica que as licenzas das dependencias de produción son permitidas.
- `npm run spdx`: verifica a cabeceira `SPDX-License-Identifier: EUPL-1.2` nos ficheiros fonte.

`dev:demo` fixa `IDENTITY_MODE=simulated` e un `AUTH_SECRET` só de desenvolvemento
(`dev-only-secret-not-for-production-000`); nunca os uses en produción. O modo simulado só admite
unha base desbotable: sen `DATABASE_URL` usa PGlite en desenvolvemento, ou cunha base demo aloxada
hai que fixar explicitamente `DEMO_DATABASE_IS_DISPOSABLE=1`.
`DEMO=1` tamén require `IDENTITY_MODE=simulated` e esa mesma base desbotable; se hai
`DATABASE_URL` sen o marcador, o servidor rexeita a configuración. O respaldo PGlite só se activa
con `vite dev` e sen `DATABASE_URL`; en produción esta variable segue sendo obrigatoria.

## Probar a demo

Con `npm run dev:demo` hai once concellos reais da provincia de Ourense, con escudo xenérico; o principal é Viana do Bolo (`/viana-do-bolo`). Instalacións, persoas (uns 1000 veciños) e reservas son ficticias. A historia (seis meses atrás e tres semanas adiante) xérase de forma determinista arredor do momento de arranque.
Entra co simulador de Cl@ve ou Chave365 e escolle unha identidade ficticia de «Persoas destacadas»:

- Veciñanza: Nerea Cabaleiro (Cl@ve), empadroada en Viana do Bolo.
- Conserxería de Viana do Bolo (`/viana-do-bolo/conserxeria`): Baltasar Gesto (Chave365).
- Administración de Viana do Bolo (`/viana-do-bolo/admin`): Amalia Carballal (Cl@ve).
- Deputación de Ourense (`/deputacion`): Celia Rivas (Cl@ve).

O persoal tamén chega á súa zona desde «Eu».

Para a busca por DNI do mostrador hai DNI ficticios, con letra válida (na base só se garda o seu hash, e só con `AUTH_SECRET`, que `dev:demo` xa fixa; están tamén en `DEMO_DNIS` de `src/lib/server/db/seed-people.ts`):

- Nerea Cabaleiro: `44556677L`.
- Hadrián Seixo Mouriño: `34987654P`. Vive en A Rúa, non está empadroado en Viana do Bolo e ten tarifa social. Con `34987645P` (dúas cifras trocadas) a busca suxire o bo.
- Olaia Pazó: `33221144J`.

En Viana do Bolo hai reservas de temporada de outubro a xuño, que ocupan a instalación e non se poden reservar: «CD Viana — adestramento» no Campo de fútbol As Carrelas (martes e xoves, 19:00–20:30) e a «Escola de baloncesto de Viana» no Pavillón polideportivo (martes e xoves, 17:30–19:00).
