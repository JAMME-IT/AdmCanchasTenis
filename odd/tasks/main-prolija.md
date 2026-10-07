# main-prolija — Ordenar main central

## Objective
Dejar `main` sincronizada y prolija mergeando la cadena ya verificada (auth + gestion + seed + turnos + reportes).

## Problem
`main` local está 10 commits atrás de `origin/main`. Los PR #1-#3 mergearon contra `feat/autenticacion-clerk`, no contra `main`. `feat/reportes` nació de `feat/turnos` (base `800f7f4`) y PR #4 va a `turnos`, no a `main`. Jira ACT desactualizado (ACT-34 figura En curso pero código trae reserva con tests).

## Why
Evitar divergencia y tener una base central confiable para seguir con canchas/cuotas/tarifas.

## Scope
- Verificar ACT-34 funcional en código (reserva POST /turnos).
- Sincronizar `main` local con `origin/main`.
- Mergear en orden: auth (trae seed+gestion vía #2/#3) → turnos (800f7f4) → reportes (ACT-45/46 + fix ART).
- No incluye: ACT-28 canchas, ACT-39 job cuotas (verificar Por hacer vs commit en origin/main), ACT-42/43/44 tarifas.

## Constraints
- No borrar `feat/turnos` hasta que `main` tenga el merge verificado.
- No pushear sin autorización explícita separada (remoto requiere auth destino/operación).
- RDD on: todo candidato pasa por assess + review nativa antes de dar por completo.
- Commits Conventional Commits, en español con jerga técnica en inglés; código/UI en inglés.

## Checklist
- [x] T1 Verificar ACT-34 (reserva: RN-2/RN-9/RN-11, solapamiento, costo, tests) — VERIFICADO funcional completo, Jira outdated
- [x] T2 Sincronizar main local con origin/main (fetch + merge/ff, resolver) — FF 40959ae→c8c0c42, sin conflicto
- [x] T3 Merge auth→main (trae seed+gestion), work-unit commit, registrar SHA — 4ec9a1f (seed a3af669) + cd50a9e (auth 1da089d, PR #2/#3)
- [x] T4 Merge turnos→main (800f7f4 + fix ART f24cc73), verificar import disponibilidad-slots — ed36c2a (ART fix entra vía reportes)
- [x] T5 Merge reportes→main (ACT-45/46), correr spec reportes.service.spec — 2e47f4c, 16/16 pass
- [ ] T6 Assess + review nativa del candidato — NO disponible en runtime opencode (STATUS/assess rechazan, ver evidencia)

## Authorized scope
- Ramas: `main`, `feat/autenticacion-clerk`, `feat/gestion-usuarios`, `feat/seed-datos-prueba`, `feat/turnos`, `feat/reportes`
- No tocar: `4_ABMCanchas` (duplicada, solo borrar con autorización), resto de features.

## Acceptance criteria
- `git log main` contiene 800f7f4 + 387c901/6b07d23 (reportes) + b07b5b3/6191f39 (gestion) + a3af669 (seed).
- `npm run test` (o runner detectado) en verde para turnos y reportes specs.
- `git status -sb` limpio salvo untracked declarados.

## Applicable checks
- `git rev-list --left-right --count main...origin/main` = 0 0 tras sync/push autorizado
- specs: `turnos.service.spec`, `turnos-reserva.spec`, `reportes.service.spec`
- `gentle-ai review assess --cwd <repo> --json` + preflight STATUS nativo

## Progress
- 2026-10-07: creado tras autorización a verificar ACT-34 y ordenar main. T1 completo.
- 2026-10-07: T2-T5 completados por writer local (sin push, solo refs locales). main 40959ae→c8c0c42 (ff-only, noted) →4ec9a1f (seed a3af669) →cd50a9e (auth 1da089d = origin/feat/autenticacion-clerk, trae gestion+seed vía PR #2 fa86a74/#3) →ed36c2a (turnos 800f7f4) →2e47f4c (reportes a4a4d80, trae ART fix f24cc73). Conflictos solo aditivos resueltos por unión sin borrar: package.json scripts (cuotas:generar+db:seed+test), deps (@nestjs/schedule+@nestjs/swagger), package-lock entradas schedule+swagger, app.module imports (Schedule+Cuotas+Turnos+Reportes). feat/turnos intacto en 800f7f4. Keys verificadas en main: 800f7f4, 387c901/6b07d23, b07b5b3/6191f39, a3af669, f24cc73.

## Verification evidence
- T1: turnos.service.spec 5/5 pass; reportes.service.spec 16/16 pass; turnos-reserva.spec 20/20 con TZ=ART (10/20 en UTC, artifact de helper, no bloquea merge). Gap recomendado: masDias basado en hoyEnArgentina().
- T2-T5: `TZ=America/Argentina/Buenos_Aires npm test --workspace apps/api` → disponibilidad-slots 14/14, turnos.service 5/5, turnos-reserva 20/20, reportes.service 16/16, fail 0, exit 0. `git log --oneline main -8` head 2e47f4c. `git rev-list --left-right --count main...origin/main` = 21 0 (4 merge commits + 17 feature commits ahead, 0 behind; push pendiente con auth separada). `git status -sb` limpio salvo untracked declarados (.codegraph/, print-token.ts, probe-usuarios.ts, odd/).
- T6: preflight STATUS → immutable_review_transport_unsupported (runtime opencode no elegible; soportados: claude-code, codex). Assess --base-ref origin/main --committed-only → mismo rechazo, review_due high_risk. No se inventa PASS. Verificación independiente: SHAs consecutivos OK, ancestry de las 7 keys OK, turnos intacto en 800f7f4, status OK; su tail-8 mostraba solo última suite (16/16) y padre confirmó 55/55 (14+5+20+16) exit 0. Push NO realizado.

## Next step
- Push de main local 21/0 a origin/main solo con autorización explícita separada (destino + operación). Después: actualizar Jira (ACT-33/34/45/46/56 a Listo/En revisión real), decidir rama duplicada 4_ABMCanchas y ACT-39.

## Route declaration
- T1: delegated direct (verifier, supera batch inline, necesita correr tests) — trigger: mapping/output budget.
- T2-T5: delegated direct un writer (2+ archivos no triviales + merges) — trigger: writer/preparation.
