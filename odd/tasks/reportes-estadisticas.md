# Feature: reportes-estadisticas (ACT-45)

## Objective
Implement `GET /reportes/estadisticas` (RF-32, contrato §5.10) as new admin-only `ReportesModule` in `apps/api`.

## Problem
Contract specifies general club metrics for admin panel, but no `apps/api/src/reportes/` module exists. `AppModule` only wires Turnos, Usuarios, Auth, Prisma, Webhooks.

## Why
First ticket of epic ACT-8 Reportes. Unlocks admin panel stats; base for ACT-46 financiero.

## Scope
- `GET /reportes/estadisticas?desde&hasta` (YYYY-MM-DD optional, default current month America/Argentina/Buenos_Aires).
- Response shape exactly per contrato §5.10: periodo, turnos {total, porEstado, porCancha[], porFranja[]}, usuarios {sociosActivos, noSocios, morosos}.
- Errors: 400 invalid date/range, 401 unauth, 403 non-admin (via global guards).
- Tests alongside behavior (stub-Prisma spec pattern).

## Constraints
- Follow Turnos/Usuarios patterns: thin controller, service with Prisma, DTO with class-validator.
- Use cached `estado_actual` columns for stats, not history tables (DOMINIO + ADR-0004).
- Global `ClerkAuthGuard+RolesGuard` already enforce admin; only add `@Roles('admin')`.
- Artifacts default English; reply voice Rioplatense.
- Base branch: feat/reportes (from feat/turnos @800f7f4, includes auth+usuarios+turnos).

## Tasks
- [ ] T1 Verify contract + Prisma fields against live schema (parent done: spot-checked §5.10).
- [x] T2 Implement DTO `consultar-estadisticas` (desde/hasta validation + default month).
- [x] T3 Implement `ReportesService` aggregations (turnos groupBy estado/cancha/hora, usuarios counts).
- [x] T4 Implement `ReportesController` + `ReportesModule` + wire in `AppModule`.
- [x] T5 Add `reportes.service.spec.ts` (stub-Prisma, empty period, math, default-month, 400 path).
- [ ] T6 Run `npm test` in apps/api + Swagger check, work-unit commit.

## Authorized scope (Allowed edit surfaces)
- apps/api/src/reportes/
- apps/api/src/reportes/dto/
- apps/api/src/app.module.ts
- apps/api/src/reportes/*.spec.ts

## Acceptance criteria
- `GET /reportes/estadisticas` returns contrato §5.10 shape for a seeded period.
- Default month behavior works; invalid date/range → 400.
- Non-admin → 403, no token → 401 (via existing guards).
- `npm test` passes for new + existing specs.

## Applicable checks
- Test-first: stub-Prisma RED before GREEN (relevant runnable deterministic test exists: turnos.service.spec.ts pattern). Runner: `npm test` in apps/api (`ts-node --transpile-only` specs).
- Structural readback for docs-only edits; no native review cycle per TODO checkbox.

## Route declaration
- Route: delegated direct (one bounded writer for 2+ non-trivial files).
- Trigger evidence: writer trigger (new module = 4+ new files) + preparation trigger (contract+Prisma reading prepares write). Explorer already delegated for mapping (mapping trigger).
- Delivery strategy: single-pr (forecast <400 authored lines, no chaining).

## Progress
- Branch feat/reportes created from feat/turnos.
- Explorer map complete; contract §5.10 spot-checked.
- DECIDED (PO 2026-10-03): usuarios counting = rol vigente + estado. sociosActivos = rol socio vigente (usuarios_roles.fecha_fin IS NULL → roles.nombre='socio') AND estado_actual='activo'; morosos = estado_actual='moroso' (any role); noSocios = resto sin rol socio vigente. Role wins over socios row on conflict (ACT-24/27 history is source of truth).
- Writer done (6b07d23): T2–T5 implemented RED→GREEN, 36 pass, tsc clean. Commit ~480 insertions (over 400 heuristic, kept as one working unit).
- Parent: wired reportes.service.spec.ts into apps/api test script; npm test + tsc re-verified.
- PENDING: live Swagger/docs check (needs DB/Clerk env; Supabase public is empty per 2026-10-03 discovery).
- Native review UNAVAILABLE in this runtime: assess --base-ref 800f7f4 --committed-only → risk high / unassessable ("active runtime is not eligible for immutable receipt review; supported: claude-code, codex"). No receipt claimed. Options: review from claude-code/codex, or clone-local RDD disable, or ship under ordinary repo policy.
- T2–T5 closed on feat/reportes by `feat(api): agrega GET /reportes/estadisticas con agregaciones por estado/cancha/franja (ACT-45)` (find it via `git log --grep ACT-45`; TDD RED→GREEN, `npm test` 36 pass / `tsc --noEmit` clean, observed 2026-10-03).

## Next step
Resolve usuarios counting question, then launch one bounded writer with TDD + allowed surfaces above.
