# Interoperabilidade

A plataforma segue o Esquema Nacional de Interoperabilidade (ENI) en tres planos: identidade pública, API aberta e formatos estándar. Todo o código está baixo **EUPL-1.2**, a licenza da Comisión Europea, compatible coa reutilización entre administracións (art. 157 da Lei 40/2015).

## 1. Identidade dixital pública: Cl@ve e Chave365

**Como está deseñado.** A aplicación non xestiona contrasinais. A persoa identifícase sempre nun **provedor de identidade público** e a aplicación recibe o resultado por **OpenID Connect**, o estándar aberto máis usado para iso:

- fluxo de **código de autorización con PKCE** (S256), con `state` e `nonce`;
- descubrimento automático do provedor (`/.well-known/openid-configuration`);
- validación do **ID token**: sinatura coas claves públicas do provedor (JWKS), emisor, destinatario, caducidade e `nonce`. Só se aceptan RS256, ES256 e PS256;
- un provedor por separado para Cl@ve e para Chave365 (`OIDC_CLAVE_...` e `OIDC_CHAVE365_...`). Na pantalla de entrada só aparecen os configurados.

Código: `src/lib/server/auth/oidc.ts`. Probas: 22, cun provedor falso que cobre sinaturas falsas, tokens caducados ou doutro destinatario e intentos de reutilización.

**Cl@ve fala SAML 2.0.** Por iso o repositorio inclúe unha ponte lista con **Keycloak** (software libre): recibe a persoa desde Cl@ve por SAML e entrégalla á aplicación por OpenID Connect. Está en [`deploy/keycloak/`](../deploy/keycloak/README.md), cun «Cl@ve simulado» que emite os mesmos atributos (`PersonIdentifier`, `FirstName`, `FamilyName`). O percorrido enteiro está **probado**: aplicación → Keycloak → Cl@ve simulado → sesión aberta. Se o provedor xa ofrece OpenID Connect, Keycloak non fai falta.

**Que falta para a integración real.** A alta administrativa, que só pode pedir unha administración:

1. **Cl@ve:** alta como entidade usuaria ante a Secretaría Xeral de Administración Dixital. Cos metadatos que entrega, cámbianse tres valores en Keycloak (ver a guía). **A aplicación non se toca.**
2. **Chave365:** alta ante a AMTEGA, co protocolo que indique a Xunta.
3. **Proba en preprodución.**

Estímase en 4–8 semanas, polos prazos de alta. É o **primeiro paso do piloto**.

**Demo.** O simulador de Cl@ve e Chave365 con identidades ficticias mantense só para demostracións (`IDENTITY_MODE=simulated`). A aplicación rexeita arrincar con el sobre unha base de datos real.

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
