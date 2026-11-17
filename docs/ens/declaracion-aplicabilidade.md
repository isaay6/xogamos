# Declaración de aplicabilidade (categoría básica)

Medidas do Anexo II do RD 311/2022 que aplican a un sistema de categoría básica, con que achega
Xogamos e que lle corresponde á entidade que o opera. A columna «Estado» énchea a entidade.

**Lenda:** **P** = cuberta polo produto · **P+E** = o produto achega a base e a entidade
complétaa · **E** = só a entidade · **N/A** = non aplica.

## Marco organizativo

| Medida | Quen | Achega de Xogamos / que fai a entidade | Estado |
|---|---|---|---|
| org.1 Política de seguridade | E | A entidade aproba a súa política (pode usar a da Deputación) | |
| org.2 Normativa de seguridade | E | Normas de uso para o persoal | |
| org.3 Procedementos de seguridade | P+E | Guías de operación, restauración e soporte en `docs/guias/` | |
| org.4 Proceso de autorización | E | Quen autoriza altas de persoal e cambios no sistema | |

## Marco operacional

| Medida | Quen | Achega de Xogamos / que fai a entidade | Estado |
|---|---|---|---|
| op.pl.1 Análise de riscos | P+E | [analise-riscos.md](analise-riscos.md) | |
| op.pl.2 Arquitectura de seguridade | P | Arquitectura documentada (`docs/arquitectura.md`): app tras proxy HTTPS, base de datos non exposta | |
| op.pl.3 Adquisición de novos compoñentes | P+E | Só dependencias libres dunha lista permitida, comprobadas na CI | |
| op.pl.4 Dimensionamento | P+E | Requisitos mínimos en `docs/guias/despregamento-deputacion.md` (2 vCPU, 4 GB) | |
| op.acc.1 Identificación | P | Identidade única por persoa (Cl@ve / Chave365) | |
| op.acc.2 Requisitos de acceso | P | Papeis por concello comprobados no servidor en cada ruta e na API | |
| op.acc.3 Segregación de funcións | P | Papeis separados: administración, conserxería, apertura e Deputación | |
| op.acc.4 Xestión de dereitos de acceso | P+E | Pantallas de persoal e de administradores; a entidade revisa os permisos | |
| op.acc.5 Autenticación (usuarios externos) | P | OIDC con PKCE; sen contrasinais propios | |
| op.acc.6 Autenticación (usuarios da organización) | P | O mesmo mecanismo para o persoal | |
| op.exp.1 Inventario de activos | E | Servidor, dominio, copias e persoas con acceso | |
| op.exp.2 Configuración de seguridade | P | Instalación por defecto segura: só HTTPS, cabeceiras de seguridade, usuario sen privilexios | |
| op.exp.3 Xestión da configuración | P+E | Configuración nun único `.env` xerado por `install.sh` | |
| op.exp.4 Mantemento e actualizacións | P+E | Versións con notas (`CHANGELOG.md`), `update.sh` e `rollback.sh` | |
| op.exp.5 Xestión de cambios | P+E | Cambios revisados e probados na CI antes de publicar unha versión | |
| op.exp.6 Protección fronte a código daniño | P+E | Imaxe analizada con Trivy; sen subida de executables. Antivirus nos postos: entidade | |
| op.exp.7 Xestión de incidentes | P+E | Política de vulnerabilidades (`SECURITY.md`); a entidade notifica ao CCN-CERT se procede | |
| op.exp.8 Rexistro de actividade | P | Rexistro das accións do persoal, co autor e a data | |
| op.exp.9 Rexistro da xestión de incidentes | E | Libro de incidentes da entidade | |
| op.ext.1 Contratación e acordos de servizo | E | Se se contrata aloxamento ou soporte, con cláusulas de seguridade | |
| op.ext.2 Xestión diaria | E | Seguimento do provedor | |
| op.ext.4 Interconexión de sistemas | P | Só OIDC (identidade) e SMTP (correo), documentados | |
| op.cont.1 Análise de impacto | E | Ver dispoñibilidade na análise de riscos | |
| op.mon.1 Detección de intrusión | P+E | Límite de peticións e rexistro de actividade; vixilancia da rede: entidade | |
| op.mon.2 Sistema de métricas | P+E | Indicadores de uso no panel; métricas de seguridade: entidade | |

## Medidas de protección

| Medida | Quen | Achega de Xogamos / que fai a entidade | Estado |
|---|---|---|---|
| mp.if (instalacións) | E | Centro de datos do provedor ou sala da entidade | |
| mp.per (persoal) | E | Deberes, concienciación e formación (as guías serven de base) | |
| mp.eq (equipos) | E | Bloqueo e protección dos postos do persoal | |
| mp.com.1 Perímetro seguro | P+E | A app só escoita en local tras o proxy; cortalumes: entidade | |
| mp.com.2 Confidencialidade | P | HTTPS obrigatorio con HSTS | |
| mp.com.3 Integridade e autenticidade | P | TLS; QR das reservas asinado | |
| mp.si (soportes) | E | Cifrado e custodia das copias fóra do servidor | |
| mp.sw.1 Desenvolvemento de aplicacións | P | Código aberto, 1.410 probas automáticas, análise de dependencias e de código | |
| mp.sw.2 Aceptación e posta en servizo | P+E | Probas en preprodución antes de abrir (`docs/plan-implantacion.md`) | |
| mp.info.1 Datos persoais | P+E | Minimización, DNI en HMAC, borrado automático; RAT e encargo: entidade (`docs/rgpd.md`) | |
| mp.info.2 Cualificación da información | E | Nivel baixo (ver análise de riscos) | |
| mp.info.6 Copias de seguridade | P+E | Copia diaria automática e restauración probada; gardar copias fóra: entidade | |
| mp.s.2 Protección de servizos web | P | CSP con *nonce*, cabeceiras de seguridade, límite de peticións | |
| mp.s.4 Protección fronte á denegación de servizo | P+E | Límite de peticións; protección de rede: provedor | |
