# Análise de riscos e categoría do sistema

Análise simplificada para un concello que opera Xogamos (medida op.pl.1). A entidade debe
revisala co seu sistema real: servidor, rede, persoas e provedores.

## 1. Categoría do sistema

Valoración das cinco dimensións segundo o Anexo I do RD 311/2022:

| Dimensión | Nivel | Por que |
|---|---|---|
| Confidencialidade | Baixo | Datos de contacto e reservas; sen categorías especiais. O DNI só se garda como HMAC |
| Integridade | Baixo | Un erro nunha reserva causa molestias, non dano grave; hai rexistro de actividade |
| Dispoñibilidade | Baixo | Se a web cae, a conserxería segue coa folla do día impresa e o teléfono |
| Autenticidade | Baixo | A identidade vén de Cl@ve ou Chave365, non de contrasinais propios |
| Trazabilidade | Baixo | As accións do persoal quedan rexistradas co autor e a data |

**Categoría do sistema: BÁSICA** (todas as dimensións en nivel baixo).

## 2. Riscos principais

| Ameaza | Impacto | Medidas do produto | Medidas da entidade | Risco residual |
|---|---|---|---|---|
| Acceso indebido a datos de veciñanza | Medio | Papeis por concello, sesións seguras, separación de datos por concello | Altas e baixas do persoal; revisión de permisos | Baixo |
| Perda de datos (fallo do servidor) | Medio | Copia diaria automática con rotación; restauración probada en CI | Gardar copias fóra do servidor; proba trimestral | Baixo |
| Vulnerabilidade nunha dependencia | Medio | `npm audit` e Trivy en cada cambio e cada semana; imaxe sen ferramentas de compilación | Aplicar as actualizacións (`scripts/update.sh`) | Baixo |
| Suplantación de identidade | Medio | OIDC con PKCE e validación do token; sen contrasinais propios | Alta en Cl@ve / Chave365 | Baixo |
| Denegación de servizo | Baixo | Límite de peticións por IP; corpo máximo 512 KB | Proxy ou cortalumes do provedor | Baixo |
| Erro do persoal (borrado, cambio indebido) | Baixo | Rexistro de actividade; avisos á veciñanza afectada | Formación inicial (guías en `docs/guias`) | Baixo |
| Fuga por servizos de terceiros | Baixo | Sen analítica, publicidade, mapas nin fontes externas; CSP estrita | Escoller provedor de aloxamento na UE | Baixo |

## 3. Revisión

- Responsable de seguridade: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Data da análise: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Próxima revisión: un ano despois, ou antes se cambia o sistema.
