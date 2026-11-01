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

> **Nota de sincronización (2026-11-01):** `main` reemplazó Jest por el runner nativo
> `node:test` + `ts-node --transpile-only` y eliminó `jest.config.js`/`tsconfig.build.json`.
> Todo el trabajo nuevo (ACT-43 en adelante) sigue la convención nativa; las menciones a
> Jest arriba son históricas de ACT-42.

## ACT-43 — Luz: tarifa, franja y pagos (En curso)

Rama: `feat/tarifas-luz-act43` (desde `main` 9c79716). Criterios: RF-16, RF-28, RF-33, RF-44.
Decisión confirmada: `PUT /tarifas/luz` hace **upsert** de la fila operativa; el costo se
versiona en `estados_luz` solo si cambia; la franja no se versiona.

### Tareas TDD (node:test)

| Tarea | Endpoint | Archivos | Estado |
|---|---|---|---|
| TAR-4 | `PUT /tarifas/luz` | `dto/actualizar-tarifa-luz.dto.ts`, `tarifas.service.ts`, `tarifas.controller.ts`, `tarifa-response.ts` + specs | ✅ GREEN |
| TAR-5 | `POST /pagos-luz` | módulo nuevo `pagos-luz/` (controller/service/dto/response/module) + specs | ✅ GREEN |
| TAR-6 | `GET /pagos-luz` | listado con filtros y expansiones en `pagos-luz/` + specs | ✅ GREEN |

### TAR-4 — Evidencia RED

Spec: `apps/api/src/tarifas/tarifas-luz.spec.ts` (registrado en la cadena `test` de `apps/api/package.json`).
Comando: `npx ts-node --transpile-only src/tarifas/tarifas-luz.spec.ts`
Resultado: **6/6 fallan** con `TypeError: service.actualizarTarifaLuz is not a function`.

Cobertura del contrato en el RED:
1. Crea la fila operativa con franja por defecto 18:30–22:00 si no existe.
2. Actualiza costo + franja y versiona el costo en `estados_luz`.
3. No versiona cuando el costo no cambia.
4. Conserva la franja actual si el body la omite.
5. Rechaza franja incompleta (400).
6. Rechaza `franjaFin <= franjaInicio` (400).

Hallazgo técnico para GREEN: las columnas `@db.Time` llegan como `Date` ancladas al epoch
UTC (helper `time()` del seed), no como string. El mapper `aHora` actual usa
`String(valor).slice(0,5)` y no formatea `Date`; hay que corregirlo leyendo `getUTCHours()`
/`getUTCMinutes()` (mismo criterio que `config/hora.ts`).

### TAR-4 — Evidencia GREEN

- Spec: **6/6 pass** (`npx ts-node --transpile-only src/tarifas/tarifas-luz.spec.ts`).
- Suite completa: **24/24 spec files, # fail 0, EXIT=0**.
- Build: `tsc -p tsconfig.json` **EXIT=0**.
- Implementado: DTO con `costoXHora >= 0` (2 decimales) y franja `HH:MM` opcional;
  `actualizarTarifaLuz` con upsert transaccional, default 18:30–22:00 al crear,
  versionado en `estados_luz` solo si el costo cambia, validación de franja
  incompleta/orden; `PUT /tarifas/luz` admin; `aHora` ahora formatea `Date` y string.

### TAR-5 — Evidencia RED

Spec: `apps/api/src/pagos-luz/pagos-luz.service.spec.ts`, registrado en la cadena
`test` de `apps/api/package.json`.
Comando: `npx ts-node --transpile-only src/pagos-luz/pagos-luz.service.spec.ts`
Resultado: **`Cannot find module './pagos-luz.service'`** (el módulo aún no existe).

Cobertura del contrato §5.9 en el RED:
1. Registra el pago de luz de un turno que la requiere (response 201 con
   `{ id, turnoId, montoTotalLuz, fechaPago, createdAt }`).
