import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { horaDesdeTexto } from '../config/hora';
import { TarifasService } from './tarifas.service';

/**
 * TAR-4 — PUT /tarifas/luz (ACT-43, RF-16/RF-28).
 * Contract (docs/API-CONTRATO.md §5.8):
 *  - Updates the single operative `luz` row; upsert if it does not exist yet.
 *  - `costoXHora` is versioned in `estados_luz` only when it actually changes.
 *  - The lighting window (`franjaHorarioInicio`/`franjaHorarioFin`) is NOT versioned.
 *  - Optional window fields must come together and `fin > inicio`.
 *  - Response: { id, costoXHora, franjaHorarioInicio, franjaHorarioFin, fechaCambio }.
 *
 * Time columns are `@db.Time` and Prisma delivers them as Date values anchored at
 * the Unix epoch (UTC), exactly like prisma/seed.ts `time()`.
 */

const FECHA_CAMBIO = new Date('2026-11-01T00:00:00-03:00');

interface LuzRow {
  id: string;
  costo_x_hora: number;
  franja_horario_inicio: Date;
  franja_horario_fin: Date;
  created_at: Date;
}

function luzRow(overrides: Partial<LuzRow> = {}): LuzRow {
  return {
    id: 'aabbccdd-1111-2222-3333-444455556666',
    costo_x_hora: 4000,
    franja_horario_inicio: horaDesdeTexto('18:30'),
    franja_horario_fin: horaDesdeTexto('22:00'),
    created_at: new Date('2026-08-01T00:00:00-03:00'),
    ...overrides,
  };
}

/**
 * Minimal Prisma stub: only the delegates the luz upsert touches.
 * `$transaction` runs the callback against the same stub and records the calls.
 */
