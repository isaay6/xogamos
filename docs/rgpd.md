# Protección de datos (RXPD e LOPDGDD)

> Borrador para o concello que instale a plataforma. O concello é o **responsable do tratamento**; quen manteña a instalación (o propio concello, a Deputación ou unha empresa) actúa como **encargado** e debe asinar o contrato do art. 28 RXPD. Os textos son modelos: o DPD do concello debe revisalos antes de usalos.

## 1. Principios aplicados no deseño

| Principio (art. 5 e 25 RXPD) | Como o cumpre a plataforma |
|---|---|
| Minimización | Só se pide o necesario para reservar: nome, identidade dixital e, se a persoa quere, correo ou teléfono. Non se pide data de nacemento, enderezo nin conta bancaria. |
| DNI sen gardar | O DNI/NIE só se garda como HMAC-SHA256 cunha clave do servidor (`AUTH_SECRET`). Serve para que a conserxería atope a persoa, pero non se pode ler. |
| Identidade pública | O acceso faise con Cl@ve ou Chave365: a plataforma non garda contrasinais. |
| Consentimento explícito | Os avisos por correo están desactivados por defecto. Se a persoa os activa, gárdase a data do consentimento. |
| Empadroamento | A declaración propia non cambia o prezo. Só o persoal pode comprobalo, e queda rexistrado quen e cando. |
| Tarifa social | Só a asigna o persoal. Non se garda o motivo, só a categoría. |
| Separación por concello | Cada concello ve só os seus perfís, reservas e rexistros. A identidade compártese, pero o historial non. |
| Sesións | Gárdase só o hash SHA-256 do token. A cookie é `HttpOnly`, `Secure` e `SameSite`. |
| Rexistro de actividade | As accións do persoal (verificar, cancelar, cambiar prezos...) quedan rexistradas co autor e a data. |
| Portabilidade | A persoa descarga os seus datos desde «Eu → Descargar os meus datos» (art. 20). |

## 2. Rexistro de actividades de tratamento (art. 30) — modelo

| Campo | Contido |
|---|---|
| Nome | Xestión de reservas de instalacións deportivas municipais |
| Responsable | Concello de [nome], [enderezo], [correo do DPD] |
| Finalidade | Xestionar reservas, accesos, bonos, torneos e solicitudes de uso; aplicar tarifas e normas de uso; estatísticas agregadas de uso |
| Base xurídica | Art. 6.1.e RXPD (interese público e competencias municipais en deporte, art. 25.2.l LBRL). Os avisos por correo: art. 6.1.a (consentimento) |
| Persoas afectadas | Veciñanza e visitantes que reservan; responsables de clubs; persoal municipal |
| Datos | Identificativos (nome, identificador de Cl@ve/Chave365, hash do DNI), contacto (correo e teléfono, opcionais), empadroamento comprobado, categoría de tarifa social, reservas, asistencia e faltas, pagos no monedeiro, preferencias de accesibilidade, foto de perfil (opcional) |
| Categorías especiais | Ningunha. As preferencias de accesibilidade (tamaño de letra, contraste) non son datos de saúde: non se pregunta o motivo |
| Destinatarios | Ningún fóra do concello, agás o encargado do aloxamento. A Deputación ve só cifras agregadas |
| Transferencias internacionais | Ningunha, se o aloxamento está na UE |
| Prazos de conservación | Ver apartado 3 |
| Medidas de seguridade | Ver `docs/seguridade.md` e o Esquema Nacional de Seguridade (categoría básica) |

## 3. Prazos de conservación (proposta)

| Dato | Prazo |
|---|---|
| Sesións | Caducan soas (30 días sen uso). |
| Reservas e asistencia | 2 anos desde a data da reserva, para estatísticas e reclamacións. Despois, só cifras anónimas. |
| Movementos do monedeiro | O prazo que marque a normativa económica municipal (normalmente 4 anos). |
| Rexistro de actividade do persoal | 2 anos. |
| Correos enviados (cola de saída) | 30 días. |
| Perfil sen actividade | Avísase aos 3 anos sen reservas e bórrase aos 3 meses do aviso se a persoa non responde. |

> **Pendente técnico:** o borrado automático por prazos e o borrado da conta a petición aínda non están programados. Mentres tanto, o concello atende as peticións de supresión pola vía ordinaria (sede electrónica ou rexistro). Está na folla de ruta do piloto.

## 4. Dereitos das persoas

- **Acceso e portabilidade:** «Eu → Descargar os meus datos» (JSON ou páxina lexible).
- **Rectificación:** a persoa cambia o seu contacto e preferencias en «Eu». O nome vén de Cl@ve ou Chave365.
- **Supresión, limitación e oposición:** por sede electrónica ou rexistro do concello (ver o pendente técnico).
- **Reclamación:** ante a Axencia Española de Protección de Datos (aepd.es).

## 5. Aviso de privacidade (texto curto, para a pantalla de entrada)

> **Concello de [nome]** trata os teus datos para xestionar as reservas das instalacións deportivas municipais, en exercicio das súas competencias (art. 6.1.e RXPD). Non os cedemos a terceiros. Podes descargalos desde «Eu» e exercer os teus dereitos en [sede electrónica]. Máis información: [ligazón á política completa]. DPD: [correo].

## 6. Avaliación de impacto (EIPD)

Polo volume e o tipo de datos (sen categorías especiais, sen perfís automatizados con efectos xurídicos), en principio **non é obrigatoria**. O concello debe revisalo coa lista da AEPD (art. 35.4 RXPD) se engade pagos con tarxeta ou cámaras de acceso.
