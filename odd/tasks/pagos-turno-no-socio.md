# ACT-54: Pagos de turno de no socio

**Branch**: `feature/ACT-54-pagos-turno-no-socio`
**Status**: En curso
**Test runner**: `npx vitest run`

## Specs

**S1**: POST /pagos-turno registra un pago de turno. Solo admin. Valida turno existente y no cancelado (404/422), montoTotalTurno > 0, turno sin pago previo (409 si ya existe). Si vienen líneas, la suma debe igualar montoTotalTurno (400). Crea pagos_turno + lineas_pago_turno, actualiza turnos.estado_pago = pago e inserta transición en estados_turno, todo en una transacción. Response 201 con el pago creado.

**S2**: GET /pagos-turno lista pagos con filtros opcionales: turnoId (UUID), usuarioId (UUID), desde/hasta (timestamps o fechas ISO). Solo admin. Response: array con expansión turno { id, fecha, horaInicio, canchaId } y usuario { id, nombre, apellido, numeroSocio }.

**S3**: PATCH /turnos/:id/pago corrige manualmente estadoPago. Solo admin. Valida turno existente (404), estadoPago enum válido (impago|pago), y que sea distinto al actual (422 si igual). Actualiza turnos.estado_pago e inserta transición en estados_turno. Response 200 con el turno actualizado.

**S4**: Pruebas E2E para los tres endpoints con happy path y casos de error (400, 401, 403, 404, 409, 422).

## Tasks

- [x] T1 (S1, inline): Crear módulo pagos-turno con POST /pagos-turno — DTO, controller, service, tests unitarios
- [x] T2 (S2, inline): Agregar GET /pagos-turno al módulo pagos-turno — DTO query, service method, tests
- [x] T3 (S3, inline): Agregar PATCH /turnos/:id/pago al módulo turnos — DTO, controller method, service method, tests
- [x] T4 (S1+S2+S3, inline): Pruebas E2E de los tres endpoints

## Log

**L1**: "Pagos de turno de no socio (POST|GET /pagos-turno · PATCH /turnos/:id/pago)" — Jira ACT-54. Criterio: RF-19 y RF-42 (parte turnos); solo admin; un único pago de turno por turno (409 a nivel servicio, contrato §7.11).
