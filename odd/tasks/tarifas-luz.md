# tarifas-luz — Feature document

> Branch: `feat/tarifas-luz` (desde `main` c8c0c42c). User-owned RDD: consultar antes de commit.

## Objective

Implementar el módulo `tarifas` de la API (NestJS) según `docs/API-CONTRATO.md` §5.8,
arrancando por el ticket ACT-42 (Tarifas de turno y cuota) con TDD estricto.

## Tickets

- **ACT-42** (Historia, Medium, Por hacer): `PUT /tarifas/turno` (RF-27), `PUT /tarifas/cuota` (RF-29), `GET /tarifas` (RF-43).
  Criterio: historial append-only; la vigente es la de mayor `fecha_cambio <= now()`.
  - Decisión confirmada por el usuario: si no existe tarifa vigente de un tipo, `GET /tarifas` devuelve `null` en ese campo (sin 404).
- Módulo completo (futuro, OTROS tickets): `PUT /tarifas/luz` (RF-28/RF-16), `GET /tarifas/historial` (RF-30/RF-31).

## Scope autorizado (por tarea)

### TAR-1 — Andamiaje Jest + primer test RED (TDD estricto)
- Configurar Jest en `apps/api` (jest.config.js + script `test`), devDeps `jest@30`, `ts-jest@29`, `@types/jest@30`.
- Escribir `apps/api/src/tarifas/tarifas.service.spec.ts` con el contrato del ticket ACT-42:
  `actualizarTarifaTurno`, `actualizarTarifaCuota`, `obtenerVigentes` (null por tipo sin historial).
- Ejecutar el test y verificar que FALLA (RED). Detenerse: el usuario dará luz verde para la implementación.
- Excepción documentada: el cliente Prisma generado (`src/generated/prisma`) no existe en el checkout;
  el test unitario mockea Prisma (sin importar `PrismaService` real). No se aplica test de integración con DB.
- Pendiente no bloqueante: Node local v22 vs `engines >=24` (`.nvmrc`).

### TAR-2+ — Implementación (pendiente de luz verde)
- DTOs: `actualizar-tarifa-turno.dto.ts` (`costoXHora number >= 0`), `actualizar-tarifa-cuota.dto.ts` (`precio number >= 0`).
- `tarifas.service.ts`: insert append-only en `valores_turno` / `valores_cuota`; leer vigente
  (`fecha_cambio <= now()` desc limit 1); `obtenerVigentes` con `null` por tipo sin historial.
- `tarifa-response.ts`: mappers Decimal → number, snake_case → camelCase.
- `tarifas.controller.ts`: `@Controller('tarifas')`, `PUT turno|cuota` con `@Roles('admin')`, `GET` autenticado.
- `tarifas.module.ts` + registro en `app.module.ts`.

## Rutas (riesgo de ruta por tarea)

| Tarea | Ruta | Trigger |
|---|---|---|
| TAR-1 | inline (config + 1 spec, ya entendido) | write pequeño y mecánico |
| TAR-2+ | delegate writer | 2+ archivos no triviales |

## Acceptance criteria (por ticket)

- ACT-42:
  1. `PUT /tarifas/turno` inserta fila en `valores_turno` y responde la vigente `{ id, costoXHora, fechaCambio }`. Solo admin (403 resto).
  2. `PUT /tarifas/cuota` inserta fila en `valores_cuota` y responde la vigente `{ id, precio, fechaCambio }`. Solo admin.
  3. `GET /tarifas` responde `{ turno, luz, cuota }` con la vigente de cada tipo; `null` si no hay historial.
  4. 400 con `costoXHora`/`precio` inválido o negativo.

## Progreso

| Tarea | Estado | Evidencia |
|---|---|---|
| TAR-1 | ✅ cerrada (RED) | `Cannot find module './tarifas.service'` (suite fails, contract define) |
| TAR-2+ | ✅ GREEN | `npm test --workspace=api` → 4 passed (commit 6b345a7) |
| TAR-3 (review reliability) | ✅ corregida | 22/22 tests + build OK; sin recibo nativo (runtime no admite captura) |

## Hallazgos de review (lente review-reliability, lineage review-54bf024203864cc1)

La captura nativa no fue admisible en este runtime (transporte rechazó el relay; y la
admisión rechaza `proof_refs` tipo `changed-hunk:` fuera del repo congelado). El usuario
eligió corregir sin recibo nativo. Estado por hallazgo:

| ID | Sev | Hallazgo | Resolución |
|---|---|---|---|
| R3-001 | CRITICAL | Tests dependían de la TZ del host (verde solo en GMT-0300) | ✅ `formatearFechaCambio` usa offset fijo del club (UTC-03:00); tests de determinismo agregados (`tarifa-response.spec.ts`) |
| R3-002 | CRITICAL | Jest sin guarda contra `.only` (suite parcial pasaría verde) | ✅ `ci: true` en `jest.config.js` (equivale a forbidOnly) |
| R3-003 | WARNING | `fechaCambio` usaba la TZ del servidor, no la del club | ✅ mismo fix que R3-001: offset fijo del club |
| R3-004 | WARNING (falso positivo) | El INSERT no setea `fecha_cambio`; dependería de un default invisible | ✅ Verificado: `valores_turno`/`valores_cuota` tienen `fecha_cambio timestamptz not null default now()` (migración líneas 176/231) y el comentario confirma "vigente = mayor fecha_cambio <= now()". No es defecto. |
| R3-005 | WARNING | Criterio 4 (400 con valores inválidos) sin cobertura | ✅ `dto/actualizar-tarifa.dto.spec.ts`: negativos, borde cero, >2 decimales, faltante, no numérico |
| R3-006 | WARNING | Rama `luz` sin tests; `findFirst` sin orden (no determinista) | ✅ 2 tests de rama luz + `orderBy: { created_at: 'desc' }` |
| R3-007 | SUGGESTION | `aNumero`/`aHora` sin casos Decimal/TIME degenerados | ✅ `aNumero` prefiere `toNumber()` de Prisma Decimal; tests de Decimal y TIME |

## Defecto adicional descubierto (no del review)

`npm run build --workspace=api` **fallaba**: `tsc -p tsconfig.json` compilaba los
`.spec.ts` y sin los tipos de Jest en `types` daba TS2593/TS2304. El CI hace
`db:generate` + `build`, así que el commit 6b345a7 habría roto CI.
Fix: `apps/api/tsconfig.build.json` (extiende el tsconfig y excluye `**/*.spec.ts`)
y script `build` apuntando a él. Verificado: build limpio.