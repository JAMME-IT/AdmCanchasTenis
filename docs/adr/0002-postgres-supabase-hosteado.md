# ADR-0002: PostgreSQL hosteado en Supabase

- **Estado**: Aceptada
- **Fecha**: 2026-09-25

## Contexto

RNF-1 exige una base de datos relacional. El equipo son 5 integrantes (1 en WSL, 4 en Windows), sin presupuesto de infraestructura ni rol de operaciones. Se necesita una base compartida para desarrollo y demo, accesible sin instalaciones locales. El diseño usa enums nativos, `gen_random_uuid()` e índices parciales.

## Decisión

PostgreSQL 15+ hosteado en Supabase (free tier):

- Acceso exclusivo desde la API con service role; el frontend nunca toca la base (DB-SCHEMA §9).
- Migraciones SQL versionadas en `supabase/migrations/` y aplicadas con la CLI de Supabase.
- RLS deshabilitado en la migración inicial; queda documentado como paso futuro (DB-SCHEMA §9).

## Alternativas consideradas

- **Postgres local (Docker o instalador)**: descartada por ahora. Exige homogeneizar versiones en 5 máquinas (1 WSL + 4 Windows) y no da una base compartida para demo. Reemplazable si aparece dolor real (ADR-0005).
- **MySQL**: descartada. Postgres es el motor recomendado por la cátedra y el diseño depende de enums, `gen_random_uuid()` e índices parciales; migrar a MySQL obligaría a rediseñar partes del esquema.

## Consecuencias

Positivas:

- Base compartida y accesible desde el primer día, sin costo de infraestructura.
- Panel web con SQL Editor, backups básicos y pooler (pgbouncer) incluidos.
- El SQL es portable a cualquier PostgreSQL 15+ si se decide migrar.

Negativas:

- Dependencia de internet para desarrollar y testear; latencia de red en cada query.
- Límites y pausas del free tier.
- Acoplamiento operativo al proveedor (CLI, URLs, pooler).
