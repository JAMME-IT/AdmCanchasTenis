# abm-canchas — ABM de canchas (ACT-28 + ACT-29)

## Objective
Implementar el módulo `canchas` en `apps/api` para cerrar el feature ABM de canchas del contrato API §5.5: listado, alta, edición y cambio de estado operativo, con tests en verde.

## Problem
No existe `apps/api/src/canchas/` (ni controller/module/service/DTOs). El contrato §5.5 hoy solo documenta `GET /canchas` y `PATCH /canchas/:id/estado`; el ticket ACT-28 pide además alta (`POST`) y edición (`PATCH`). La tabla `canchas` y `estados_cancha` ya existen en la migración inicial (`estados_cancha.motivo` confirmado), así que no hace falta migración.

## Why
Cerrar el branch `4_ABMCanchas` con el ABM de canchas funcionando (ACT-28 en curso). Requerido por RF-17 (estado con motivo) y soporte de RF-12 (elegir cancha).

## Scope
- `GET /canchas` — catálogo. Query `conEstados` (boolean, default `false`, solo admin): agrega historial `estados[]`. Roles: autenticados.
- `POST /canchas` — alta (admin): `{ nroCancha, superficie, iluminacion? }`. Crea la fila + fila inicial en `estados_cancha` (`disponible`, sin motivo) en una transacción.
- `PATCH /canchas/:id` — edición (admin): `{ nroCancha?, superficie?, iluminacion? }` (al menos uno). No toca estado.
- `PATCH /canchas/:id/estado` — cambio de estado (admin): `{ estado, motivo? }`; `motivo` requerido si `estado != disponible` (1–500). Inserta `estados_cancha` + actualiza `canchas.estado_actual` en una transacción. `422` si el estado es igual al actual.
- Tests con `node:test` + stubs manuales de Prisma, cableados en el script `test` del workspace `api`.
- Actualizar `docs/API-CONTRATO.md` §4 (matriz) y §5.5 (endpoints nuevos).
- No incluye: frontend / panel admin (ACT-49), DELETE de canchas (baja = estado `inhabilitada`), cancelación de turnos futuros al cambiar estado (§7.19).

## Constraints
- Convenciones del equipo: commits Conventional Commits **en español con jerga técnica en inglés**; sin `Co-Authored-By`.
- Identifiers de dominio en español; comentarios/JSDoc en español sin acentos; Swagger descriptivo en español sin acentos; tipos técnicos (`Response`/`Dto`/`Schema`) en inglés.
- Patrón historial + caché (ADR-0004): `estado_actual` es caché del último `estados_cancha`; ambos se escriben en la misma `$transaction`.
- `PrismaModule` es `@Global()`: el módulo nuevo NO lo importa.
- Roles: guard global; alcanza con `@Roles('admin')` en el handler admin-only.
- `nro_cancha` es único (`uq_canchas_nro`) → `409 Conflict` en alta/edición duplicada.

## Checklist
- [x] T1 — Scaffold del módulo `canchas` + `GET /canchas` (con `conEstados` solo admin) + `CanchaResponse`/`CanchaSchema` + registrar en `app.module.ts` + wire del spec en `package.json`. Tests del listado.
- [x] T2 — `POST /canchas` (alta) + `PATCH /canchas/:id` (edición) con DTOs y validación; unicidad `nro_cancha` → 409. Tests.
- [x] T3 — `PATCH /canchas/:id/estado` (historial append-only + caché en una tx; `motivo` condicional; 422 estado igual al actual). Tests.
- [x] T4 — Documentar §5.5 (POST/PATCH) y matriz §4 en `docs/API-CONTRATO.md`; correr suite completa del workspace `api`.

## Authorized scope
- `apps/api/src/canchas/**` (nuevo)
- `apps/api/src/app.module.ts`
- `apps/api/package.json`
- `docs/API-CONTRATO.md`
- `odd/tasks/abm-canchas.md`
- No tocar: `apps/api/prisma/**` (sin migración), `apps/web/**`, módulos existentes más allá del registro.

## Acceptance criteria
- Los 4 endpoints responden según contrato y validaciones (401/403/404/409/422 donde corresponde).
- `npm test --workspace api` en verde (specs previos + nuevo `canchas.service.spec`).
- `docs/API-CONTRATO.md` §5.5 y §4 reflejan POST/PATCH nuevos.
- `git status` limpio tras los commits (salvo untracked declarados).

