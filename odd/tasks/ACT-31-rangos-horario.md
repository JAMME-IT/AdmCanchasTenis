# ACT-31 — Rangos horarios (config) — Feature document

> Branch: `feat/ACT-31-rangos-horario` (desde `main` e1ef696). RDD on: usuario verifica manualmente los tests.
> Convención: commits en español con jerga técnica en inglés, Conventional Commits, sin `Co-Authored-By`.

## Objective

Implementar en `apps/api` los endpoints de **rangos horarios** del módulo `config`
según `docs/API-CONTRATO.md` §5.6 y el requerimiento **RF-34`:

- `GET /config/rangos-horario` (RF-34 consulta) — roles autenticados.
- `PUT /config/rangos-horario` (RF-34 registro/modificación) — solo admin.

## Problem / Why

La tabla `rangos_horario` define la franja de apertura del club y **ya la consumen** la
disponibilidad (`turnos.service.ts` → `GET /turnos/disponibilidad`) y la reserva: un turno
fuera de toda franja devuelve 422. Hoy esas franjas solo se cargan por seed / a mano.
Falta el ABM admin para consultarlas y reemplazarlas sin tocar la base. Impacta directamente
en la disponibilidad de turnos.

## Scope autorizado

- `apps/api/src/config/` — solo rangos horarios.
- Registro en `apps/api/src/app.module.ts` no hace falta (el módulo `config` ya está registrado).
- Alta de los specs en el script `test` de `apps/api/package.json`.
- Fuera de alcance: `PATCH /config/tipos-turno/:id` (ACT-32) y `PUT /tarifas/luz` (franja de iluminación).

## Constraints / decisiones

- **Contrato §5.6**:
  - `GET` → `[{ "id": "...", "nombre": "apertura", "horaInicio": "08:00", "horaFin": "22:00" }]`; errores 401.
  - `PUT` body `{ "rangos": [{ "id": "uuid-opcional", "nombre": "apertura", "horaInicio": "08:00", "horaFin": "22:00" }] }`; errores 400/401/403/409.
  - `PUT` **reemplaza el conjunto** en una transacción (upsert por `id` o por `nombre`) y responde los rangos vigentes.
  - Validaciones del contrato: `nombre` único de hasta 50 caracteres; `horaFin > horaInicio`.
- **Jira (criterio)**: además valida **solapamientos** entre franjas; impacta en la disponibilidad.
  Solapamiento se evalúa sobre intervalos `[horaInicio, horaFin)`: franjas contiguas (fin == inicio
  siguiente) son válidas. Solapamiento → **400**.
- **Reemplazo total**: las franjas vigentes que no vienen en el body se eliminan (reemplaza el conjunto).
  `rangos` vacío → **400** (`ArrayNotEmpty`): evita dejar al club sin horario de apertura.
- **Resolución de identidad**:
  - `id` presente → debe existir (si no, **400**, el contrato no define 404 para esta ruta).
  - sin `id` → match por `nombre` (update de horas) o alta si el nombre no existe.
  - dos entradas del body que resuelven a la misma fila o repiten `nombre` → **409** (contrato: `nombre` duplicado).
  - dos entradas con el mismo `id` → **400** (body inválido).
- **Horas**: `@db.Time(6)` en Prisma llega como `Date`; se persiste con epoch `1970-01-01T HH:MM:00Z`
  y se serializa `HH:MM` con el mismo criterio UTC que `turnos.service.ts`.
- **Formato**: regex `^([01]\d|2[0-3]):[0-5]\d$` en el DTO (`@Matches`).
- Patrón del repo: mappers `snake_case → camelCase` en `*-response.ts`; schema Swagger en
  `*-response.schema.ts`; comentarios/JSDoc en inglés referenciando el contrato; tests `node:test` con stubs de Prisma.
- **TDD estricto**: specs primero, RED observado, después implementación.

## Tasks

| ID | Tarea | Ruta | Trigger |
|---|---|---|---|
| T1 | Feature doc | inline | mecánico |
| T2 | Specs (mapper/horas + service + DTO) en RED | delegate writer | 2+ archivos no triviales |
| T3 | Implementación (response, schema, hora, dto, service, controller, module) → GREEN | delegate writer | 2+ archivos no triviales |
| T4 | Cablear specs en `test` + suite completa + `build` | delegate writer | verificación |
| T5 | Commit work-unit + actualizar doc de feature | inline | mecánico |

## Acceptance criteria

1. `GET /config/rangos-horario` responde `[{ id, nombre, horaInicio, horaFin }]` ordenado por `horaInicio`; cualquier rol autenticado.
2. `PUT /config/rangos-horario` (admin) reemplaza el conjunto en una transacción y responde los rangos vigentes.
3. Upsert por `id` o por `nombre`; las franjas omitidas se borran.
4. `PUT` con formato de hora inválido, `horaFin <= horaInicio`, solapamiento, `id` inexistente, `id` duplicado o lista vacía → 400.
5. `PUT` con `nombre` duplicado (en el body o contra otra fila) → 409.
6. Roles: `GET` requiere autenticación (401 sin token); `PUT` requiere `admin` (403 para socio/no_socio).
7. Tests unitarios (node:test) en verde; `npm run build --workspace=api` limpio.

## Progreso

| ID | Estado | Evidencia |
|---|---|---|
| T1 | ✅ | este documento |
| T2 | ✅ RED observado | `Cannot find module './rangos-horario.service'` (MODULE_NOT_FOUND) y `Cannot find module './actualizar-rangos-horario.dto'` |
| T3 | ✅ GREEN | `RangosHorarioService` 16/16 + `ActualizarRangosHorarioDto` 15/15 |
| T4 | ✅ | suite completa `npm test --workspace=api` exit 0; `npm run build --workspace=api` → `tsc` limpio (`BUILD_EXIT=0`) |
| T5 | ✅ | commit de este work unit (ver sección Commits) |

### Correcciones del revisor (parent) sobre el output del writer

1. **Swap de `nombre` entre filas conservadas**: renombrar dos filas que intercambian nombre
   chocaba con `uq_rangos_horario_nombre` (Postgres valida la unique por statement). Se agregó
   un rename en dos fases dentro de la transacción (nombre temporal `tmp-<uuid>`, luego el final)
   y un test que lo cubre.
2. **`nombre` sin `@IsString`**: un número pasaba `@IsNotEmpty`/`@MaxLength` y rompía en Prisma.
   Se agregó `@IsString` y el test correspondiente.

### Nota del writer (edge no cubierto por contrato)

Un body que intercambia nombres entre filas conservadas quedó cubierto; la colisión de unique
por concurrencia (dos admins escribiendo a la vez) no se mapea a 409 y hoy saldría 500.

## Commits

- `feat(api): rangos horarios GET/PUT en config (ACT-31, RF-34)` — pendiente de registrar hash.

## Verificación (a manual por el usuario)

- Unit: `npm test --workspace=api` (incluye los nuevos specs).
- Build: `npm run build --workspace=api`.
- Manual (Swagger `/api/docs` o curl con token admin): `GET` y `PUT /config/rangos-horario`,
  y luego `GET /turnos/disponibilidad` para confirmar que la franja nueva acota los slots.

## Next step

ACT-32 — `PATCH /config/tipos-turno/:id` (RF-15, v1.1) en la rama `feat/ACT-32-duracion-turno`.
