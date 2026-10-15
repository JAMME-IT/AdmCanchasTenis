# ACT-30 — Días de funcionamiento (config) — Feature document

> Branch: `feat/ACT-30-dias-funcionamiento` (desde `main` 8d2d20e). RDD on: usuario verifica manualmente los tests.
> Convención: commits en español con jerga técnica en inglés, Conventional Commits, sin `Co-Authored-By`.

## Objective

Implementar en `apps/api` el módulo `config` con los endpoints de **días de funcionamiento**
según `docs/API-CONTRATO.md` §5.6 y el requerimiento **RF-35**:

- `GET /config/dias-funcionamiento` (RF-35 consulta) — roles autenticados.
- `PUT /config/dias-funcionamiento` (RF-35 registro/modificación) — solo admin.

## Problem / Why

El club abre según los días de la semana, pero hoy no hay forma de administrar esa configuración
desde la API. La tabla `dias_funcionamiento` ya existe y **ya la consume** la disponibilidad de
turnos (`turnos.service.ts` → `GET /turnos/disponibilidad` y la reserva), que trata un día
**ausente** o con `habilitado=false` como no operativo. Falta el ABM admin para consultar/editar
esos días sin tocar la base a mano. Impacta directamente en la disponibilidad de turnos.

## Scope autorizado

- Nuevo módulo `apps/api/src/config/` (solo días de funcionamiento).
- Registro en `apps/api/src/app.module.ts`.
- Alta del spec en el script `test` de `apps/api/package.json`.
- Fuera de alcance: `PUT/GET /config/rangos-horario` (ACT-31) y `PATCH /config/tipos-turno/:id` (RF-15/v1.1).

## Constraints / decisiones

- **Contrato §5.6**:
  - `GET` → `[{ "diaSemana": 1..7, "habilitado": boolean }]` (ISO-8601: 1=lunes, 7=domingo). Errores 401.
  - `PUT` body `{ "dias": [{ "diaSemana": 1..7, "habilitado": boolean }] }`; upsert transaccional; errores 400/401/403; responde el array actualizado.
- **Decisión (día ausente)**: `GET` devuelve **siempre los 7 días en orden 1..7**; un día sin fila se
  reporta como `habilitado: false`, porque la disponibilidad de turnos trata la ausencia de fila como
  día no operativo (coherencia con `turnos.service.ts`). El seed carga los 7 días en `true`.
- **Duplicados**: `diaSemana` duplicado en el body → **400** (validado en el service).
- **Validación**: `class-validator` (`IsInt`+`Min(1)`+`Max(7)`, `IsBoolean`, `ValidateNested`+`Type`).
  El `ValidationPipe` global (`whitelist`+`transform`) ya está activo en `main.ts`.
- Patrón del repo: mappers `snake_case → camelCase` en `*-response.ts`; schema Swagger en
  `*-response.schema.ts`; comentarios/JSDoc en inglés referenciando el contrato.

## Tasks

| ID | Tarea | Ruta | Trigger |
|---|---|---|---|
| T1 | Specs (mapper + service) en RED (TDD estricto) | delegate writer | 2+ archivos no triviales |
| T2 | Implementación (dto, response, service, controller, module, app.module) → GREEN | delegate writer | 2+ archivos no triviales |
| T3 | Cablear spec en script `test` + suite completa + `build` | delegate writer | verificación |
| T4 | Actualizar doc de feature (progreso/evidencia) | inline | mecánico |

## Acceptance criteria

1. `GET /config/dias-funcionamiento` responde los 7 días `[{ diaSemana, habilitado }]` ordenados; cualquier rol autenticado.
2. `PUT /config/dias-funcionamiento` (admin) hace upsert y responde el array de 7 días actualizado.
3. `PUT` con `diaSemana` fuera de 1..7, `habilitado` no booleano o duplicados → 400.
4. Roles: `GET` requiere autenticación (401 sin token); `PUT` requiere `admin` (403 para socio/no_socio).
5. Tests unitarios (node:test) en verde; `npm run build --workspace=api` limpio.

## Progreso

| ID | Estado | Evidencia |
|---|---|---|
| T1 | ✅ RED observado | specs escritos primero: `Cannot find module './dias-funcionamiento.service'` (MODULE_NOT_FOUND) |
| T2 | ✅ GREEN | `npm test --workspace=api` → `DiasFuncionamientoService` 4/4 + `ActualizarDiasFuncionamientoDto` 9/9 |
| T3 | ✅ | suite completa exit 0; `npm run build --workspace=api` → `tsc` limpio (`BUILD_EXIT=0`) |
| T4 | ✅ | este documento |

### Hallazgo del worker (nota)

Los specs con `plainToInstance` + `@Type` anidado necesitan `import 'reflect-metadata';` en la
primera línea, si no fallan con `TypeError: Reflect.getMetadata is not a function`. Ya aplicado
en `dto/actualizar-dias-funcionamiento.dto.spec.ts` (mismo patrón que `turnos-reserva.spec.ts`).

## Verificación (a manual por el usuario)

- Unit: `npm test --workspace=api` (incluye el nuevo spec).
- Build: `npm run build --workspace=api`.
- Manual (Swagger `/api/docs` o curl con token admin): `GET` y `PUT /config/dias-funcionamiento`.

## Next step

T1 — escribir los specs y observar RED.
