# Accesibilidade (WCAG 2.1 AA, UNE-EN 301 549, RD 1112/2018)

## 1. Como se comprobou (8 de novembro de 2026)

| Proba | Alcance | Resultado |
|---|---|---|
| **Batería automática na CI** (Playwright + axe-core 4.10, WCAG 2.0/2.1 A e AA), desde o 14 de novembro de 2026 | 48 pantallas dos catro papeis e públicas, en escritorio (1280 px) e a **320 px**, en cada cambio (`npm run test:a11y`) | 0 incidencias e sen desprazamento horizontal. Corrixíronse 9 desbordamentos a 320 px e as táboas desprazables fixéronse enfocables co teclado |
| Auditoría automática con **axe-core 4.10** (regras WCAG 2.0/2.1 A e AA) | 50 pantallas dos catro papeis: veciñanza, conserxería, administración e Deputación, ademais das públicas (demo, entrada, privacidade, sen conexión) | 5 incidencias en 4 pantallas e no percorrido da demo, todas corrixidas (apartado 3) |
| Ancho de **320 px** (reflow, 1.4.10) | Inicio, reserva, ficha de reserva, historial, torneo | Sen desprazamento horizontal da páxina. As filas de días e as tarxetas desprázanse dentro do seu propio bloque |
| **Letra moi grande** e **alto contraste** (axustes propios da app) | Inicio a 320 px, nas tres combinacións | Sen incidencias de axe nin desbordamento |
| **Teclado** | Navegación con Tab | Ligazón «Saltar ao contido» como primeiro elemento; foco visible (contorno sólido de 3 px) |
| Lector de pantalla | — | **Pendente**: proba con NVDA (Windows) e VoiceOver (iOS) antes do piloto |

## 2. Medidas propias de deseño

- **Axustes de accesibilidade por persoa**, gardados na súa conta e aplicados antes de pintar a páxina: tamaño de letra (normal, grande e moi grande), alto contraste e movemento reducido (sistema, sempre ou nunca).
- **Reserva fácil**: un percorrido de reserva con menos pasos e botóns grandes.
- **Ficha de accesibilidade de cada instalación** (accesos, vestiarios adaptados...), visible antes de reservar.
- **Dúas linguas**, galego e castelán, con `lang` correcto en cada páxina.
- **Sen dependencia da cor**: os estados (libre, ocupado, pechado) levan sempre texto.
- **Canles alternativas**: a conserxería pode reservar por teléfono ou en persoa en nome de quen non use a web.
- **Validación con PIN ou QR**: o acceso non depende só dunha cámara nin dun móbil.

## 3. Incidencias atopadas e corrixidas

| # | Criterio | Pantalla | Problema | Arranxo |
|---|---|---|---|---|
| 1 | 1.4.3 Contraste | Historial | Etiqueta de estado con contraste inferior a 4,5:1 | Cores do tema axustadas |
| 2 | 4.1.2 Nome, función e valor | Informe do mes | `aria-label` en barras sen función | `role="img"` |
| 3 | 1.3.1 / 4.1.2 | Rexistro da Deputación | Selector de concello sen nome | Etiqueta visible |
| 4 | 2.4.2 Títulos | 4 pantallas | Título xenérico («Viana do Bolo») | Título «Pantalla · Concello» |
| 5 | 2.4.3 / 1.4.10 | Percorrido guiado da demo | A tarxeta tapaba o contido no móbil e o foco quedaba detrás | Tarxeta opaca, diálogo con xestión do foco e Escape |

## 4. Matriz de cumprimento WCAG 2.1 AA

C = cumpre · N/A = non aplica · P = pendente de verificación manual