2. Usa `now()` cuando `fechaPago` se omite.
3. 404 si el turno no existe.
4. 422 si el turno no requiere luz.
5. 422 si el turno está cancelado.
6. 409 si ya existe un pago de luz para el turno.
7. 400 si `montoTotalLuz <= 0`.
8. 400 si `fechaPago` es futura.

### TAR-5 — Evidencia GREEN

- Spec: **8/8 pass** (`npx ts-node --transpile-only src/pagos-luz/pagos-luz.service.spec.ts`).
- Suite completa: **25/25 spec files, # fail 0, EXIT=0**.
- Build: `tsc -p tsconfig.json` **EXIT=0**.
- Implementado: `CrearPagoLuzDto` (turnoId UUID, montoTotalLuz > 0, fechaPago ISO opcional),
  `PagosLuzService.registrarPago` (validaciones 400/404/422/409 y alta dentro de
  `$transaction`), `PagoLuzController` (`POST /pagos-luz`, admin, Swagger),
  `PagoLuzModule` registrado en `app.module.ts`, y `pago-luz-response.ts` con timestamps
  deterministas `-03:00`.
- Infra del spec: se agregó `$transaction` al stub (sin cambiar aserciones) para reflejar
  el chequeo + alta transaccional acordado.
- Limitación conocida: `pagos_luz` no tiene unique sobre `turno_id`; la transacción reduce
  la ventana de carrera pero no la cierra ante dos POST concurrentes. Si se agrega el
  índice, el `catch` ya traduce `P2002/23505` a 409.

### TAR-6 — Evidencia RED

Spec: `apps/api/src/pagos-luz/pagos-luz-listado.spec.ts`, registrado en la cadena
`test` de `apps/api/package.json`.
Comando: `npx ts-node --transpile-only src/pagos-luz/pagos-luz-listado.spec.ts`
Resultado: **7/7 fallan** con `TypeError: service.listar is not a function`.

Cobertura del contrato §5.9 en el RED:
1. Listado con expansiones `turno: { id, fecha, horaInicio, canchaId }` y
   `usuario: { id, nombre, apellido, numeroSocio }`; orden `fecha_pago desc`.
2. Filtro `turnoId` → `where.turno_id`.
3. Filtro `usuarioId` → `where.turnos.usuario_id`.
4. Filtro `desde`/`hasta` → `where.fecha_pago.gte/lte` con `Date`.
5. 400 si `desde` no es una fecha válida.
6. `numeroSocio: null` cuando el usuario no es socio.
7. Array vacío cuando no hay pagos.

### TAR-6 — Evidencia GREEN

- Spec: **7/7 pass** (`npx ts-node --transpile-only src/pagos-luz/pagos-luz-listado.spec.ts`).
- Suite completa: **26/26 spec files, # fail 0, EXIT=0**.
- Build: `tsc -p tsconfig.json` **EXIT=0**.
- Implementado: `ConsultarPagosLuzDto` (turnoId/usuarioId UUID, desde/hasta ISO),
  `PagosLuzService.listar` (where por turno_id / turnos.usuario_id / fecha_pago gte-lte,
  include turnos.usuarios.socios, orden `fecha_pago desc`, 400 en fechas inválidas),
  `GET /pagos-luz` admin en el controller, y `toPagoLuzListItemResponse` con expansiones
  `turno { id, fecha, horaInicio, canchaId }` y `usuario { id, nombre, apellido, numeroSocio }`.
- Fechas/horas: `turnos.fecha` se serializa `YYYY-MM-DD`; `hora_inicio` (`@db.Time`) se lee
  con campos UTC (`getUTCHours/getUTCMinutes`), igual que `pago-turno-response.ts`.

### ACT-43 — Estado final

TAR-4, TAR-5 y TAR-6 cerradas en GREEN. La suite de la API queda en 26 archivos y el build
en verde. Pendiente: push de la rama y revisión según la política del equipo.