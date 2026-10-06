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
| TAR-2+ | ✅ GREEN | `npm test --workspace=api` → 1 suite, 4 tests, 4 passed (13.3s) |