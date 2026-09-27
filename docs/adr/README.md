# ADRs — Registro de decisiones de arquitectura

Un **ADR** (Architecture Decision Record) documenta una decisión de arquitectura: el contexto en el que se tomó, qué se decidió, qué alternativas se evaluaron y qué consecuencias tiene. Sirve para que cualquier integrante entienda *por qué* el sistema es como es, sin depender de la memoria del equipo.

## Formato

Cada archivo usa este formato:

- Título `# ADR-000N: Título`
- **Estado**: Aceptada | Propuesta | Reemplazada
- **Fecha**
- **Contexto**
- **Decisión**
- **Alternativas consideradas** (con el motivo por el que se descartaron)
- **Consecuencias** (positivas y negativas)

Convenciones:

- Nombre de archivo: `NNNN-titulo-en-minusculas-con-guiones.md`.
- Una decisión por archivo; no se edita el contenido de una decisión pasada.
- Si una decisión se reemplaza, se crea un ADR nuevo que referencia al anterior y el anterior pasa a estado *Reemplazada*.

## Índice

| Número | Título | Estado | Fecha |
|---|---|---|---|
| [ADR-0001](0001-monorepo-npm-workspaces.md) | Monorepo unico con npm workspaces | Aceptada | 2026-09-25 |
| [ADR-0002](0002-postgres-supabase-hosteado.md) | PostgreSQL hosteado en Supabase | Aceptada | 2026-09-25 |
| [ADR-0003](0003-naming-espanol-catedra.md) | Nombres de dominio en español de cátedra (DB y API) | Aceptada | 2026-09-25 |
| [ADR-0004](0004-historial-cache-estados.md) | Historial append-only + caché de estado actual | Aceptada | 2026-09-25 |
| [ADR-0005](0005-sin-docker-por-ahora.md) | Sin Docker por ahora | Aceptada | 2026-09-25 |
| [ADR-0006](0006-prisma-orm.md) | Prisma ORM v7 como capa de acceso a datos | Aceptada | 2026-09-25 |
| [ADR-0007](0007-auth-jwt-propia.md) | Autenticación JWT propia en la API | Reemplazada por [ADR-0008](0008-identidad-clerk.md) | 2026-09-25 |
| [ADR-0008](0008-identidad-clerk.md) | Identidad con Clerk y RBAC propio en la base | Aceptada | 2026-09-26 |

## Referencias cruzadas

- `docs/API-CONTRATO.md` cita ADR-0003 (naming), ADR-0006 (acceso a datos) y ADR-0008 (identidad y sesión).
- `docs/DB-SCHEMA.md` cita el patrón historial + caché (ADR-0004) y la identidad delegada a Clerk (ADR-0008).