| Criterio | Nivel | Estado | Como |
|---|---|---|---|
| 1.1.1 Contido non textual | A | C | Textos alternativos; ilustracións decorativas con `alt=""` |
| 1.2.x Multimedia | A/AA | N/A | Non hai vídeo nin audio |
| 1.3.1 Información e relacións | A | C | Encabezados, listas, táboas e etiquetas de formulario semánticas |
| 1.3.2 Secuencia significativa | A | C | A orde do DOM é a orde visual |
| 1.3.3 Características sensoriais | A | C | As instrucións non dependen da forma nin da posición |
| 1.3.4 Orientación | AA | C | Funciona en vertical e en horizontal |
| 1.3.5 Propósito dos campos | AA | C | `autocomplete` nos campos de contacto |
| 1.4.1 Uso da cor | A | C | Os estados levan texto |
| 1.4.2 Control do audio | A | N/A | Sen audio |
| 1.4.3 Contraste mínimo | AA | C | axe sen incidencias tras o arranxo 1; modo de alto contraste |
| 1.4.4 Redimensionar texto | AA | C | Letra ata «moi grande» sen perder contido; zoom do navegador permitido |
| 1.4.5 Imaxes de texto | AA | C | Non se usan |
| 1.4.10 Reflow | AA | C | 320 px sen desprazamento horizontal |
| 1.4.11 Contraste non textual | AA | C | Bordos de campos e foco con contraste suficiente |
| 1.4.12 Espazado do texto | AA | P | Revisar cun marcador de espazado |
| 1.4.13 Contido ao pasar o rato | AA | C | Non hai tooltips que aparezan só ao pasar o rato |
| 2.1.1 Teclado | A | C | Todo é operable con Tab, Intro e Espazo |
| 2.1.2 Sen trampas de teclado | A | C | Os diálogos péchanse con Escape |
| 2.1.4 Atallos de teclado | A | N/A | Non hai atallos dunha soa tecla |
| 2.2.1 Tempo axustable | A | C | Sen límites de tempo nas reservas; a sesión renóvase co uso |
| 2.2.2 Pausar e deter | A | C | Animacións curtas, que se desactivan con «movemento reducido» |
| 2.3.1 Tres flashes | A | C | Non hai destellos |
| 2.4.1 Saltar bloques | A | C | «Saltar ao contido» |
| 2.4.2 Título da páxina | A | C | «Pantalla · Concello» (arranxo 4) |
| 2.4.3 Orde do foco | A | C | Orde lóxica; foco xestionado nos diálogos (arranxo 5) |
| 2.4.4 Propósito dos ligazóns | A | C | Textos descritivos |
| 2.4.5 Múltiples vías | AA | C | Menú inferior, inicio e ligazóns directas |
| 2.4.6 Encabezados e etiquetas | AA | C | Descritivos |
| 2.4.7 Foco visible | AA | C | Contorno de 3 px |
| 2.5.1 a 2.5.4 Xestos, cancelación, nome na etiqueta, movemento | A | C | Sen xestos complexos nin movemento do dispositivo |
| 3.1.1 Lingua da páxina | A | C | `lang="gl"` ou `lang="es"` segundo a escolla |
| 3.1.2 Lingua das partes | AA | C | Contido nunha soa lingua por páxina |
| 3.2.1 / 3.2.2 Ao recibir o foco ou ao introducir datos | A | C | Sen cambios de contexto automáticos |
| 3.2.3 / 3.2.4 Navegación e identificación coherentes | AA | C | Mesmo menú e compoñentes en toda a app |
| 3.3.1 / 3.3.3 Identificación e suxestión de erros | A/AA | C | Mensaxes de erro en texto, xunto ao campo |
| 3.3.2 Etiquetas ou instrucións | A | C | Todos os campos teñen etiqueta (arranxo 3) |
| 3.3.4 Prevención de erros | AA | C | Confirmación antes de reservar, cancelar ou pagar |
| 4.1.1 Análise | A | C | HTML xerado por SvelteKit, sen IDs duplicados (axe) |
| 4.1.2 Nome, función e valor | A | C | Compoñentes nativos; ARIA só onde fai falta (arranxo 2) |
| 4.1.3 Mensaxes de estado | AA | P | Revisar con lector de pantalla que os avisos se anuncian (`role="status"`) |

## 5. Declaración de accesibilidade (modelo para o concello)

> **Concello de [nome]** comprométese a facer accesible a súa plataforma de reservas de instalacións deportivas, de acordo co Real decreto 1112/2018.
>
> **Situación de cumprimento:** a plataforma é **parcialmente conforme** co RD 1112/2018 e a norma UNE-EN 301 549:2022. Supera a revisión automática e manual descrita en `docs/accesibilidade.md`, pero aínda **non se probou con lectores de pantalla** (criterios 1.4.12 e 4.1.3 pendentes de verificar).
>
> **Preparación:** autoavaliación da persoa provedora, 8 de novembro de 2026. Revisarase cada ano e despois de cada cambio importante.
>
> **Comunicacións e queixas:** pode comunicar calquera barreira en [correo] ou na sede electrónica de [concello]. Se non recibe resposta en 20 días hábiles, pode presentar unha reclamación ante [órgano competente].
>
> **Contido non accesible:** ningún coñecido no momento da avaliación.
