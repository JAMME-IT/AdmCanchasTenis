import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

/** Minimal Prisma stub: only the read methods the statistics queries use. */
function prismaStub(overrides: Record<string, Record<string, unknown>> = {}) {
  return {
    turnos: { findMany: async () => [], ...overrides.turnos },
    canchas: { findMany: async () => [], ...overrides.canchas },
    usuarios: { findMany: async () => [], ...overrides.usuarios },
    pagos_turno: { findMany: async () => [], ...overrides.pagos_turno },
    pagos_luz: { findMany: async () => [], ...overrides.pagos_luz },
    lineas_cuota: { findMany: async () => [], ...overrides.lineas_cuota },
    cuotas: { findMany: async () => [], ...overrides.cuotas },
    dias_funcionamiento: { findMany: async () => [], ...overrides.dias_funcionamiento },
    rangos_horario: { findMany: async () => [], ...overrides.rangos_horario },
  };
}

/** `HH:MM` → Date for a Prisma `@db.Time` column (midnight-based, UTC). */
const HORA = (hora: string) => new Date(`1970-01-01T${hora}:00Z`);

const CANCHAS = [
  { id: 'c1', nro_cancha: 1 },
  { id: 'c2', nro_cancha: 2 },
];

const SIN_USUARIOS = { usuarios: { findMany: async () => [] } };

