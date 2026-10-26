# ACT-32 — Duración de turno configurable (config) — Feature document

> Branch: `feat/ACT-32-duracion-turno` (desde `main` e1ef696). RDD on.
> Convención: commits en español con jerga técnica en inglés, Conventional Commits, sin `Co-Authored-By`.

## Objective

Implementar en `apps/api` el endpoint que permite al admin modificar la **duración** de un
tipo de turno, según el requerimiento **RF-15** y `docs/API-CONTRATO.md` §7 (punto 9):

- `PATCH /config/tipos-turno/:id` — solo admin — modifica `tipos_turno.duracion_max`.

## Problem / Why

Hoy `tipos_turno` solo tiene los seeds 60 y 90 minutos; la disponibilidad y la reserva leen
`duracion_max` para generar slots y calcular `horaFin = horaInicio + duracion_max`. Para cambiar
la duración hay que tocar la base a mano. RF-15 quedó pendiente de endpoint para v1.1 y el
contrato propone exactamente esta ruta. Impacta de inmediato en la disponibilidad y en las
reservas nuevas.

## Scope autorizado

- `apps/api/src/config/` — solo tipos de turno.
- Registro del provider en `config.module.ts` y la ruta en `config.controller.ts`.
- Alta de los specs en el script `test` de `apps/api/package.json`.
- Fuera de alcance: `GET /config/tipos-turno` (el contrato no lo define), otras configuraciones,
  y cualquier cambio retroactivo a turnos ya reservados.

## Constraints / decisiones

- **Contrato**: no define body, response ni errores; la ruta nace de §7.9 y del ticket ACT-32.
  Se sigue el patrón de `config` y de `PATCH /canchas/:id`.
- **Body**: `{ "duracionMinutos": 75 }`. Se expone `duracionMinutos` (no `duracionMax`) para que
  el nombre coincida con el que ya usa la API en `GET /turnos/disponibilidad` y en la reserva;
  el mapper traduce `duracion_max → duracionMinutos`.
- **Response 200**: `{ "id": "uuid", "duracionMinutos": 75 }`.
- **Validación**: entero (`@IsInt`) con rango **15..240** minutos. Supuesto explícito: el contrato
  no fija rango; 15 evita grillas de slots patológicas y 240 el techo razonable de un turno. Es un
  valor ajustable en una línea si el club define otra política.
- **404** si el `id` no existe (`NotFoundException`), como el resto de los PATCH por `:id`.
- **409** si ya existe otro tipo con esa duración (`uq_tipos_turno_duracion_max`); se mapea `P2002`
  con un helper local, igual que `canchas.service.ts`.
- **400** body inválido (no entero, fuera de rango, faltante) vía `ValidationPipe` global.
- **401/403**: requiere autenticación y rol `admin`.
- **Sin transacción**: es un único `update`. Se setea `updated_at` explícito (el modelo no tiene
  `@updatedAt`), como en `dias_funcionamiento` y `rangos_horario`.
- **Sin cambio retroactivo**: los turnos ya reservados conservan su `hora_fin` guardada; el nuevo
  valor aplica a la disponibilidad y a las reservas siguientes. Si la nueva grilla no alinea con un
  turno existente, la validación de solapamiento de la reserva ya lo cubre.
- **TDD estricto**: specs primero, RED observado, después implementación.

## Tasks

| ID | Tarea | Ruta | Trigger |
|---|---|---|---|
| T1 | Feature doc | inline | mecánico |
| T2 | Specs (service + DTO) en RED | delegate writer | 2+ archivos no triviales |
| T3 | Implementación (response, schema, dto, service, controller, module) → GREEN | delegate writer | 2+ archivos no triviales |
| T4 | Cablear specs en `test` + suite completa + `build` | delegate writer | verificación |
| T5 | Commit work-unit + actualizar doc | inline | mecánico |

## Acceptance criteria

1. `PATCH /config/tipos-turno/:id` (admin) actualiza `duracion_max` y responde `{ id, duracionMinutos }`.
2. `id` inexistente → 404.
3. Duración igual a la de otro tipo existente → 409.
4. Body con `duracionMinutos` no entero, menor a 15, mayor a 240 o faltante → 400.
5. Sin token → 401; rol no admin → 403.
6. La disponibilidad refleja la nueva duración en los slots y en `duracionMinutos` de la respuesta.
7. Tests unitarios (node:test) en verde; `npm run build --workspace=api` limpio.

