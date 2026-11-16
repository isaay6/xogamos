# Arquitectura e decisións

## Visión xeral

```
 Navegador (móbil ou PC)            Proxy HTTPS (Caddy / nginx)
 SvelteKit SSR + mellora progresiva ─────────────► Aplicación Node 22 (adapter-node)
 Service worker (sen conexión)                       │  rutas web + API REST /api/v1
                                                     │  servizos de dominio (TypeScript)
                                                     │  traballos: lembranzas, correo, conservación
                                                     ▼
                                                 PostgreSQL 17 (Drizzle ORM, migracións SQL)
```

**Capas do código:**

- `src/routes/`: pantallas e API. Só validan a entrada, comproban permisos e chaman aos servizos.
- `src/lib/server/services/`: casos de uso (reservar, cancelar, solicitudes, torneos, monedeiro...). Cada un devolve un `Result` explícito, sen excepcións.
- `src/lib/server/domain/`: regras puras sen base de datos (franxas, prezos, políticas, PIN, quendas). Son fáciles de probar.
- `src/lib/server/db/`: esquema, migracións e datos de demostración.

**Calidade:**

- 1.381 probas automáticas (Vitest con PostgreSQL en memoria, PGlite) e unha batería de accesibilidade no navegador (Playwright + axe-core);
- comprobación de tipos estrita;
- comprobación de licenzas e cabeceiras SPDX en cada cambio.

## Decisións (ADR breves)

### ADR-1 · SvelteKit con renderizado no servidor

- **Contexto:** veciñanza con móbiles modestos e conexións rurais, e persoal en PCs municipais antigos.
- **Decisión:** SvelteKit (Svelte 5) con renderizado no servidor e formularios que funcionan **sen JavaScript**. O JavaScript só mellora a experiencia.
- **Consecuencias:** páxinas lixeiras e accesibles por defecto, e un único proxecto para a web e a API. Hai que coidar que cada acción teña a súa versión con formulario.

### ADR-2 · PostgreSQL e integridade na base de datos

- **Contexto:** dúas persoas non poden reservar a mesma pista á mesma hora, e o monedeiro debe cadrar sempre.
- **Decisión:** PostgreSQL con restricións (`CHECK`, `UNIQUE`, claves foráneas compostas por concello) e bloqueos por instalación nas operacións que compiten: reservar, cambiar horarios, peches e aprobar solicitudes.
- **Consecuencias:** a regra cúmprese aínda que falle o código. Migracións SQL versionadas que se aplican soas ao arrincar.

### ADR-3 · Multi-concello nunha soa instalación

- **Contexto:** os concellos pequenos non teñen servizo de informática. A Deputación si pode aloxar a plataforma.
- **Decisión:** cada dato leva o seu concello, e as rutas van por concello (`/viana-do-bolo/...`). A identidade é común, e o perfil e o historial son de cada concello.
- **Consecuencias:** unha instalación serve a toda a provincia, e un concello grande tamén pode ter a súa propia instalación.

### ADR-4 · Identidade só a través de provedores públicos

- **Contexto:** o RXPD e a seguridade desaconsellan gardar contrasinais. A cidadanía xa ten Cl@ve ou Chave365.
- **Decisión:** a aplicación só acepta unha aserción asinada do provedor. Non hai contrasinais propios. O DNI só se garda como HMAC.
- **Consecuencias:** menos risco e menos soporte. A integración real require a alta administrativa (ver `interoperabilidade.md`).

### ADR-5 · Acceso con PIN e QR, sen pechaduras electrónicas

- **Contexto:** en Viana do Bolo, para xogar fóra do horario do persoal hai que chamar á Policía Local.
- **Decisión:** cada reserva ten un PIN de 4 cifras e un QR asinado. Hai un papel «Apertura» para quen abre (Policía Local ou outro persoal), que recibe un aviso e ve só a axenda e o validador.
- **Consecuencias:** o sistema funciona hoxe sen obras. As pechaduras electrónicas quedan como ampliación para concellos con máis uso, e reutilizan o mesmo PIN.

### ADR-6 · Simulador de identidade e datos ficticios illados

- **Contexto:** é preciso amosar a plataforma ao xurado sen datos reais nin altas en Cl@ve.
- **Decisión:** o modo demo (`DEMO=1`, `IDENTITY_MODE=simulated`) só arrinca cunha base marcada como desbotable. Os datos son inventados e deterministas.
- **Consecuencias:** a demo non se pode activar por erro nunha instalación real.

### ADR-7 · Seguridade por defecto

- **Decisión:**
  - CSP con _nonce_, HSTS, `nosniff`, Referrer-Policy e Permissions-Policy (cámara só para o lector QR);
  - límite de peticións por IP e tipo;
  - corpo máximo de 512 KB;
  - sesións co token en hash e cookies `HttpOnly`, `Secure` e `SameSite`;
  - rexistro de actividade do persoal;
  - a aplicación só escoita en `127.0.0.1`, detrás do proxy HTTPS.
- **Consecuencias:** alineado coa categoría básica do ENS. O límite de peticións é por proceso: con varias réplicas haberá que levalo ao proxy.

### ADR-8 · Software libre e dependencias mínimas

- **Decisión:** licenza EUPL-1.2 e unha lista curta de dependencias de produción (SvelteKit, Drizzle, postgres, zod, date-fns, nodemailer, xeración e lectura de QR, tipografía Gabarito con licenza OFL). As licenzas compróbanse automaticamente.
- **Consecuencias:** sen custos de licenza e sen dependencia dun provedor. Calquera empresa galega pode mantela.

## Límites coñecidos (folla de ruta)

A folla de ruta completa e ordenada está en [folla-de-ruta.md](folla-de-ruta.md).

- Integración real con Cl@ve e Chave365 (trámite de alta).
- Anonimización automática de reservas antigas.
- Proba con lectores de pantalla.
- Pagamento con tarxeta: hoxe o monedeiro recárgase na conserxería.
- Cadros e resultados dos torneos.
- Pechaduras electrónicas.
