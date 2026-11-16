# Interoperabilidade

A plataforma segue o Esquema Nacional de Interoperabilidade (ENI) en tres planos: identidade pública, API aberta e formatos estándar. Todo o código está baixo **EUPL-1.2**, a licenza da Comisión Europea, compatible coa reutilización entre administracións (art. 157 da Lei 40/2015).

## 1. Identidade dixital pública: Cl@ve e Chave365

**Como está deseñado.** A aplicación non xestiona contrasinais. A integración real usa OpenID Connect, fluxo Authorization Code con PKCE S256: comproba a sinatura, emisor, audiencia, caducidade e `nonce` do ID token antes de abrir sesión. Configúrase por provedor mediante `OIDC_CLAVE_*` ou `OIDC_CHAVE365_*`.

**Cl@ve e Chave365.** Keycloak pode actuar opcionalmente como broker SAML 2.0 de Cl@ve e publicar OIDC para a aplicación. A alta administrativa ante AGE ou Xunta, os metadatos, certificados e as probas de preprodución seguen sendo necesarios; a persoa operadora debe mapear o DNI/NIE ao claim de suxeito estable.

**Demo.** O simulador mantense só para demostración (`IDENTITY_MODE=simulated` e base desbotable). É o único camiño que usa a aserción HMAC de `src/lib/server/auth/assertion.ts`; non forma parte da integración OIDC real.

Persoas sen identidade dixital: a conserxería pode darlles de alta e reservar no seu nome por teléfono ou en persoa. Ese acceso queda identificado pola busca por DNI (só se garda o seu hash).

## 2. API aberta (REST + OpenAPI 3.1)

- **Descrición:** `GET /api/v1/openapi.json`, xerada desde os mesmos esquemas que validan as peticións, polo que non pode desactualizarse.
- **46 rutas e 56 operacións** en `/api/v1`, agrupadas por concello (`/api/v1/m/{concello}/...`):

| Grupo | Exemplos | Acceso |
|---|---|---|
| Público | concellos, deportes, instalacións, dispoñibilidade, busca | Libre |
| Datos abertos | `open-data/occupancy?week=AAAA-MM-DD` (ocupación por día e instalación) e `open-data/facilities.geojson` (instalacións activas con coordenadas WGS84) | Libre, con CORS `*` |
| Persoa | as miñas reservas, reservar, cancelar, cambiar, resumo, calendario `.ics` | Sesión |
| Conserxería | axenda, persoas, reservas por teléfono, validar PIN/QR, asistencia e faltas | Persoal |
| Administración | instalacións, horarios, peches, persoal, empadroamento, indicadores, exportacións | Administración |
| Deputación | comparativa de concellos | Deputación |

- **Erros uniformes:** un JSON co código de erro e os campos que fallaron.
- **Versionado na ruta** (`/v1`): os cambios incompatibles irán en `/v2`.

## 3. Formatos estándar

| Formato | Uso |
|---|---|
| **iCalendar (.ics, RFC 5545)** | Calendario persoal de reservas e exportación da axenda do concello. Pódese subscribir desde Google, Apple ou Outlook |
| **CSV (RFC 4180)** | Indicadores e táboas para análise ou para o portal de datos abertos |
| **XLSX (Office Open XML, ISO/IEC 29500)** | Exportación completa para a intervención ou o servizo de deportes |
| **JSON** | API e descarga dos datos persoais (portabilidade, art. 20 RXPD) |
| **GeoJSON (RFC 7946)** | Instalacións activas xeorreferenciadas, para mapas e portais de datos abertos |
| **JSON-LD / Turtle (DCAT-AP-ES)** | Catálogo de conxuntos abertos: `/api/v1/open-data/catalog.jsonld` e `/api/v1/open-data/catalog.ttl` |
| **PDF / impresión** | Folla do día da conserxería e xustificantes, desde o propio navegador |

## 4. Multi-concello e Deputación

## Catálogo e portabilidade de configuración

O catálogo DCAT-AP-ES publícase en `/api/v1/open-data/catalog.jsonld` e tamén en Turtle. Describe por concello os conxuntos de instalacións e ocupación, co tema de deporte do NTI, licenza EUPL ou CC-BY 4.0 e idiomas galego e castelán. Non inclúe persoas nin reservas identificables.

As persoas administradoras poden descargar a configuración dun concello no formato versionado `plataforma-reservas/export` v1. A importación crea sempre un concello novo e só restaura configuración: instalacións, tipos, horarios, peches e festivos; nunca persoas, perfís nin reservas.

- Unha soa instalación pode servir a **varios concellos** cos seus datos separados. A Deputación pode aloxala para os concellos pequenos.
- A identidade é común a todos: a mesma persoa reserva en varios concellos coa mesma conta, pero cada concello só ve o seu historial.

## 5. Reutilización

- Código en repositorio público con licenza EUPL-1.2. Preparado para publicarse no **Centro de Transferencia de Tecnoloxía** (CTT) e no repositorio da Xunta.
- Instalación con Docker en menos dunha hora (`docs/instalacion.md`).
- Só dependencias de software libre, comprobadas automaticamente con `npm run licenses`.
