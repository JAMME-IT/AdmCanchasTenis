# ADR-0006: Prisma ORM v7 como capa de acceso a datos

- **Estado**: Aceptada
- **Fecha**: 2026-09-25

## Contexto

La API NestJS accede a PostgreSQL (Supabase, pooler) sobre un esquema ya definido por SQL en `supabase/migrations/20260925000000_initial_schema.sql`. El equipo quiere type-safety en TypeScript, migraciones versionadas y una herramienta para explorar datos sin escribir SQL a mano. El esquema tiene enums nativos, índices parciales y el runtime pasa por pgbouncer.

## Decisión

Usar **Prisma ORM v7** en `apps/api`:

- Cliente TypeScript generado, con el driver adapter **`@prisma/adapter-pg`** para el runtime.
- `prisma.config.ts` separa conexiones: `DIRECT_URL` para el CLI (migraciones e introspección, conexión directa) y `DATABASE_URL` para el runtime (pooler de Supabase, pgbouncer).
- **Prisma Studio** como herramienta de exploración de datos.
- **Baseline**: se aplica primero la migración SQL existente, luego `prisma db pull` y luego `prisma migrate resolve` para marcar ese baseline; desde ahí, Prisma Migrate gestiona las migraciones.
- `schema.prisma` es la fuente de verdad del cliente, no de todo el esquema: lo que no modela (por ejemplo, el índice parcial `uq_usuarios_roles_vigente`) se mantiene como SQL manual dentro de las migraciones de Prisma.

## Alternativas consideradas

- **TypeORM**: descartada. Es la integración clásica de NestJS, pero su tipado es más débil (repositorios con tipos parciales) y el mantenimiento del proyecto fue errático; las migraciones se escriben a mano igual que SQL.
- **Drizzle**: descartada. Es liviano y SQL-first, pero trae menos baterías (sin un Studio equivalente ni un flujo de baseline tan directo); para este equipo iguala a Prisma en trabajo manual.
- **SQL crudo con `pg`**: descartada. Máximo control, pero el tipado, las migraciones y el mapeo quedan a cargo del equipo; más trabajo y más superficie de error para el mismo resultado.

## Consecuencias

Positivas:

- Menos SQL a mano; cliente TypeScript tipado sobre el esquema existente.
- Migraciones versionadas con historial y Prisma Studio para explorar datos.
- El baseline mantiene la continuidad con la migración SQL ya aplicada.

Negativas:

- `schema.prisma` manda para el cliente pero no modela todo: índices parciales, comentarios y otros objetos requieren SQL manual en migraciones y pueden desincronizarse si no se revisan.
- El driver adapter y `prisma.config.ts` agregan configuración inicial y una curva de aprendizaje (`migrate dev/deploy/resolve`).
- Hay que evitar editar la base por fuera del flujo de Prisma para que el historial de migraciones no se desincronice.
