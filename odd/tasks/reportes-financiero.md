# Feature: reportes-financiero (ACT-46)

## Objective
Implement `GET /reportes/financiero` (RF-45, contrato §financiero) extending the existing `ReportesModule` in `apps/api`. Jira ACT-46 → En curso (2026-10-03, per workflow rule).

## Problem
Contract specifies financial metrics (ingresos, cuotas, uso de canchas) for the admin panel, but only `GET /reportes/estadisticas` (ACT-45) exists. Same module, same periodo semantics.

## Why
Second ticket of epic ACT-8 Reportes. Together with ACT-45 it feeds the future admin panel (ACT-49).

## Scope
- `GET /reportes/financiero?desde&hasta` (YYYY-MM-DD optional, default current month America/Argentina/Buenos_Aires — reuse resolverPeriodo).
- Response shape exactly per contrato:
  - ingresos {pagosTurno, pagosLuz, cuotasCobradas, total}
  - cuotas {emitidas, montoEmitido, pagadas, parciales, adeudadas}
  - usoCanchas {turnosTotal, horasOcupadas, ocupacionPromedio}
- Errors: 400 invalid date/range, 401/403 via global guards + `@Roles('admin')`.
- Tests alongside behavior (extend stub-Prisma spec pattern).

## Aggregation definitions (PO-visible assumptions, confirm at review)
- F1 ingresos.pagosTurno = Σ pagos_turno.monto_total_turno WHERE fecha_pago ∈ rango. pagosLuz likewise (pagos_luz.monto_total_luz).
- F2 ingresos.cuotasCobradas = Σ lineas_cuota.monto WHERE fecha_pago ∈ rango AND estado = 'registrada' (anuladas excluded).
- F3 cuotas.emitidas = COUNT(cuotas) WHERE fecha_inicio ∈ rango; montoEmitido = Σ monto_total.
- F4 cuotas.pagadas/parciales/adeudadas = COUNT by estado_actual among emitidas; pendiente/cancelada count in emitidas only (documented, confirm).
- F5 usoCanchas.turnosTotal = COUNT(turnos) fecha ∈ rango AND estado_actual != 'cancelado'; horasOcupadas = Σ(hora_fin − hora_inicio).
- F6 ocupacionPromedio = horasOcupadas / (canchas disponibles × días habilitados en rango × horas diarias de rangos_horario from dias_funcionamiento + rangos_horario config). Fallback if no rangos rows: 14h/day (08–22). Flagged for PO confirm — reversible.
- F7 Decimal → Number with 2-decimal rounding at the boundary.

## Constraints
- Extend existing ReportesService/Controller; thin controller, cached `estado_actual` columns, never history tables for aggregates.
- Artifacts English; commits Spanish + English jargon.
- Same branch feat/reportes (stacked work-unit on top of ACT-45); single-pr strategy stands (running total now ~700 lines — exceeds 400 heuristic; split into stacked PRs at delivery per work-unit-commits skill).

## Tasks
- [x] T1 Extend ReportesService with obtenerFinanciero (F1–F7).
- [x] T2 Add GET /reportes/financiero route (admin-only).
- [x] T3 Add financiero-response shape/type.
- [x] T4 Extend reportes.service.spec.ts (RED→GREEN: empty period, ingresos math, cuotas buckets incl. pendiente/cancelada exclusion, usoCanchas math, ocupacionPromedio incl. fallback, 400 reuse).
- [x] T5 Run npm test + tsc, work-unit commit on feat/reportes.

## Authorized scope (Allowed edit surfaces)
apps/api/src/reportes/reportes.service.ts
apps/api/src/reportes/reportes.controller.ts
apps/api/src/reportes/financiero-response.ts
apps/api/src/reportes/dto/consultar-estadisticas.dto.ts
apps/api/src/reportes/reportes.service.spec.ts
odd/tasks/reportes-financiero.md

## Acceptance criteria
- Returns contrato shape; default-month works; invalid date/range → 400; non-admin → 403.
- npm test green (existing 42 + new), tsc clean.

## Applicable checks
- Test-first with stub-Prisma RED. Runner: npm test in apps/api + npx tsc --noEmit -p tsconfig.json.

## Route declaration
- Route: delegated direct (one bounded writer; reading prepares the write → bundled with writer).
- Delivery: single-pr standing, but flag stacked-PRs option at delivery (running total over budget).

## Progress
- ACT-46 → En curso. Writer done (387c901): T1–T4 RED→GREEN, 50 pass, tsc clean.
- Parent spot check 2026-10-03: npm test green (fail 0), tsc clean, tree clean salvo untracked locales.
- Native review: unavailable in this runtime (same as ACT-45 assessment) — no receipt claimed.
- T1–T5 done: `obtenerFinanciero` (F1–F7) + `GET /reportes/financiero` + `financiero-response.ts` + 8 new spec cases, RED observed then GREEN. Closed by work-unit commit on feat/reportes: `feat(reportes): agrega endpoint financiero con ingresos, cuotas y uso de canchas` (npm test 50 pass, tsc clean).

## Next step
Launch bounded writer; parent verifies (npm test + tsc spot check), then report.
