# act-38-mis-turnos-historial — GET /turnos/mios y GET /turnos/mios/historial

## Objective
Implementar los endpoints `GET /turnos/mios` (turnos vigentes propios, RF-36/CU24) y `GET /turnos/mios/historial` (historial descendente, RF-18/CU5) en `apps/api`, según API-CONTRATO §5.3, con expansión `cancha: { id, nroCancha }` y el flag `puedeCancelar` (RN-1) en los vigentes.

## Problem
El contrato §5.3 y la matriz §4 ya definen ambos endpoints (admin, socio y no_socio autenticados), pero no existen en la API: el usuario no puede listar sus turnos vigentes con la regla de cancelación ni recorrer su historial. Las tablas `turnos` y la relación `canchas` ya existen; no hace falta migración.

## Why
Cerrar RF-36 (CU24) y RF-18 (CU5) sin requerimientos nuevos, reutilizando la fórmula RN-1 ya usada por `cancelar` (ACT-35) y la convención de respuesta `Turno` de `POST /turnos`.

## Scope
- `apps/api/src/turnos/dto/consultar-mis-turnos.dto.ts` (nuevo): `fecha?` (YYYY-MM-DD), `estadoActual?` en `confirmado|iniciado`.
- `apps/api/src/turnos/dto/consultar-historial.dto.ts` (nuevo): `desde?`, `hasta?`, `estadoActual?` en `finalizado|no_asistio|cancelado`.
- `apps/api/src/turnos/mis-turno-response.ts` (nuevo): módulo puro con la expansión `cancha` y el cálculo de `puedeCancelar` (`toTurnoConCanchaResponse`, `toMiTurnoResponse`).
- `apps/api/src/turnos/turnos.service.ts`: `obtenerMios`, `obtenerHistorial`, helper `instanteDeInicioEnArgentina` y constante `UNA_HORA_MS`.
- `apps/api/src/turnos/turnos.controller.ts`: `@Get('mios')` y `@Get('mios/historial')`.
- `apps/api/src/turnos/turnos-mios.spec.ts` (nuevo): node:test + ts-node con stubs manuales de PrismaService.
- `apps/api/package.json`: registro del spec nuevo en la cadena `&&` del script `test`.
- No incluye: `docs/API-CONTRATO.md` (ya está al día), `POST /turnos/:id/cancelar` ni la tabla de transiciones de ACT-35/ACT-36 (no están en main y no se copian).

