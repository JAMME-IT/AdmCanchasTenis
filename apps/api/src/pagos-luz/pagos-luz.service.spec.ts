import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PagosLuzService } from './pagos-luz.service';

/**
 * TAR-5 — POST /pagos-luz (ACT-43, RF-33).
 * Contract (docs/API-CONTRATO.md §5.9):
 *  - Admin registers the verified lighting charge of a night turno.
 *  - 404 if the turno does not exist.
 *  - 422 if the turno does not require luz or is cancelled.
 *  - 409 if a luz payment already exists for the turno (one per turno).
 *  - 400 if montoTotalLuz <= 0 or fechaPago is in the future.
 *  - 201 response: { id, turnoId, montoTotalLuz, fechaPago, createdAt }.
 */

const FECHA_PAGO = new Date('2026-09-30T22:10:00-03:00');
const TURNO_ID = '5c2a9d10-1111-2222-3333-444455556666';

interface TurnoRow {
  id: string;
  requiere_luz: boolean;
  estado_actual: string;
  pagos_luz: { id_pago_luz: string }[];
}

function turnoRow(overrides: Partial<TurnoRow> = {}): TurnoRow {
  return {
    id: TURNO_ID,
    requiere_luz: true,
    estado_actual: 'confirmado',
    pagos_luz: [],
    ...overrides,
  };
}

/** Minimal Prisma stub: only the delegates the pago-luz flow touches. */
function prismaStub(opciones: { turno?: TurnoRow | null } = {}) {
  const llamadas = {
    crearPago: [] as Array<{ data: Record<string, unknown> }>,
  };

  const stub: any = {
    turnos: {
      findUnique: async () => opciones.turno ?? null,
    },
    pagos_luz: {
      create: async (args: { data: Record<string, unknown> }) => {
        llamadas.crearPago.push(args);
        return { id_pago_luz: 'pago-luz-1', ...args.data, created_at: FECHA_PAGO };
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(stub),
  };

  return { stub, llamadas };
}

describe('PagosLuzService.registrarPago (ACT-43, RF-33)', () => {
  it('registra el pago de luz de un turno que la requiere', async () => {
    const { stub, llamadas } = prismaStub({ turno: turnoRow() });
    const service = new PagosLuzService(stub as never);

    const resultado = await service.registrarPago({
      turnoId: TURNO_ID,
      montoTotalLuz: 4000,
      fechaPago: FECHA_PAGO.toISOString(),
    });

    assert.equal(llamadas.crearPago.length, 1);
    assert.deepEqual(llamadas.crearPago[0], {
      data: {
        turno_id: TURNO_ID,
        monto_total_luz: 4000,
        fecha_pago: FECHA_PAGO,
      },
    });
    assert.deepEqual(resultado, {
      id: 'pago-luz-1',
      turnoId: TURNO_ID,
      montoTotalLuz: 4000,
      fechaPago: '2026-09-30T22:10:00-03:00',
      createdAt: '2026-09-30T22:10:00-03:00',
    });
  });

  it('usa now() cuando fechaPago no se envia', async () => {
    const { stub, llamadas } = prismaStub({ turno: turnoRow() });
    const service = new PagosLuzService(stub as never);

    const antes = Date.now();
    const resultado = await service.registrarPago({ turnoId: TURNO_ID, montoTotalLuz: 4000 });
    const despues = Date.now();

    const fecha = llamadas.crearPago[0].data.fecha_pago as Date;
    assert.ok(fecha instanceof Date);
    assert.ok(fecha.getTime() >= antes && fecha.getTime() <= despues);
    assert.match(resultado.fechaPago, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
  });

  it('responde 404 si el turno no existe', async () => {
    const { stub } = prismaStub({ turno: null });
    const service = new PagosLuzService(stub as never);

    await assert.rejects(
      () => service.registrarPago({ turnoId: TURNO_ID, montoTotalLuz: 4000 }),
      NotFoundException,
    );
  });

  it('responde 422 si el turno no requiere luz', async () => {
    const { stub } = prismaStub({ turno: turnoRow({ requiere_luz: false }) });
    const service = new PagosLuzService(stub as never);

    await assert.rejects(
      () => service.registrarPago({ turnoId: TURNO_ID, montoTotalLuz: 4000 }),
      UnprocessableEntityException,
    );
  });

  it('responde 422 si el turno esta cancelado', async () => {
    const { stub } = prismaStub({ turno: turnoRow({ estado_actual: 'cancelado' }) });
    const service = new PagosLuzService(stub as never);

    await assert.rejects(
      () => service.registrarPago({ turnoId: TURNO_ID, montoTotalLuz: 4000 }),
      UnprocessableEntityException,
    );
  });

  it('responde 409 si ya existe un pago de luz para el turno', async () => {
    const { stub } = prismaStub({
      turno: turnoRow({ pagos_luz: [{ id_pago_luz: 'pago-existente' }] }),
    });
    const service = new PagosLuzService(stub as never);

    await assert.rejects(
      () => service.registrarPago({ turnoId: TURNO_ID, montoTotalLuz: 4000 }),
      ConflictException,
    );
  });

  it('rechaza un monto que no sea mayor a cero', async () => {
    const { stub } = prismaStub({ turno: turnoRow() });
    const service = new PagosLuzService(stub as never);

    await assert.rejects(
      () => service.registrarPago({ turnoId: TURNO_ID, montoTotalLuz: 0 }),
      BadRequestException,
    );
  });

  it('rechaza una fechaPago futura', async () => {
    const { stub } = prismaStub({ turno: turnoRow() });
    const service = new PagosLuzService(stub as never);

    await assert.rejects(
      () =>
        service.registrarPago({
          turnoId: TURNO_ID,
          montoTotalLuz: 4000,
          fechaPago: new Date(Date.now() + 60_000).toISOString(),
        }),
      BadRequestException,
    );
  });
});