function prismaStub(opciones: { luz?: LuzRow | null } = {}) {
  const llamadas = {
    crearLuz: [] as Array<{ data: Record<string, unknown> }>,
    actualizarLuz: [] as Array<{ data: Record<string, unknown> }>,
    crearHistorial: [] as Array<{ data: Record<string, unknown> }>,
  };

  const luzActual = opciones.luz ?? null;

  const stub: any = {
    luz: {
      findFirst: async () => luzActual,
      create: async (args: { data: Record<string, unknown> }) => {
        llamadas.crearLuz.push(args);
        return { id: 'luz-nueva', ...args.data, created_at: FECHA_CAMBIO };
      },
      update: async (args: { data: Record<string, unknown> }) => {
        llamadas.actualizarLuz.push(args);
        return { ...luzActual, ...args.data };
      },
    },
    estados_luz: {
      create: async (args: { data: Record<string, unknown> }) => {
        llamadas.crearHistorial.push(args);
        return { id: 'hist-1', ...args.data, fecha: FECHA_CAMBIO };
      },
      findFirst: async () => ({ fecha: FECHA_CAMBIO }),
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(stub),
  };

  return { stub, llamadas };
}

describe('TarifasService.actualizarTarifaLuz (ACT-43, RF-16/RF-28)', () => {
  it('crea la fila operativa con la franja por defecto del club cuando no existe', async () => {
    const { stub, llamadas } = prismaStub({ luz: null });
    const service = new TarifasService(stub as never);

    const resultado = await service.actualizarTarifaLuz({ costoXHora: 5000 });

    assert.equal(llamadas.crearLuz.length, 1);
    const data = llamadas.crearLuz[0].data;
    assert.equal(data.costo_x_hora, 5000);
    assert.deepEqual(data.franja_horario_inicio, horaDesdeTexto('18:30'));
    assert.deepEqual(data.franja_horario_fin, horaDesdeTexto('22:00'));
    assert.equal(llamadas.crearHistorial.length, 1);
    assert.equal(llamadas.crearHistorial[0].data.costo_x_hora, 5000);
    assert.deepEqual(resultado, {
      id: 'luz-nueva',
      costoXHora: 5000,
      franjaHorarioInicio: '18:30',
      franjaHorarioFin: '22:00',
      fechaCambio: '2026-11-01T00:00:00-03:00',
    });
  });

  it('actualiza costo y franja y versiona el costo cuando cambia', async () => {
    const { stub, llamadas } = prismaStub({ luz: luzRow() });
    const service = new TarifasService(stub as never);

    const resultado = await service.actualizarTarifaLuz({
      costoXHora: 5000,
      franjaHorarioInicio: '19:00',
      franjaHorarioFin: '23:00',
    });

    assert.equal(llamadas.actualizarLuz.length, 1);
    const data = llamadas.actualizarLuz[0].data;
    assert.equal(data.costo_x_hora, 5000);
    assert.deepEqual(data.franja_horario_inicio, horaDesdeTexto('19:00'));
    assert.deepEqual(data.franja_horario_fin, horaDesdeTexto('23:00'));
    assert.equal(llamadas.crearHistorial.length, 1);
    assert.equal(llamadas.crearHistorial[0].data.costo_x_hora, 5000);
    assert.deepEqual(resultado, {
      id: 'aabbccdd-1111-2222-3333-444455556666',
      costoXHora: 5000,
      franjaHorarioInicio: '19:00',
      franjaHorarioFin: '23:00',
      fechaCambio: '2026-11-01T00:00:00-03:00',
    });
  });

  it('no versiona el costo cuando el monto no cambia', async () => {
    const { stub, llamadas } = prismaStub({ luz: luzRow({ costo_x_hora: 4000 }) });
    const service = new TarifasService(stub as never);

    const resultado = await service.actualizarTarifaLuz({
      costoXHora: 4000,
      franjaHorarioInicio: '19:00',
      franjaHorarioFin: '23:00',
    });

    assert.equal(llamadas.actualizarLuz.length, 1);
    assert.equal(llamadas.crearHistorial.length, 0);
    assert.deepEqual(resultado, {
      id: 'aabbccdd-1111-2222-3333-444455556666',
      costoXHora: 4000,
      franjaHorarioInicio: '19:00',
      franjaHorarioFin: '23:00',
      fechaCambio: '2026-11-01T00:00:00-03:00',
    });
  });

  it('conserva la franja actual si el body no la envia', async () => {
    const { stub, llamadas } = prismaStub({ luz: luzRow({ costo_x_hora: 4000 }) });
    const service = new TarifasService(stub as never);

    const resultado = await service.actualizarTarifaLuz({ costoXHora: 5000 });

    const data = llamadas.actualizarLuz[0].data;
    assert.equal(data.costo_x_hora, 5000);
    assert.ok(!('franja_horario_inicio' in data));
    assert.ok(!('franja_horario_fin' in data));
    assert.equal(llamadas.crearHistorial.length, 1);
    assert.deepEqual(resultado, {
      id: 'aabbccdd-1111-2222-3333-444455556666',
      costoXHora: 5000,
      franjaHorarioInicio: '18:30',
      franjaHorarioFin: '22:00',
      fechaCambio: '2026-11-01T00:00:00-03:00',
    });
  });

  it('rechaza una franja incompleta', async () => {
    const { stub } = prismaStub({ luz: luzRow() });
    const service = new TarifasService(stub as never);

    await assert.rejects(
      () =>
        service.actualizarTarifaLuz({
          costoXHora: 4000,
          franjaHorarioInicio: '19:00',
        }),
      BadRequestException,
    );
  });

  it('rechaza una franja que no termina despues de empezar', async () => {
    const { stub } = prismaStub({ luz: luzRow() });
    const service = new TarifasService(stub as never);

    await assert.rejects(
      () =>
        service.actualizarTarifaLuz({
          costoXHora: 4000,
          franjaHorarioInicio: '22:00',
          franjaHorarioFin: '22:00',
        }),
      BadRequestException,
    );
  });
});