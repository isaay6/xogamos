# Como colaborar

Grazas por querer mellorar Xogamos. Calquera concello, Deputación, empresa ou persoa pode
usar, adaptar e mellorar a plataforma baixo a licenza **EUPL-1.2**.

## Antes de empezar

- Le a [arquitectura](docs/arquitectura.md): capas, decisións (ADR) e límites coñecidos.
- Para un cambio grande, abre antes unha incidencia e explica o problema que resolve.
- Para vulnerabilidades, segue [SECURITY.md](SECURITY.md), non unha incidencia pública.

## Contorna

```bash
npm ci
npm run dev:demo   # PGlite en memoria, datos ficticios e identidade simulada
```

Requírese Node 22 (`.nvmrc`). Para PostgreSQL real, ver [docs/instalacion.md](docs/instalacion.md).

## Regras do código

- **TypeScript estrito**, sen `any`.
- **Lóxica nos servizos** (`src/lib/server/services/`) e **regras puras no dominio**
  (`src/lib/server/domain/`). As rutas só validan, comproban permisos e chaman aos servizos.
- Os servizos devolven un `Result` explícito; non se usan excepcións para erros de negocio.
- **Cada acción funciona sen JavaScript** (form actions); o JavaScript só mellora.
- **Textos en galego e castelán** (`src/lib/i18n/gl` e `es`). O galego é a lingua de orixe.
- **Accesibilidade WCAG 2.1 AA:** etiquetas, foco visible, contraste e estados con texto, non só cor.
- **Cabeceira SPDX** `SPDX-License-Identifier: EUPL-1.2` en cada ficheiro fonte.
- **Só dependencias libres** da lista permitida (`npm run licenses`).
- **Cambios de base de datos** só con migracións novas en `drizzle/`; nunca se editan as xa publicadas.
- **Só datos ficticios** na semente e nas probas.
- Formato: tabulacións, comiñas simples, ancho 100 (`prettier`).

## Antes de enviar un cambio

```bash
npm run check && npm test && npm run build && npm run spdx && npm run licenses
```

A integración continua executa o mesmo en cada *pull request*. Inclúe probas para o comportamento
novo e explica no *pull request* que cambia e por que.

## Licenza das contribucións

Ao enviar un cambio aceptas que se distribúa baixo a EUPL-1.2, como o resto do proxecto.
