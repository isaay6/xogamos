# Encargo do tratamento: modelo e reparto de responsabilidades

> **Modelo orientativo**, non asesoramento xurídico. A persoa delegada de protección de datos (DPD)
> do concello debe revisalo e adaptalo antes de asinalo.

## 1. Quen é quen

| Papel | Quen | Que fai |
|---|---|---|
| **Responsable do tratamento** (art. 24 RXPD) | O concello | Decide para que e como se tratan os datos; aproba normas, prazos e aviso de privacidade; atende os dereitos |
| **Encargado do tratamento** (art. 28 RXPD) | Quen aloxa e mantén a instalación: a Deputación, unha empresa ou o propio servizo de informática | Opera o servidor, aplica actualizacións, fai copias e segue as instrucións do concello |
| **Subencargados** | Provedor do servidor (na UE) e, se o hai, do correo SMTP | Só infraestrutura, sen acceso funcional aos datos |
| **Produto (este software)** | Proxecto de software libre | Non trata datos: achega as medidas técnicas descritas en `seguridade.md` e `rgpd.md` |

## 2. Que achega o produto e que lle toca á organización

| Tema | Achega o produto | Tócalle ao concello ou ao encargado |
|---|---|---|
| Minimización | Só pide o necesario; DNI en HMAC | Non engadir campos innecesarios na configuración |
| Dereitos | Descarga dos datos e borrado da conta desde «Eu» | Atender as peticións por outras canles (sede, rexistro) en 1 mes |
| Conservación | Borrado automático de sesións, correos e avisos vellos | Fixar os prazos de reservas e monedeiro segundo a súa normativa |
| Seguridade | Medidas técnicas (ver `seguridade.md`) | Medidas organizativas do ENS, copias fóra do servidor, actualizacións |
| Transparencia | Aviso de privacidade modelo (`rgpd.md`, apartado 5) | Publicalo co seu DPD e base xurídica |
| Incidentes | Rexistro de actividade e política de vulnerabilidades | Notificar á AEPD en 72 horas se procede (art. 33) |

## 3. Cláusulas mínimas do contrato (art. 28.3 RXPD)

1. **Obxecto e duración:** aloxamento e mantemento da plataforma de reservas mentres dure o servizo.
2. **Natureza e finalidade:** xestión de reservas de instalacións deportivas municipais.
3. **Datos e persoas:** os indicados no rexistro de actividades (`rgpd.md`, apartado 2).
4. **Instrucións:** o encargado só trata os datos seguindo instrucións documentadas do concello.
5. **Confidencialidade:** as persoas autorizadas comprométense por escrito.
6. **Seguridade:** medidas do art. 32 RXPD e do ENS categoría básica.
7. **Subencargados:** só con autorización previa do concello e coas mesmas obrigas; servidores na UE.
8. **Axuda co exercicio de dereitos** e coas avaliacións de impacto.
9. **Fin do servizo:** devolución íntegra dos datos (copia PostgreSQL e exportacións CSV/XLSX) e borrado das copias do encargado.
10. **Auditoría:** o concello pode comprobar o cumprimento.

## 4. Deputación que aloxa varios concellos

Cada concello segue sendo **responsable** dos seus datos e a Deputación é **encargada** de todos.
A plataforma separa os datos por concello e a Deputación só ve cifras agregadas. Recoméndase un
convenio marco coa Deputación e unha adhesión simple de cada concello.