## Constraints
- Mensajes de API en español sin acentos; comentarios/JSDoc en inglés. `node:test` (no jest) + `ts-node --transpile-only`, stubs manuales de PrismaService.
- RN-1: `puedeCancelar = ahora + UNA_HORA_MS <= instanteDeInicioEnArgentina(fecha, horaInicio)` (borde **inclusivo**, `<=`), la misma fórmula que `cancelar` en ACT-35.
- El helper `instanteDeInicioEnArgentina` se replica desde ACT-35 (PR #5 sin mergear) **a propósito**, con el cuerpo byte-idéntico, para que al mergear el conflicto se resuelva "quedarse con una sola copia" y no quede duplicación en main.
- Desvío mínimo: `UNA_HORA_MS` se exporta (en ACT-35 era `const` privada) porque el mapper puro `mis-turno-response` lo consume; la resolución del merge debe conservar la copia **exportada**.
- La relación Prisma real del modelo `turnos` es `canchas` (plural); la respuesta del contrato la expone como `cancha: { id, nroCancha }`.
- Usuario sin fila en `usuarios` (Clerk autenticado sin perfil): `ForbiddenException('Se requiere un usuario registrado')`, por consistencia con `reservar`/`cancelar`; el contrato solo lista 400/401 y el guard de roles ya rechaza sin rol.
- Trabajar SOLO en los archivos del Scope; no tocar las ramas `feat/ACT-35-cancelar-turno` ni `feat/ACT-36-transiciones-estado`.

## Checklist
- [x] T1 DTOs `ConsultarMisTurnosDto` y `ConsultarHistorialDto` con dominios cerrados por `@IsIn`.
- [x] T2 Módulo puro `mis-turno-response.ts` (expansión `cancha` + `puedeCancelar` con `ahora` inyectable).
- [x] T3 Service `obtenerMios`/`obtenerHistorial` + helper/constante RN-1.
- [x] T4 Controller `@Get('mios')` y `@Get('mios/historial')` antes de cualquier futura ruta `:id`.
- [x] T5 Spec `turnos-mios.spec.ts` (mapper/RN-1, service, DTOs, controller).
- [x] T6 Registro del spec en el script `test` de `apps/api/package.json`.
- [x] T7 `npm --prefix apps/api test` en verde y `npm --prefix apps/api run build` exit 0.

## Authorized scope
- Archivos: los 7 puntos de Scope (4 nuevos, 3 editados) + este doc ODD.
- Rama: `feat/ACT-38-mis-turnos-historial` (creada desde `origin/main`).
- Prohibido: commits al finalizar (working tree con cambios), push, edición de otras features/módulos.

## Acceptance criteria
- `GET /turnos/mios` responde 200 con los turnos `confirmado|iniciado` del usuario autenticado (filtros `fecha`/`estadoActual` opcionales), orden asc por fecha/hora, `cancha` expandida y `puedeCancelar` calculado (RN-1).
- `GET /turnos/mios/historial` responde 200 con los turnos `finalizado` (default) o `no_asistio`/`cancelado`, orden desc, rango inclusivo `desde`/`hasta`, `cancha` expandida y sin `puedeCancelar`.
- Errores: 400 (fecha inválida, `desde > hasta`), 401, 403 (sin usuario registrado).
- Suite completa en verde y `npm run build` exit 0.

## Applicable checks
- `npm --prefix apps/api test` → todos los specs verdes.
- `npm --prefix apps/api run build` → exit 0.
- `git status --short` → solo los archivos del Scope + `.codegraph/` (untracked preexistente).
- Revisión manual del diff: sin cambios fuera de turnos/package.json/odd.

## Progress
- 2026-10-12: creado. Branch `feat/ACT-38-mis-turnos-historial` desde `origin/main` (a35ee15). T1-T7 completados por subagente (writer), sin commit ni push por mandato.
- 2026-10-12: verificación local: `npm --prefix apps/api test` → 98/98 (78 previos de main + 20 nuevos), fail 0, exit 0; `npm --prefix apps/api run build` → exit 0.
- 2026-10-12: corrección de import circular. Los helpers de tiempo ART (`ARGENTINA_UTC_OFFSET_MS`, `hoyEnArgentina`, `instanteDeInicioEnArgentina`, `UNA_HORA_MS`) se movieron byte-idénticos a un módulo puro nuevo `apps/api/src/turnos/fecha-turno.ts` (sin decorators NestJS). `turnos.service.ts` los importa internamente donde los usa (`hoyEnArgentina` en `diferenciaEnDias`) y los **re-exporta** (`export { ... } from './fecha-turno'`) para no romper a los importadores existentes (`turnos-reserva.spec.ts`, `turnos-mios.spec.ts`); la sentencia `export ... from` no crea binding local, así que no colisiona con el import. `mis-turno-response.ts` ahora importa `instanteDeInicioEnArgentina`/`UNA_HORA_MS` desde `./fecha-turno` y ya no depende de `./turnos.service`: **ciclo eliminado**. `turnos-mios.spec.ts` importa el helper desde `./fecha-turno` y `TurnosService` desde `./turnos.service`. Nota de merge: al mergear el PR #5 (ACT-35), las copias locales de los helpers ART en el service se reemplazan por el módulo compartido; la superficie pública ya está cubierta por el re-export, así que los importadores no cambian. Refactor de ubicación, sin cambio de comportamiento. Verificación: `npm --prefix apps/api test` → 98/98, fail 0, exit 0; `npm --prefix apps/api run build` → exit 0.

## Notes / discrepancies
- El handoff indicaba "93 existentes"; la rama se corta desde `origin/main`, que **no** incluye ACT-36 (15 tests), así que el baseline real es 78. Total tras ACT-38: 98.
- El handoff pedía un test "false exactamente a 1 h". La decisión vinculante (fórmula `now <= fecha+horaInicio - 1h`, idéntica a `cancelar` de ACT-35) hace el borde **inclusivo**: a exactamente 1 h `puedeCancelar = true`. Se testea el borde inclusivo (true) y el instante inmediatamente posterior (false), respetando la fórmula por sobre la viñeta.