## Applicable checks
- `TZ=America/Argentina/Buenos_Aires npm test --workspace api` (cadena de specs ts-node, incluye el nuevo).
- `npx tsc -p apps/api/tsconfig.json --noEmit` (o `npm run build --workspace api`).
- `gentle-ai review assess --cwd <repo> --json` + preflight STATUS nativo tras el candidato (RDD on; en runtime opencode puede rechazar el transporte nativo — registrar honesto si no está disponible).

## Delivery strategy
- Estrategia: `single-pr` (el usuario pidió cerrar un único branch `4_ABMCanchas`). Forecast ~600–700 líneas autoradas; si supera el presupuesto y se quiere priorizar foco de review, ofrecer chained-pr.

## Progress
- 2026-10-10: creado. Branch `4_ABMCanchas` fast-forwardeado a `origin/main` (76f5b6e). Alcance fijado desde Jira ACT-28/ACT-29 + contrato §5.5. Patrones mapeados (explorer).
- 2026-10-10: T1–T4 implementados test-first (RED: módulo/DTOs ausentes; GREEN por tarea). Spec `canchas.service.spec.ts` con 15 tests (listado 3, alta 3, edición 4, cambio de estado 5). Suite completa del workspace `api` en verde y build OK.
- 2026-10-10: review nativa (RDD on, tier medium, `slice_budget_reached`) — consent otorgado; `review start` creó la transacción (lente `review-reliability`). La captura del lente fue rechazada por el transporte de review de OpenCode (`opencode_review_transport_relay_refused`, `binding_mismatch`) dos veces, pasando el binding exacto del proveedor. El STATUS de la misma línea quedó en `collect` sin PASS. Con decisión del usuario: no se reportó el defecto y se declinó el candidato (`action: declined`, `consent: declined_this_candidate`). Se aplicó la vía RDD off-path (tier medium: writer self-verification + spot check del parent).

## Route declaration
- T1–T3: delegated direct — un writer (2+ archivos no triviales). Trigger: writer/preparation.
- T4 + verificación: parent + verifier.

## Commit evidence
- T1 `3eba803` — `feat(api): agrega modulo canchas con listado y conEstados (ACT-29)`
- T2 `d53335f` — `feat(api): agrega alta y edicion de canchas (ACT-28)`
- T3 `b37c64e` — `feat(api): agrega cambio de estado de cancha con historial (ACT-28)`
- T4 `4ca63c4` — `docs(api): documenta alta y edicion de canchas en el contrato (ACT-28)`
- Cierre (este doc) — `docs(odd): cierra abm-canchas con evidencias y SHAs`

## Verification evidence
- `npm run db:generate --workspace api` (con `DIRECT_URL` dummy; el cliente Prisma no estaba generado): `✔ Generated Prisma Client (7.10.0) to .\src\generated\prisma in 211ms`.
- `TZ=America/Argentina/Buenos_Aires npm test --workspace api`: PASS — specs previos + `canchas.service.spec` (15/15), sin fallos; exit 0.
- `npm run build --workspace api`: exit 0 (tsc sin errores).
- Nota entorno: el workspace no tenía dependencias instaladas (`@nestjs/schedule` faltante rompía `cuotas-pagos.spec`); se resolvió con `npm ci` en la raíz (sin cambios de lockfile).
- 2026-10-10 (spot check del parent, independiente): `TZ=America/Argentina/Buenos_Aires npm test --workspace api` → exit 0; `canchas` 15/15, suite completa sin fallos.
- Review nativa: NO completable en este runtime (el transporte OpenCode rechazó el relay). Sin PASS inventado; candidato declinado por decisión del usuario. Pendiente: re-correr la review en un runtime soportado (claude-code/codex) cuando esté disponible.

## Next step
- Decisión humana: `push` de `4_ABMCanchas` (31 commits ahead de `origin/4_ABMCanchas`) y apertura de PR. Opcional: re-correr la review nativa en un runtime soportado o cuando el transporte se arregle.
- Actualizar Jira: ACT-28/ACT-29 a En revisión/Listo según corresponda.