describe('ReportesService.obtenerEstadisticas (ACT-45)', () => {
  it('returns zeros with the exact §5.10 shape on an empty period', async () => {
    const service = new ReportesService(prismaStub(SIN_USUARIOS) as never);
    const respuesta = await service.obtenerEstadisticas({ desde: '2026-09-01', hasta: '2026-09-30' });
    assert.deepEqual(respuesta, {
      periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      turnos: {
        total: 0,
        porEstado: { confirmado: 0, iniciado: 0, finalizado: 0, cancelado: 0, no_asistio: 0 },
        porCancha: [],
        porFranja: [],
      },
      usuarios: { sociosActivos: 0, noSocios: 0, morosos: 0 },
    });
  });

  it('aggregates porEstado, porCancha (with nroCancha join) and porFranja', async () => {
    const service = new ReportesService(
      prismaStub({
        ...SIN_USUARIOS,
        canchas: { findMany: async () => CANCHAS },
        turnos: {
          findMany: async () => [
            { estado_actual: 'finalizado', cancha_id: 'c2', hora_inicio: HORA('19:00') },
            { estado_actual: 'finalizado', cancha_id: 'c1', hora_inicio: HORA('19:00') },
            { estado_actual: 'cancelado', cancha_id: 'c1', hora_inicio: HORA('08:00') },
            { estado_actual: 'no_asistio', cancha_id: 'c1', hora_inicio: HORA('08:00') },
          ],
        },
      }) as never,
    );
    const respuesta = await service.obtenerEstadisticas({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    assert.equal(respuesta.turnos.total, 4);
    assert.deepEqual(respuesta.turnos.porEstado, {
      confirmado: 0,
      iniciado: 0,
      finalizado: 2,
      cancelado: 1,
      no_asistio: 1,
    });
    assert.deepEqual(respuesta.turnos.porCancha, [
      { canchaId: 'c1', nroCancha: 1, cantidad: 3 },
      { canchaId: 'c2', nroCancha: 2, cantidad: 1 },
    ]);
    assert.deepEqual(respuesta.turnos.porFranja, [
      { horaInicio: '08:00', cantidad: 2 },
      { horaInicio: '19:00', cantidad: 2 },
    ]);
  });

  it('defaults a missing bound to the current month in America/Argentina/Buenos_Aires', async () => {
    let whereRecibido: { fecha?: { gte?: Date; lte?: Date } } = {};
    const service = new ReportesService(
      prismaStub({
        ...SIN_USUARIOS,
        canchas: { findMany: async () => [] },
        turnos: {
          findMany: async (args?: { where?: { fecha?: { gte?: Date; lte?: Date } } }) => {
            whereRecibido = args?.where ?? {};
            return [];
          },
        },
      }) as never,
    );
    // 2026-09-15 12:00 UTC is still 2026-09-15 09:00 in Buenos Aires (UTC-3).
    const respuesta = await service.obtenerEstadisticas({}, new Date('2026-09-15T12:00:00Z'));
    assert.deepEqual(respuesta.periodo, { desde: '2026-09-01', hasta: '2026-09-30' });
    assert.equal(whereRecibido.fecha?.gte?.toISOString(), '2026-09-01T12:00:00.000Z');
    assert.equal(whereRecibido.fecha?.lte?.toISOString(), '2026-09-30T12:00:00.000Z');
  });

  it('rejects invalid dates and desde>hasta with 400', async () => {
    const service = new ReportesService(prismaStub(SIN_USUARIOS) as never);
    await assert.rejects(
      service.obtenerEstadisticas({ desde: '2026-02-30', hasta: '2026-03-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerEstadisticas({ desde: '09/01/2026', hasta: '2026-09-30' }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerEstadisticas({ desde: '2026-09-30', hasta: '2026-09-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('counts usuarios by current role + estado, with role winning over the socios row', async () => {
    const service = new ReportesService(
      prismaStub({
        canchas: { findMany: async () => [] },
        usuarios: {
          findMany: async () => [
            // Socio role + active state → socio, whether or not a socios row exists.
            { id: 'u1', estado_actual: 'activo', usuarios_roles: { roles: { nombre: 'socio' } } },
            { id: 'u2', estado_actual: 'activo', usuarios_roles: { roles: { nombre: 'socio' } } },
            // Socio role but moroso state → moroso (state wins within the role rule).
            { id: 'u3', estado_actual: 'moroso', usuarios_roles: { roles: { nombre: 'socio' } } },
            // Moroso without any current role → still moroso (any role).
            { id: 'u4', estado_actual: 'moroso', usuarios_roles: null },
            // Former socio (socios row may remain) whose current role is no_socio → noSocios.
            { id: 'u5', estado_actual: 'activo', usuarios_roles: { roles: { nombre: 'no_socio' } } },
            // Admin and role-less active users → noSocios (remainder without socio role).
            { id: 'u6', estado_actual: 'activo', usuarios_roles: { roles: { nombre: 'admin' } } },
            { id: 'u7', estado_actual: 'suspendido', usuarios_roles: { roles: { nombre: 'socio' } } },
          ],
        },
      }) as never,
    );
    const respuesta = await service.obtenerEstadisticas({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    assert.deepEqual(respuesta.usuarios, { sociosActivos: 2, noSocios: 3, morosos: 2 });
  });
});

describe('ReportesController.estadisticas (ACT-45)', () => {

  it('delegates to the service and returns its response untouched', async () => {
    const esperada = {
      periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      turnos: {
        total: 0,
        porEstado: { confirmado: 0, iniciado: 0, finalizado: 0, cancelado: 0, no_asistio: 0 },
        porCancha: [],
        porFranja: [],
      },
      usuarios: { sociosActivos: 0, noSocios: 0, morosos: 0 },
    };
    let recibida: unknown;
    const controller = new ReportesController({
      obtenerEstadisticas: async (query: unknown) => {
        recibida = query;
        return esperada;
      },
    } as never);
    const respuesta = await controller.estadisticas({ desde: '2026-09-01', hasta: '2026-09-30' });
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibida, { desde: '2026-09-01', hasta: '2026-09-30' });
  });
});

/** Prisma `Decimal` stand-in: exposes `toNumber()` like the real driver value. */
const DECIMAL = (valor: number) => ({ toNumber: () => valor });

const DIA = (fecha: string) => new Date(`${fecha}T12:00:00Z`);

const DIAS_TODOS_HABILITADOS = [1, 2, 3, 4, 5, 6, 7].map((diaSemana) => ({
  dia_semana: diaSemana,
  habilitado: true,
}));

describe('ReportesService.obtenerFinanciero (ACT-46)', () => {
  it('returns zeros with the exact §5.10 shape on an empty period', async () => {
    const service = new ReportesService(prismaStub() as never);
    const respuesta = await service.obtenerFinanciero({ desde: '2026-09-01', hasta: '2026-09-30' });
    assert.deepEqual(respuesta, {
      periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      ingresos: { pagosTurno: 0, pagosLuz: 0, cuotasCobradas: 0, total: 0 },
      cuotas: { emitidas: 0, montoEmitido: 0, pagadas: 0, parciales: 0, adeudadas: 0 },
      usoCanchas: { turnosTotal: 0, horasOcupadas: 0, ocupacionPromedio: 0 },
    });
  });

  it('sums ingresos lines (F1-F2) excluding anulada lineas and unpaid lines', async () => {
    const service = new ReportesService(
      prismaStub({
        pagos_turno: {
          findMany: async () => [
            { monto_total_turno: 100000 },
            { monto_total_turno: DECIMAL(20000) },
          ],
        },
        pagos_luz: {
          findMany: async () => [
            { monto_total_luz: 45000 },
            { monto_total_luz: 3000.1 },
            { monto_total_luz: 3000.2 },
          ],
        },
        lineas_cuota: {
          findMany: async () => [
            { monto: 200000, estado: 'registrada', fecha_pago: DIA('2026-09-05') },
            { monto: 100000, estado: 'registrada', fecha_pago: DIA('2026-09-20') },
            // Anulada lineas never count as collected (F2).
            { monto: 50000, estado: 'anulada', fecha_pago: DIA('2026-09-21') },
            // Lines without payment date are not inside the range (F2).
            { monto: 99999, estado: 'registrada', fecha_pago: null },
          ],
        },
      }) as never,
    );
    const respuesta = await service.obtenerFinanciero({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    // 3000.1 + 3000.2 also proves F7 float-dust rounding at the boundary.
    assert.deepEqual(respuesta.ingresos, {
      pagosTurno: 120000,
      pagosLuz: 51000.3,
      cuotasCobradas: 300000,
      total: 471000.3,
    });
  });

  it('buckets cuotas by estado_actual among emitidas (F3-F4)', async () => {
    const service = new ReportesService(
      prismaStub({
        cuotas: {
          findMany: async () => [
            { monto_total: 100000, estado_actual: 'pagada' },
            { monto_total: DECIMAL(100000), estado_actual: 'pagada' },
            { monto_total: 100000, estado_actual: 'parcial' },
            { monto_total: 100000, estado_actual: 'adeudada' },
            // pendiente/cancelada count in emitidas only (F4).
            { monto_total: 100000, estado_actual: 'pendiente' },
            { monto_total: 100000, estado_actual: 'cancelada' },
          ],
        },
      }) as never,
    );
    const respuesta = await service.obtenerFinanciero({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    assert.deepEqual(respuesta.cuotas, {
      emitidas: 6,
      montoEmitido: 600000,
      pagadas: 2,
      parciales: 1,
      adeudadas: 1,
    });
  });

  it('counts usoCanchas excluding cancelado turnos (F5)', async () => {
    const service = new ReportesService(
      prismaStub({
        turnos: {
          findMany: async () => [
            { estado_actual: 'finalizado', hora_inicio: HORA('08:00'), hora_fin: HORA('09:30') },
            { estado_actual: 'confirmado', hora_inicio: HORA('10:00'), hora_fin: HORA('11:00') },
            // Cancelled bookings occupy no court time (F5).
            { estado_actual: 'cancelado', hora_inicio: HORA('12:00'), hora_fin: HORA('14:00') },
          ],
        },
      }) as never,
    );
    const respuesta = await service.obtenerFinanciero({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    assert.deepEqual(respuesta.usoCanchas, {
      turnosTotal: 2,
      horasOcupadas: 2.5,
      // No canchas configured → zero capacity → 0, never NaN (F6 guard).
      ocupacionPromedio: 0,
    });
  });

  it('computes ocupacionPromedio from dias + rangos config (F6)', async () => {
    const service = new ReportesService(
      prismaStub({
        turnos: {
          findMany: async () => [
            { estado_actual: 'finalizado', hora_inicio: HORA('08:00'), hora_fin: HORA('10:00') },
          ],
        },
        canchas: {
          findMany: async () => [
            { estado_actual: 'disponible' },
            { estado_actual: 'disponible' },
            { estado_actual: 'en_mantenimiento' },
          ],
        },
        dias_funcionamiento: {
          // Only Tuesday enabled: 2026-09-01 is Tuesday, 2026-09-02 is not.
          findMany: async () => [
            { dia_semana: 2, habilitado: true },
            { dia_semana: 3, habilitado: false },
          ],
        },
        rangos_horario: {
          findMany: async () => [{ hora_inicio: HORA('08:00'), hora_fin: HORA('12:00') }],
        },
      }) as never,
    );
    const respuesta = await service.obtenerFinanciero({
      desde: '2026-09-01',
      hasta: '2026-09-02',
    });
    // Capacity = 2 courts × 1 enabled day × 4 h/day = 8 h; 2 / 8 = 0.25.
    assert.equal(respuesta.usoCanchas.horasOcupadas, 2);
    assert.equal(respuesta.usoCanchas.ocupacionPromedio, 0.25);
  });

  it('falls back to 14h/day when no rangos rows exist (F6)', async () => {
    const service = new ReportesService(
      prismaStub({
        turnos: {
          findMany: async () => [
            { estado_actual: 'finalizado', hora_inicio: HORA('08:00'), hora_fin: HORA('15:00') },
          ],
        },
        canchas: { findMany: async () => [{ estado_actual: 'disponible' }] },
        dias_funcionamiento: { findMany: async () => DIAS_TODOS_HABILITADOS },
        rangos_horario: { findMany: async () => [] },
      }) as never,
    );
    const respuesta = await service.obtenerFinanciero({
      desde: '2026-09-01',
      hasta: '2026-09-01',
    });
    // Capacity = 1 court × 1 day × 14 h fallback = 14 h; 7 / 14 = 0.5.
    assert.equal(respuesta.usoCanchas.horasOcupadas, 7);
    assert.equal(respuesta.usoCanchas.ocupacionPromedio, 0.5);
  });

  it('rejects invalid dates and desde>hasta with 400 (periodo reuse)', async () => {
    const service = new ReportesService(prismaStub() as never);
    await assert.rejects(
      service.obtenerFinanciero({ desde: '2026-02-30', hasta: '2026-03-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerFinanciero({ desde: '2026-09-30', hasta: '2026-09-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('filters timestamptz fecha_pago with ART day boundaries (F1-F2 hasta edge)', async () => {
    const recibidos: { fecha_pago?: { gte?: Date; lt?: Date } }[] = [];
    const capturar = async (args?: { where?: { fecha_pago?: { gte?: Date; lt?: Date } } }) => {
      recibidos.push(args?.where ?? {});
      return [];
    };
    const service = new ReportesService(
      prismaStub({
        pagos_turno: { findMany: capturar },
        pagos_luz: { findMany: capturar },
        lineas_cuota: { findMany: capturar },
      }) as never,
    );
    await service.obtenerFinanciero({ desde: '2026-09-01', hasta: '2026-09-30' });
    assert.equal(recibidos.length, 3);
    for (const where of recibidos) {
      // desde 00:00 ART = 03:00 UTC same day; hasta+1 00:00 ART exclusive.
      assert.equal(where.fecha_pago?.gte?.toISOString(), '2026-09-01T03:00:00.000Z');
      assert.equal(where.fecha_pago?.lt?.toISOString(), '2026-10-01T03:00:00.000Z');
    }
    const { gte, lt } = recibidos[0].fecha_pago as { gte: Date; lt: Date };
    const dentro = (fecha: Date) => fecha >= gte && fecha < lt;
    // 23:30 ART on the hasta day is inside the range.
    assert.equal(dentro(new Date('2026-10-01T02:30:00.000Z')), true);
    // 00:30 ART on the hasta+1 day is outside the range.
    assert.equal(dentro(new Date('2026-10-01T03:30:00.000Z')), false);
  });

  it('filters timestamptz fecha_pago with ART day boundaries (F1-F2 desde edge)', async () => {
    let whereRecibido: { fecha_pago?: { gte?: Date; lt?: Date } } = {};
    const service = new ReportesService(
      prismaStub({
        pagos_turno: {
          findMany: async (args?: { where?: { fecha_pago?: { gte?: Date; lt?: Date } } }) => {
            whereRecibido = args?.where ?? {};
            return [];
          },
        },
      }) as never,
    );
    await service.obtenerFinanciero({ desde: '2026-09-01', hasta: '2026-09-30' });
    assert.equal(whereRecibido.fecha_pago?.gte?.toISOString(), '2026-09-01T03:00:00.000Z');
    const { gte, lt } = whereRecibido.fecha_pago as unknown as { gte: Date; lt: Date };
    const dentro = (fecha: Date) => fecha >= gte && fecha < lt;
    // 23:30 ART on the day before desde is outside the range.
    assert.equal(dentro(new Date('2026-09-01T02:30:00.000Z')), false);
    // 00:30 ART on the desde day is inside the range.
    assert.equal(dentro(new Date('2026-09-01T03:30:00.000Z')), true);
    assert.equal(lt.toISOString(), '2026-10-01T03:00:00.000Z');
  });
});

describe('ReportesController.financiero (ACT-46)', () => {
  it('delegates to the service and returns its response untouched', async () => {
    const esperada = {
      periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      ingresos: { pagosTurno: 0, pagosLuz: 0, cuotasCobradas: 0, total: 0 },
      cuotas: { emitidas: 0, montoEmitido: 0, pagadas: 0, parciales: 0, adeudadas: 0 },
      usoCanchas: { turnosTotal: 0, horasOcupadas: 0, ocupacionPromedio: 0 },
    };
    let recibida: unknown;
    const controller = new ReportesController({
      obtenerFinanciero: async (query: unknown) => {
        recibida = query;
        return esperada;
      },
    } as never);
    const respuesta = await controller.financiero({ desde: '2026-09-01', hasta: '2026-09-30' });
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibida, { desde: '2026-09-01', hasta: '2026-09-30' });
  });
});
