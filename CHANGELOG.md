# Rexistro de cambios

Formato baseado en [Keep a Changelog](https://keepachangelog.com/gl/1.1.0/). Versións segundo
[Semantic Versioning](https://semver.org/lang/es/). Mentres sexa 0.x, calquera versión menor pode
incluír cambios incompatibles, que se indican aquí.

## Sen publicar

- Instalación nun comando, imaxe publicada, proxy HTTPS, copias automáticas verificadas e actualización con volta atrás.

## [0.1.0] — 2026-11 (proposta ao I Certame GOBTEC)

Primeira versión completa, con datos ficticios.

### Veciñanza
- Reserva en liña por deporte e hora libre, Reserva fácil, cambio e cancelación ata o prazo do concello.
- PIN de 4 cifras e QR asinado por reserva; historial, racha de semanas activas e avisos.
- Monedeiro, bonos e abonos; tarifa de empadroados e tarifa social.
- Torneos con inscrición, solicitudes de horas fixas e eventos, conta de club.
- Lista de espera nas horas completas (a praza gárdase 30 min á primeira da cola) e horas libres suxeridas cando un día está cheo.
- Calendario iCalendar, descarga dos datos propios, borrado da conta.
- Axustes de accesibilidade (letra, contraste, movemento), galego e castelán, PWA con pantalla sen conexión.

### Concello
- Instalacións con asistente, modelos, fotos, unidades, prezos e ficha de accesibilidade.
- Horarios, festivos, peches con aviso, normas, faltas e penalizacións.
- Tempadas e clubs con condicións propias; criterios de prioridade publicados.
- Conserxería: axenda, asistencia, validación PIN/QR, reserva por teléfono, folla do día, tarxetas de recarga.
- Papel «Apertura» para quen abre as instalacións.
- Indicadores, informe mensual, exportacións CSV, XLSX e iCalendar, rexistro de actividade.

### Deputación
- Multi-concello nunha soa instalación, alta de concellos e comparativa agregada.
- Importación da configuración dun concello desde a súa exportación.

### Plataforma
- Datos abertos: catálogo DCAT-AP-ES (JSON-LD e Turtle), GeoJSON das instalacións e schema.org JSON-LD en cada ficha.
- Documentación lexible da API en `/api/docs`, xerada do OpenAPI.
- Batería de accesibilidade (axe-core) en 48 pantallas e dous anchos, na CI.
- API REST `/api/v1` con OpenAPI 3.1 e datos abertos de ocupación.
- Identidade só a través de Cl@ve e Chave365 (simulador para a demo).
- OIDC Authorization Code con PKCE e Keycloak opcional como broker SAML para Cl@ve.
- Seguridade: CSP con *nonce*, HSTS, límite de peticións, sesións con hash e borrado automático de datos vellos.
- Despregamento con Docker Compose, migracións automáticas, copias e comprobación de saúde.
- Integración continua: tipos, probas, compilación, SPDX e licenzas.
