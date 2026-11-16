# Gobernanza e mantemento

Este documento di quen decide, quen mantén Xogamos e que pasa se o equipo actual deixa de facelo.
Está escrito para un concello ou unha Deputación que queira saber de quen depende antes de adoptala.

## 1. Quen somos hoxe

Xogamos naceu para o I Certame GOBTEC de Software Libre. O equipo é pequeno e dicímolo claro:

- **Titular e responsable:** ViboAsesor (Sonia Fidalgo García, autónoma).
- **Desenvolvemento e mantemento:** Isay Rodríguez Fidalgo.

Un equipo pequeno é un risco. Por iso a plataforma está feita para **non depender de nós**. O resto
deste documento explica como.

## 2. Por que non depende do equipo actual

| Garantía | Como se cumpre |
|---|---|
| Calquera pode continuala | Licenza **EUPL-1.2**: usar, modificar e redistribuír sen pedir permiso. |
| Calquera empresa galega pode mantela | Pila estándar e moi común: TypeScript, SvelteKit e PostgreSQL. Sen pezas propias nin de pago. |
| Enténdese sen falar con nós | Arquitectura e decisións documentadas ([docs/arquitectura.md](docs/arquitectura.md)), guías de instalación e de operación, e código comentado. |
| Os cambios non rompen nada sen aviso | Máis de 1.300 probas automáticas, accesibilidade e seguridade comprobadas en cada cambio (CI). |
| Os datos son do concello | Exportación completa en formatos abertos e copias en PostgreSQL estándar. Pódese marchar en calquera momento. |
| Pouco que manter | Unha aplicación e unha base de datos. Sen servizos de terceiros obrigatorios. |

## 3. Modelos de mantemento

A plataforma admite tres, e pódense combinar:

1. **Deputación con encargo.** A Deputación instala unha soa vez e dá servizo aos seus concellos
   (modelo de [encargo de tratamento](docs/encargo-tratamento.md)). O seu servizo de informática
   aplica as actualizacións. É o modelo que recomendamos para concellos pequenos.
2. **Empresa contratada.** O concello ou a Deputación contrata o soporte a calquera empresa. Non hai
   exclusividade: o código, a documentación e as probas son públicas.
3. **Comunidade.** Os concellos que a usan comparten melloras no repositorio. Cada mellora que paga
   un concello queda para todos.

## 4. O noso compromiso

Durante o **primeiro ano dun piloto** (12 meses desde a posta en marcha), o equipo actual comprométese a:

- corrixir as vulnerabilidades graves, cos prazos de [SECURITY.md](SECURITY.md);
- corrixir os erros que impidan reservar, cancelar ou xestionar as instalacións;
- publicar as versións con notas claras no [CHANGELOG.md](CHANGELOG.md) e sen cambios que obriguen
  a reinstalar;
- acompañar a posta en marcha: instalación, alta do concello e formación do persoal.

Non prometemos soporte de 24 horas nin funcións á medida: iso corresponde ao modelo 1 ou 2.

## 5. Se o equipo actual o deixa

1. Avísase no repositorio con **tres meses** de antelación, cando sexa posible.
2. O repositorio queda público e **non se borra**. Márcase como «busca mantedor».
3. Trasládanse os permisos á entidade que o asuma: unha Deputación, AGASOL ou unha empresa que xa
   lle dea soporte a algún concello.
4. Mentres tanto, cada instalación segue funcionando: non depende de ningún servizo noso.

## 6. Como se decide

- **Incidencias e propostas:** no repositorio, coas plantillas de erro e de mellora.
- **Cambios pequenos:** revísaos e acéptaos quen mantén, se pasan as probas.
- **Cambios grandes** (base de datos, identidade, datos persoais): explícanse antes nunha incidencia
  e déixase unha semana para opinar. A decisión queda escrita como ADR en `docs/arquitectura.md`.
- **Prioridades:** primeiro a seguridade, despois os erros, despois o que pidan os concellos que a
  usan. A folla de ruta é pública: [docs/folla-de-ruta.md](docs/folla-de-ruta.md).
- **Quen colabora de forma continuada** pode pasar a ter permisos de mantemento. Ver
  [CONTRIBUTING.md](CONTRIBUTING.md).

## 7. Versións

- Versionado semántico. Mentres sexa 0.x, só se mantén a última versión.
- As migracións da base de datos só engaden cambios e aplícanse soas ao arrincar.
- Cada versión publícase como imaxe Docker e con notas no `CHANGELOG.md`.
