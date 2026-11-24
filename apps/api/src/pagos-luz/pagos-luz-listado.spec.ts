import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { PagosLuzService } from './pagos-luz.service';

/**
 * TAR-6 — GET /pagos-luz (ACT-43, RF-44).
 * Contract (docs/API-CONTRATO.md §5.9):
 *  - Admin lists lighting payments, newest first.
 *  - Optional filters: turnoId, usuarioId, desde, hasta (range over fecha_pago).
 *  - Each item expands `turno: { id, fecha, horaInicio, canchaId }` and
 *    `usuario: { id, nombre, apellido, numeroSocio }`.
 *  - Invalid dates are a 400.
 */

const PAGO_ID = '55667788-99aa-bbcc-ddee-ff0011223344';
const TURNO_ID = '5c2a9d10-1111-2222-3333-444455556666';
const USER_ID = '8f14e45f-ea2b-4c3d-9a1b-2c3d4e5f6a7b';
const CANCHA_ID = '0a1b2c3d-4444-5555-6666-777788889999';
const FECHA_PAGO = new Date('2026-09-30T22:10:00-03:00');

function pagoRow(opciones: { numeroSocio?: string | null } = {}) {
  return {
    id_pago_luz: PAGO_ID,
    turno_id: TURNO_ID,
    monto_total_luz: 4000,
    fecha_pago: FECHA_PAGO,
    created_at: FECHA_PAGO,
    turnos: {
      id: TURNO_ID,
      fecha: new Date('2026-09-30T00:00:00Z'),
      // @db.Time: Date anchored at the Unix epoch (UTC), like prisma/seed.ts time().
      hora_inicio: new Date(Date.UTC(1970, 0, 1, 19, 0)),
      cancha_id: CANCHA_ID,
      usuarios: {
        id: USER_ID,
        nombre: 'Ana',
        apellido: 'Perez',
        socios:
          opciones.numeroSocio === null
            ? null
            : { numero_socio: opciones.numeroSocio ?? 'S-0001' },
      },
    },
  };
}

/** Minimal Prisma stub: only pagos_luz.findMany, recording its arguments. */
function prismaStub(pagos: unknown[] = []) {
  const llamadas = {
    findMany: [] as Array<{ where?: unknown; include?: unknown; orderBy?: unknown }>,
  };

  const stub: any = {
    pagos_luz: {
      findMany: async (args: { where?: unknown; include?: unknown; orderBy?: unknown }) => {
        llamadas.findMany.push(args);
        return pagos;
      },
    },
  };

  return { stub, llamadas };
}

describe('PagosLuzService.listar (ACT-43, RF-44)', () => {
  it('devuelve el listado con las expansiones de turno y usuario', async () => {
    const { stub, llamadas } = prismaStub([pagoRow()]);
    const service = new PagosLuzService(stub as never);

    const resultado = await service.listar({});

    assert.equal(llamadas.findMany.length, 1);
    const args = llamadas.findMany[0];
    assert.deepEqual(args.where, {});
    assert.deepEqual(args.orderBy, { fecha_pago: 'desc' });
    assert.ok((args.include as any).turnos.include.usuarios.include.socios);
    assert.deepEqual(resultado, [
      {
        id: PAGO_ID,
        turnoId: TURNO_ID,
        montoTotalLuz: 4000,
        fechaPago: '2026-09-30T22:10:00-03:00',
        createdAt: '2026-09-30T22:10:00-03:00',
        turno: {
          id: TURNO_ID,
          fecha: '2026-09-30',
          horaInicio: '19:00',
          canchaId: CANCHA_ID,
        },
        usuario: {
          id: USER_ID,
          nombre: 'Ana',
          apellido: 'Perez',
          numeroSocio: 'S-0001',
        },
      },
    ]);
  });

  it('filtra por turnoId', async () => {
    const { stub, llamadas } = prismaStub([pagoRow()]);
    const service = new PagosLuzService(stub as never);

    await service.listar({ turnoId: TURNO_ID });

    assert.deepEqual(llamadas.findMany[0].where, { turno_id: TURNO_ID });
  });

  it('filtra por usuarioId a traves del turno', async () => {
    const { stub, llamadas } = prismaStub([pagoRow()]);
    const service = new PagosLuzService(stub as never);

    await service.listar({ usuarioId: USER_ID });

    assert.deepEqual(llamadas.findMany[0].where, {
      turnos: { usuario_id: USER_ID },
    });
  });

  it('filtra por rango de fechaPago con desde y hasta', async () => {
    const { stub, llamadas } = prismaStub([pagoRow()]);
    const service = new PagosLuzService(stub as never);

    await service.listar({
      desde: '2026-09-01T00:00:00-03:00',
      hasta: '2026-09-30T23:59:59-03:00',
    });

    const where = llamadas.findMany[0].where as {
      fecha_pago: { gte: Date; lte: Date };
    };
    assert.ok(where.fecha_pago.gte instanceof Date);
    assert.ok(where.fecha_pago.lte instanceof Date);
    assert.equal(where.fecha_pago.gte.toISOString(), '2026-09-01T03:00:00.000Z');
    assert.equal(where.fecha_pago.lte.toISOString(), '2026-10-01T02:59:59.000Z');
  });

  it('responde 400 si desde no es una fecha valida', async () => {
    const { stub } = prismaStub();
    const service = new PagosLuzService(stub as never);

    await assert.rejects(() => service.listar({ desde: 'no-es-fecha' }), BadRequestException);
  });

  it('devuelve numeroSocio null cuando el usuario no es socio', async () => {
    const { stub } = prismaStub([pagoRow({ numeroSocio: null })]);
    const service = new PagosLuzService(stub as never);

    const resultado = await service.listar({});

    assert.equal(resultado[0].usuario.numeroSocio, null);
  });

  it('devuelve un array vacio cuando no hay pagos', async () => {
    const { stub } = prismaStub([]);
    const service = new PagosLuzService(stub as never);

    const resultado = await service.listar({});

    assert.deepEqual(resultado, []);
  });
});