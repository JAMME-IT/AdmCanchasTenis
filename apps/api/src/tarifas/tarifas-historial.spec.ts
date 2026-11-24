import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { TarifasService } from './tarifas.service';

/**
 * ACT-44 — GET /tarifas/historial (RF-30/RF-31).
 * Contract (docs/API-CONTRATO.md §5.8):
 *  - Unified history of the versioned tariffs: turno, cuota and luz.
 *  - `tipo` (turno|luz|cuota) narrows the source; default all three.
 *  - `desde`/`hasta` bound the change date; `montoMin`/`montoMax` bound the amount.
 *  - Each item: { tipo, monto, fechaCambio }, newest first, with the club offset.
 *  - For luz the amount is `costo_x_hora` and the date is `estados_luz.fecha`.
 */

const FECHA_TURNO = new Date('2026-09-01T00:00:00-03:00');
const FECHA_LUZ = new Date('2026-09-10T00:00:00-03:00');
const FECHA_CUOTA = new Date('2026-09-15T00:00:00-03:00');

function filaTurno() {
  return { id: 'turno-1', costo_x_hora: 4500, fecha_cambio: FECHA_TURNO };
}
function filaCuota() {
  return { id: 'cuota-1', precio: 16000, fecha_cambio: FECHA_CUOTA };
}
function filaLuz() {
  return { id: 'luz-hist-1', luz_id: 'luz-1', costo_x_hora: 4000, fecha: FECHA_LUZ };
}

/** Minimal Prisma stub: only the three history sources the service reads. */
function prismaStub(
  opciones: {
    turno?: unknown[];
    cuota?: unknown[];
    luz?: unknown[];
  } = {},
) {
  const llamadas = {
    turno: [] as Array<{ where?: unknown; orderBy?: unknown }>,
    cuota: [] as Array<{ where?: unknown; orderBy?: unknown }>,
    luz: [] as Array<{ where?: unknown; orderBy?: unknown }>,
  };

  const stub: any = {
    valores_turno: {
      findMany: async (args: { where?: unknown; orderBy?: unknown }) => {
        llamadas.turno.push(args);
        return opciones.turno ?? [];
      },
    },
    valores_cuota: {
      findMany: async (args: { where?: unknown; orderBy?: unknown }) => {
        llamadas.cuota.push(args);
        return opciones.cuota ?? [];
      },
    },
    estados_luz: {
      findMany: async (args: { where?: unknown; orderBy?: unknown }) => {
        llamadas.luz.push(args);
        return opciones.luz ?? [];
      },
    },
  };

  return { stub, llamadas };
}

describe('TarifasService.obtenerHistorial (ACT-44, RF-30/RF-31)', () => {
  it('sin filtros consulta las tres fuentes y ordena por fecha descendente', async () => {
    const { stub, llamadas } = prismaStub({
      turno: [filaTurno()],
      cuota: [filaCuota()],
      luz: [filaLuz()],
    });
    const service = new TarifasService(stub as never);

    const resultado = await service.obtenerHistorial({});

    assert.equal(llamadas.turno.length, 1);
    assert.equal(llamadas.cuota.length, 1);
    assert.equal(llamadas.luz.length, 1);
    assert.deepEqual(llamadas.turno[0].where, {});
    assert.deepEqual(llamadas.turno[0].orderBy, { fecha_cambio: 'desc' });
    assert.deepEqual(llamadas.luz[0].orderBy, { fecha: 'desc' });
    assert.deepEqual(resultado, [
      { tipo: 'cuota', monto: 16000, fechaCambio: '2026-09-15T00:00:00-03:00' },
      { tipo: 'luz', monto: 4000, fechaCambio: '2026-09-10T00:00:00-03:00' },
      { tipo: 'turno', monto: 4500, fechaCambio: '2026-09-01T00:00:00-03:00' },
    ]);
  });

  it('tipo=cuota consulta solo valores_cuota', async () => {
    const { stub, llamadas } = prismaStub({ cuota: [filaCuota()] });
    const service = new TarifasService(stub as never);

    const resultado = await service.obtenerHistorial({ tipo: 'cuota' });

    assert.equal(llamadas.turno.length, 0);
    assert.equal(llamadas.luz.length, 0);
    assert.equal(llamadas.cuota.length, 1);
    assert.deepEqual(resultado, [
      { tipo: 'cuota', monto: 16000, fechaCambio: '2026-09-15T00:00:00-03:00' },
    ]);
  });

  it('tipo=luz usa costo_x_hora y estados_luz.fecha', async () => {
    const { stub, llamadas } = prismaStub({ luz: [filaLuz()] });
    const service = new TarifasService(stub as never);

    const resultado = await service.obtenerHistorial({ tipo: 'luz' });

    assert.equal(llamadas.turno.length, 0);
    assert.equal(llamadas.cuota.length, 0);
    assert.equal(llamadas.luz.length, 1);
    assert.deepEqual(resultado, [
      { tipo: 'luz', monto: 4000, fechaCambio: '2026-09-10T00:00:00-03:00' },
    ]);
  });

  it('aplica el rango de fechas en cada fuente', async () => {
    const { stub, llamadas } = prismaStub();
    const service = new TarifasService(stub as never);

    await service.obtenerHistorial({
      desde: '2026-09-01T00:00:00-03:00',
      hasta: '2026-09-30T23:59:59-03:00',
    });

    const turnoWhere = llamadas.turno[0].where as { fecha_cambio: { gte: Date; lte: Date } };
    const cuotaWhere = llamadas.cuota[0].where as { fecha_cambio: { gte: Date; lte: Date } };
    const luzWhere = llamadas.luz[0].where as { fecha: { gte: Date; lte: Date } };

    assert.ok(turnoWhere.fecha_cambio.gte instanceof Date);
    assert.ok(turnoWhere.fecha_cambio.lte instanceof Date);
    assert.ok(cuotaWhere.fecha_cambio.gte instanceof Date);
    assert.ok(luzWhere.fecha.gte instanceof Date);
    assert.ok(luzWhere.fecha.lte instanceof Date);
    assert.equal(turnoWhere.fecha_cambio.gte.toISOString(), '2026-09-01T03:00:00.000Z');
    assert.equal(luzWhere.fecha.lte.toISOString(), '2026-10-01T02:59:59.000Z');
  });

  it('aplica el rango de montos en cada fuente', async () => {
    const { stub, llamadas } = prismaStub();
    const service = new TarifasService(stub as never);

    await service.obtenerHistorial({ montoMin: 5000, montoMax: 10000 });

    assert.deepEqual(llamadas.turno[0].where, {
      costo_x_hora: { gte: 5000, lte: 10000 },
    });
    assert.deepEqual(llamadas.cuota[0].where, {
      precio: { gte: 5000, lte: 10000 },
    });
    assert.deepEqual(llamadas.luz[0].where, {
      costo_x_hora: { gte: 5000, lte: 10000 },
    });
  });

  it('responde 400 si desde no es una fecha valida', async () => {
    const { stub } = prismaStub();
    const service = new TarifasService(stub as never);

    await assert.rejects(
      () => service.obtenerHistorial({ desde: 'no-es-fecha' }),
      BadRequestException,
    );
  });

  it('devuelve un array vacio cuando no hay historial', async () => {
    const { stub } = prismaStub();
    const service = new TarifasService(stub as never);

    const resultado = await service.obtenerHistorial({});

    assert.deepEqual(resultado, []);
  });
});