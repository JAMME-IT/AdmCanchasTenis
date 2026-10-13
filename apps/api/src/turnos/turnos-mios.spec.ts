import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConsultarHistorialDto } from './dto/consultar-historial.dto';
import { ConsultarMisTurnosDto } from './dto/consultar-mis-turnos.dto';
import {
  toMiTurnoResponse,
  toTurnoConCanchaResponse,
  type TurnoConCanchaFila,
} from './mis-turno-response';
import { TurnosController } from './turnos.controller';
import { instanteDeInicioEnArgentina } from './fecha-turno';
import { TurnosService } from './turnos.service';

/** `turnos` row (TurnoFila shape) with the `canchas` relation expanded. */
const FILA: TurnoConCanchaFila = {
  id: 'turno-1',
  usuario_id: 'user-1',
  cancha_id: 'c1',
  tipo_turno_id: 't60',
  valor_turno_id: 'v1',
  fecha: new Date('2026-09-30T12:00:00.000Z'),
  hora_inicio: new Date('1970-01-01T19:00:00.000Z'),
  hora_fin: new Date('1970-01-01T20:00:00.000Z'),
  cantidad_personas: 4,
  cantidad_no_socios: 0,
  costo_turno_ns: 0,
  requiere_luz: false,
  estado_actual: 'confirmado',
  estado_pago: 'impago',
  created_at: new Date('2026-09-25T14:30:00.000Z'),
  updated_at: new Date('2026-09-25T14:30:00.000Z'),
  canchas: { id: 'c1', nro_cancha: 1 },
};

/** Fixture on a fixed date/time (strings are accepted by the RN-1 helper). */
const filaEn = (fecha: string, horaInicio: string): TurnoConCanchaFila => ({
  ...FILA,
  fecha,
  hora_inicio: horaInicio,
});

const authDe = (usuario: { id: string } | null = { id: 'user-1' }) => ({
  clerkUserId: 'clerk-1',
  sessionId: null,
  usuario,
  rol: usuario ? 'socio' : null,
});

/** Minimal Prisma stub: `turnos.findMany` records its args and returns `filas`. */
function misTurnosStub(filas: unknown[] = []) {
  const llamadas: Record<string, unknown>[] = [];
  return {
    turnos: {
      findMany: async (args: Record<string, unknown>) => {
        llamadas.push(args);
        return filas;
      },
    },
    llamadas,
  };
}

describe('toMiTurnoResponse / puedeCancelar (ACT-38, RN-1)', () => {
  // 2026-10-10 19:00 ART = 2026-10-10T22:00:00Z (compuesto por el helper).
  it('is true two hours before the start', () => {
    const respuesta = toMiTurnoResponse(
      filaEn('2026-10-10', '19:00'),
      new Date('2026-10-10T20:00:00.000Z'),
    );
    assert.equal(respuesta.puedeCancelar, true);
  });

  it('is false thirty minutes before the start', () => {
    const respuesta = toMiTurnoResponse(
      filaEn('2026-10-10', '19:00'),
      new Date('2026-10-10T21:30:00.000Z'),
    );
    assert.equal(respuesta.puedeCancelar, false);
  });

  it('keeps the RN-1 border inclusive: exactly 1 h before is still cancelable', () => {
    const borde = toMiTurnoResponse(
      filaEn('2026-10-10', '19:00'),
      new Date('2026-10-10T21:00:00.000Z'),
    );
    assert.equal(borde.puedeCancelar, true);

    const pasada = toMiTurnoResponse(
      filaEn('2026-10-10', '19:00'),
      new Date('2026-10-10T21:00:01.000Z'),
    );
    assert.equal(pasada.puedeCancelar, false);
  });

  it('composes the start in ART (UTC-3) across the midnight boundary', () => {
    assert.equal(
      instanteDeInicioEnArgentina('2026-10-10', '00:00'),
      Date.parse('2026-10-10T03:00:00.000Z'),
    );
    assert.equal(
      instanteDeInicioEnArgentina('2026-10-10', '23:00'),
      Date.parse('2026-10-11T02:00:00.000Z'),
    );

    const medianoche = toMiTurnoResponse(
      filaEn('2026-10-10', '00:00'),
      new Date('2026-10-10T02:00:00.000Z'),
    );
    assert.equal(medianoche.puedeCancelar, true);

    const cruzando = toMiTurnoResponse(
      filaEn('2026-10-10', '23:00'),
      new Date('2026-10-11T01:00:00.000Z'),
    );
    assert.equal(cruzando.puedeCancelar, true);
  });
});

