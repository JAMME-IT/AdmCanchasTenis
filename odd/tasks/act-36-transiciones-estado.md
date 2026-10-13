# act-36-transiciones-estado — PATCH /turnos/:id/estado

## Objective
Implementar el endpoint `PATCH /turnos/:id/estado` (historia Jira ACT-36) en `apps/api`: aplicar transiciones del ciclo de vida del turno con snapshot combinado `(valorEstado, valorEstadoPago)` en `estados_turno`, admin-only, según API-CONTRATO §5.3.

## Problem
El modelo ya persiste el ciclo de vida (`turnos.estado_actual` + historial `estados_turno`, DB-SCHEMA decisión 1), pero no existe endpoint que lo opere: las transiciones `confirmado → iniciado/no_asistio` e `iniciado → finalizado` solo se podrían hacer por DB. La cancelación ya vive en `POST /turnos/:id/cancelar` (ACT-35, no mergeada en main), que conserva RN-1 y el motivo.

## Why
Cubrir CU22 (ciclo de vida del turno) y el contrato §5.3 sin crear requerimientos nuevos: el endpoint replica en la API la tabla de transiciones ya documentada y respeta la invariante de transición única (historial + caché en la misma transacción).

## Scope
- `apps/api/src/turnos/estados-turno.ts` (nuevo): módulo puro sin decorators NestJS con la tabla de transiciones y helpers `transicionPermitida` / `estadosDestinoDe` (mismo espíritu que `disponibilidad-slots.ts`).
- `apps/api/src/turnos/dto/actualizar-estado-turno.dto.ts` (nuevo): `estado` con el dominio completo del enum `estado_turno` (400 solo fuera del enum), `motivo` opcional nullable 1-500.
- `apps/api/src/turnos/turnos.controller.ts`: ruta `@Patch(':id/estado')` con `@Roles('admin')` y `ParseUUIDPipe`.
- `apps/api/src/turnos/turnos.service.ts`: método `cambiarEstado(id, dto)` — 404 → 422 (igual al actual, `cancelado`, tabla) → transacción (update caché + create historial) → `toTurnoResponse`.
- `apps/api/src/turnos/turnos-estado.spec.ts` (nuevo): node:test + ts-node con stubs manuales de PrismaService.
- `apps/api/package.json`: registro del spec nuevo al final de la cadena `&&` del script `test`.
- No incluye: `docs/API-CONTRATO.md` (ya está al día), código de ACT-35 (no está en main y no se copia), `POST /turnos/:id/cancelar`, otras features.

## Constraints
- Commits Conventional Commits; el código y comentarios en inglés, mensajes de API en español sin acentos.
- RDD on cuando el runtime lo permita (assess + review nativa).
- Estado `cancelado` NO se acepta como destino en este endpoint: solo via `POST /turnos/:id/cancelar` (preserva RN-1 y el motivo).
- 422 (UnprocessableEntityException) para transición no permitida, estado igual al actual y `cancelado`; 400 solo para token fuera del enum.
- Montos/tiempos: no se tocan. Zona horaria ART: sin regla de reloj acá.
- Trabajar SOLO en los archivos listados; no tocar la rama ACT-35.

## Checklist
- [x] T1 Módulo puro `estados-turno.ts` con tabla completa y helpers.
- [x] T2 DTO `ActualizarEstadoTurnoDto` (dominio completo del enum + motivo opcional nullable 1-500).
- [x] T3 Controller `@Patch(':id/estado')` admin-only con `ParseUUIDPipe` y `@ApiOperation`.
- [x] T4 Service `cambiarEstado` (404 → 422 → transacción → response).
- [x] T5 Spec `turnos-estado.spec.ts` (módulo puro, service, DTO, controller).
- [x] T6 Registro del spec en el script `test` de `apps/api/package.json`.
- [x] T7 `npm --prefix apps/api test` en verde (suite completa) y `npm --prefix apps/api run build` exit 0.

## Authorized scope
- Archivos: los 7 puntos de Scope (3 nuevos, 3 editados, docs ODD exceptuado de edición: `docs/API-CONTRATO.md` no se toca).
- Ramas: `feat/ACT-36-transiciones-estado` (creada desde `origin/main`); la rama `feat/ACT-35-cancelar-turno` NO se toca.
- Prohibido: commits al finalizar (working tree con cambios), push, edición de otras features/módulos.

## Acceptance criteria
- `PATCH /turnos/:id/estado` responde 200 con el `Turno` actualizado (caché e historial en una única transacción, snapshot con `valor_estado_pago` previo).
- Errores: 400 (enum inválido), 401, 403 (rol), 404 (turno inexistente), 422 (transición no permitida, estado igual, `cancelado`).
- Suite completa en verde (78 tests existentes + los nuevos) y `npm run build` exit 0.

## Applicable checks
- `npm --prefix apps/api test` → todos los specs verdes.
- `npm --prefix apps/api run build` → exit 0.
- `git status --short` → solo los archivos del Scope + `.codegraph/` (untracked preexistente).
- Revisión manual del diff: sin cambios fuera de turnos/package.json/odd.

## Progress
- 2026-10-12: creado. T1-T7 completados por subagente (writer), sin commit ni push por mandato.
- 2026-10-12: gatekeeper del orquestador. Verificacion independiente: suite completa 93/93 (78 previos + 15 nuevos), build exit 0, diff revisado sin cambios fuera del Scope. Intento de review nativa RDD: preflight rechazado con envelope tipado `gentle-ai.review-integration.failure/v2` / `immutable_review_transport_unsupported` (runtimes inmutables soportados: claude-code, codex; opencode no soportado) — misma limitacion ya registrada en `main-prolija.md` T6 (2026-10-07); no es defecto del proveedor, es su contrato documentado.

## Verification evidence
- `npm --prefix apps/api test`: 93/93 pass, fail 0, exit 0 (2026-10-12).
- `npm --prefix apps/api run build`: exit 0 (2026-10-12).
- `gentle-ai review status --cwd <repo> --contract gentle-ai.review-integration/v2 --agent opencode --next-transition`: failure/v2 `immutable_review_transport_unsupported`, mutation_outcome `not_started`, next_action `stop` (preservado tal cual, sin inventar PASS).