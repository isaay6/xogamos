# Interoperabilidade

A plataforma segue o Esquema Nacional de Interoperabilidade (ENI) en tres planos: identidade pública, API aberta e formatos estándar. Todo o código está baixo **EUPL-1.2**, a licenza da Comisión Europea, compatible coa reutilización entre administracións (art. 157 da Lei 40/2015).

## 1. Identidade dixital pública: Cl@ve e Chave365

**Como está deseñado.** A aplicación non xestiona contrasinais. O acceso faise sempre a través dun **provedor de identidade público**: Cl@ve, da AGE, ou Chave365, da Xunta. O provedor autentica a persoa e entrega á aplicación unha **aserción asinada** (HMAC-SHA256, válida 120 segundos) con:

- o provedor;
- un identificador estable;
- o nome;
- o correo, se o hai.

A aplicación só confía nesa aserción (`src/lib/server/auth/assertion.ts`).

**Que hai hoxe.** Un **simulador** de Cl@ve e Chave365 que xera exactamente esa aserción con identidades ficticias. Só funciona cunha base de datos de demostración (`IDENTITY_MODE=simulated`), e a aplicación rexeita arrincar se se intenta usar con datos reais.

**Que falta para a integración real.** É un trámite administrativo, non un cambio de deseño:

1. **Cl@ve:** o concello ou a Deputación dáse de alta como entidade usuaria ante a Secretaría Xeral de Administración Dixital. A conexión faise co protocolo SAML 2.0 da pasarela Cl@ve, a través dun pequeno servizo intermedio que, tras a autenticación, emite a mesma aserción.
2. **Chave365:** alta ante a AMTEGA, co protocolo que indique a Xunta. O resultado é tamén a mesma aserción.
3. **Proba en preprodución** cos certificados de cada provedor.

Estímase en 4–8 semanas, sobre todo polos prazos de alta. É o **primeiro paso do piloto** (ver a memoria).

Persoas sen identidade dixital: a conserxería pode darlles de alta e reservar no seu nome por teléfono ou en persoa. Ese acceso queda identificado pola busca por DNI (só se garda o seu hash).

## 2. API aberta (REST + OpenAPI 3.1)

- **Descrición:** `GET /api/v1/openapi.json`, xerada desde os mesmos esquemas que validan as peticións, polo que non pode desactualizarse.
- **46 rutas e 56 operacións** en `/api/v1`, agrupadas por concello (`/api/v1/m/{concello}/...`):

| Grupo | Exemplos | Acceso |
|---|---|---|
| Público | concellos, deportes, instalacións, dispoñibilidade, busca | Libre |
| Datos abertos | `open-data/occupancy?week=AAAA-MM-DD` (ocupación por día e instalación) | Libre, con CORS `*` |
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
| **PDF / impresión** | Folla do día da conserxería e xustificantes, desde o propio navegador |

## 4. Multi-concello e Deputación

- Unha soa instalación pode servir a **varios concellos** cos seus datos separados. A Deputación pode aloxala para os concellos pequenos.
- A identidade é común a todos: a mesma persoa reserva en varios concellos coa mesma conta, pero cada concello só ve o seu historial.

## 5. Reutilización

- Código en repositorio público con licenza EUPL-1.2. Preparado para publicarse no **Centro de Transferencia de Tecnoloxía** (CTT) e no repositorio da Xunta.
- Instalación con Docker en menos dunha hora (`docs/instalacion.md`).
- Só dependencias de software libre, comprobadas automaticamente con `npm run licenses`.