describe('toTurnoConCanchaResponse (ACT-38)', () => {
  it('expands cancha as { id, nroCancha } and keeps the base Turno shape', () => {
    const respuesta = toTurnoConCanchaResponse(FILA);
    assert.equal(respuesta.id, 'turno-1');
    assert.equal(respuesta.fecha, '2026-09-30');
    assert.equal(respuesta.horaInicio, '19:00');
    assert.deepEqual(respuesta.cancha, { id: 'c1', nroCancha: 1 });
    assert.ok(!('puedeCancelar' in respuesta), 'el historial no expone puedeCancelar');
  });
});

describe('TurnosService.obtenerMios (ACT-38)', () => {
  it('defaults to confirmado|iniciado, orders asc and expands cancha', async () => {
    const stub = misTurnosStub([FILA]);
    const service = new TurnosService(stub as never);
    const respuesta = await service.obtenerMios(authDe() as never, {});

    assert.deepEqual(stub.llamadas[0].where, {
      usuario_id: 'user-1',
      estado_actual: { in: ['confirmado', 'iniciado'] },
    });
    assert.deepEqual(stub.llamadas[0].orderBy, [{ fecha: 'asc' }, { hora_inicio: 'asc' }]);
    assert.deepEqual(stub.llamadas[0].include, {
      canchas: { select: { id: true, nro_cancha: true } },
    });

    assert.equal(respuesta.length, 1);
    assert.equal(respuesta[0].id, 'turno-1');
    assert.deepEqual(respuesta[0].cancha, { id: 'c1', nroCancha: 1 });
    assert.equal(typeof respuesta[0].puedeCancelar, 'boolean');
  });

  it('filters by an exact fecha (fechaParaPrisma: noon UTC)', async () => {
    const stub = misTurnosStub([]);
    const service = new TurnosService(stub as never);
    await service.obtenerMios(authDe() as never, { fecha: '2026-09-30' });

    assert.deepEqual(stub.llamadas[0].where, {
      usuario_id: 'user-1',
      estado_actual: { in: ['confirmado', 'iniciado'] },
      fecha: new Date('2026-09-30T12:00:00.000Z'),
    });
  });

  it('narrows to a single estadoActual when provided', async () => {
    const stub = misTurnosStub([]);
    const service = new TurnosService(stub as never);
    await service.obtenerMios(authDe() as never, { estadoActual: 'iniciado' });

    assert.deepEqual((stub.llamadas[0].where as { estado_actual: unknown }).estado_actual, {
      in: ['iniciado'],
    });
  });

  it('computes puedeCancelar against the real clock (frozen 2 h before start)', async () => {
    const RealDate = Date;
    const fijo = new RealDate('2026-10-10T20:00:00.000Z').getTime();
    class FechaFija extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fijo);
        } else {
          super(...(args as []));
        }
      }
      static now(): number {
        return fijo;
      }
    }
    (globalThis as Record<string, unknown>).Date = FechaFija;
    try {
      const service = new TurnosService(misTurnosStub([filaEn('2026-10-10', '19:00')]) as never);
      const respuesta = await service.obtenerMios(authDe() as never, {});
      assert.equal(respuesta[0].puedeCancelar, true);
    } finally {
      (globalThis as Record<string, unknown>).Date = RealDate;
    }
  });

  it('rejects an impossible fecha with 400', async () => {
    const service = new TurnosService(misTurnosStub() as never);
    await assert.rejects(
      service.obtenerMios(authDe() as never, { fecha: '2026-02-30' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('requires a registered usuario with 403', async () => {
    const service = new TurnosService(misTurnosStub() as never);
    await assert.rejects(
      service.obtenerMios(authDe(null) as never, {}),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });
});

describe('TurnosService.obtenerHistorial (ACT-38)', () => {
  it('defaults to finalizado and orders desc', async () => {
    const stub = misTurnosStub([FILA]);
    const service = new TurnosService(stub as never);
    const respuesta = await service.obtenerHistorial(authDe() as never, {});

    assert.deepEqual(stub.llamadas[0].where, {
      usuario_id: 'user-1',
      estado_actual: { in: ['finalizado'] },
    });
    assert.deepEqual(stub.llamadas[0].orderBy, [{ fecha: 'desc' }, { hora_inicio: 'desc' }]);
    assert.deepEqual(stub.llamadas[0].include, {
      canchas: { select: { id: true, nro_cancha: true } },
    });
    assert.deepEqual(respuesta[0].cancha, { id: 'c1', nroCancha: 1 });
    assert.ok(!('puedeCancelar' in respuesta[0]), 'el historial no expone puedeCancelar');
  });

  it('allows no_asistio and cancelado as estadoActual', async () => {
    for (const estadoActual of ['no_asistio', 'cancelado'] as const) {
      const stub = misTurnosStub();
      const service = new TurnosService(stub as never);
      await service.obtenerHistorial(authDe() as never, { estadoActual });
      assert.deepEqual((stub.llamadas[0].where as { estado_actual: unknown }).estado_actual, {
        in: [estadoActual],
      });
    }
  });

  it('applies an inclusive desde/hasta range over fecha', async () => {
    const stub = misTurnosStub([]);
    const service = new TurnosService(stub as never);
    await service.obtenerHistorial(authDe() as never, { desde: '2026-09-01', hasta: '2026-09-30' });

    assert.deepEqual(stub.llamadas[0].where, {
      usuario_id: 'user-1',
      estado_actual: { in: ['finalizado'] },
      fecha: {
        gte: new Date('2026-09-01T12:00:00.000Z'),
        lte: new Date('2026-09-30T12:00:00.000Z'),
      },
    });
  });

  it('rejects invalid dates and desde > hasta with 400', async () => {
    const service = new TurnosService(misTurnosStub() as never);
    await assert.rejects(
      service.obtenerHistorial(authDe() as never, { desde: '2026-13-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerHistorial(authDe() as never, { hasta: '2026-02-30' }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerHistorial(authDe() as never, { desde: '2026-10-01', hasta: '2026-09-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('requires a registered usuario with 403', async () => {
    const service = new TurnosService(misTurnosStub() as never);
    await assert.rejects(
      service.obtenerHistorial(authDe(null) as never, {}),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });
});

describe('ConsultarMisTurnosDto / ConsultarHistorialDto (ACT-38)', () => {
  it('accepts empty queries and valid filters', async () => {
    assert.equal((await validate(new ConsultarMisTurnosDto())).length, 0);
    assert.equal(
      (await validate(Object.assign(new ConsultarMisTurnosDto(), { fecha: '2026-09-30', estadoActual: 'iniciado' }))).length,
      0,
    );
    assert.equal((await validate(new ConsultarHistorialDto())).length, 0);
    assert.equal(
      (await validate(Object.assign(new ConsultarHistorialDto(), { estadoActual: 'cancelado' }))).length,
      0,
    );
  });

  it('rejects out-of-domain estadoActual and bad fecha format', async () => {
    assert.ok(
      (await validate(Object.assign(new ConsultarMisTurnosDto(), { estadoActual: 'finalizado' }))).length > 0,
    );
    assert.ok((await validate(Object.assign(new ConsultarMisTurnosDto(), { fecha: '30-09-2026' }))).length > 0);
    assert.ok(
      (await validate(Object.assign(new ConsultarHistorialDto(), { estadoActual: 'confirmado' }))).length > 0,
    );
    assert.ok((await validate(Object.assign(new ConsultarHistorialDto(), { desde: '2026/09/01' }))).length > 0);
  });
});

describe('TurnosController mios/historial (ACT-38)', () => {
  it('delegates GET /turnos/mios with (auth, query)', async () => {
    const esperada = [{ id: 'turno-1', puedeCancelar: true }];
    let recibidos: unknown[];
    const controller = new TurnosController({
      obtenerMios: async (...args: unknown[]) => {
        recibidos = args;
        return esperada;
      },
    } as never);
    const auth = authDe();
    const query = new ConsultarMisTurnosDto();
    const respuesta = await controller.mios(auth as never, query);
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibidos!, [auth, query]);
  });

  it('delegates GET /turnos/mios/historial with (auth, query)', async () => {
    const esperada = [{ id: 'turno-1', cancha: { id: 'c1', nroCancha: 1 } }];
    let recibidos: unknown[];
    const controller = new TurnosController({
      obtenerHistorial: async (...args: unknown[]) => {
        recibidos = args;
        return esperada;
      },
    } as never);
    const auth = authDe();
    const query = new ConsultarHistorialDto();
    const respuesta = await controller.historial(auth as never, query);
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibidos!, [auth, query]);
  });
});