## Progreso

| ID | Estado | Evidencia |
|---|---|---|
| T1 | ✅ | este documento |
| T2 | ✅ RED observado | `Cannot find module './tipos-turno.service'` y `Cannot find module './actualizar-tipo-turno.dto'` (MODULE_NOT_FOUND) |
| T3 | ✅ GREEN | `TiposTurnoService` 5/5 + `ActualizarTipoTurnoDto` 10/10 |
| T4 | ✅ | suite completa `npm test --workspace=api` exit 0; `npm run build --workspace=api` → `tsc` limpio |
| T5 | ✅ | commit de este work unit (ver Commits) |

### Verificación funcional en vivo (2026-10-25)

API reiniciada con el código nuevo; 18/18 PASS:

| Caso | Resultado |
|---|---|
| `PATCH` 60 → 75 (admin) y shape `{ id, duracionMinutos }` | 200 |
| `GET /turnos/disponibilidad?tipoTurnoId=<60>` tras el cambio | `duracionMinutos: 75`, slots 08:00, 09:15, 10:30… |
| `PATCH` a una duración ya usada (90) | 409 |
| `PATCH` id inexistente | 404 |
| `PATCH` 14 / 241 / `"75"` / sin body / id malformado | 400 |
| `PATCH` con no_socio / sin token | 403 / 401 |
| `PATCH` mismo valor (75 → 75) | 200 |
| Restore 75 → 60 y disponibilidad | 60 |
| Swagger `/api/docs.json` | expone el PATCH |

## Commits

- `9604dc0` — `feat(api): duracion configurable de tipos de turno (ACT-32, RF-15)`.

## Review nativa (RDD)

- `review assess`: `risk: medium`, `review_due: true` (`slice_budget_reached`, 433 líneas).
- Consentimiento del candidato: **el usuario eligió saltar esta vez** (`declined_this_candidate`).
  Se ejecutó el decline candidato-scoped; no se creó registro de review y la entrega sigue bajo
  política ordinaria del repo. No se hizo ninguna operación de lifecycle adicional.

## Verificación (a manual por el usuario)

- Unit: `npm test --workspace=api` (incluye los nuevos specs).
- Build: `npm run build --workspace=api`.
- Manual (Swagger `/api/docs` o curl con token admin): `PATCH /config/tipos-turno/:id`, y después
  `GET /turnos/disponibilidad?fecha=<mañana>&tipoTurnoId=<id>` para confirmar que cambió
  `duracionMinutos` y la grilla de slots.
- IDs actuales de los seeds: 60 min `016a91be-5bc3-4b73-ab3e-e671a2faf0fa`,
  90 min `e7d99191-7ed9-4bb6-8188-f5abc9078db8`.

## Review humano del PR #12 (2026-10-26)

Un solo hallazgo, de documentación: el PR implementaba el endpoint propuesto para RF-15 pero
`docs/API-CONTRATO.md` seguía diciendo «sin endpoint en v1, pendiente de endpoint para v1.1».

- §2 (tabla de roles): se agregó `PATCH /config/tipos-turno/:id` como solo admin.
- §5.6: nueva subsección con roles, request, validaciones, response y errores (incluido el 409 por
  `uq_tipos_turno_duracion_max` y la nota de que intercambiar duraciones necesita un valor intermedio).
- §6: RF-15 pasa de `Pendiente (v1.1)` a `Cubierto`.
- §7 nota 9: pasa de «pendiente de endpoint» a «resuelto en `PATCH /config/tipos-turno/:id`».
- Resumen: 44 cubiertos por endpoints, sin pendientes de endpoint.

No se tocó el DTO: rechazar `"75"` como string es una decisión deliberada (con test propio) y
coincide con `actualizar-dias-funcionamiento.dto.ts`.

Evidencia: rama actualizada con `main` (ya incluye el merge de #11), `npm test --workspace=api`
exit 0 y `npm run build --workspace=api` exit 0.

## Next step

Review nativa del work unit y, si se cierra, push de la rama y PR.
