import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CuotasService } from './cuotas.service';
import { RegistrarPagoCuotaDto } from './dto/registrar-pago-cuota.dto';

interface CuotaDb {
  cuota?: Record<string, unknown> | null;
  lineas?: Record<string, unknown>[];
}

const CUOTA_BASE = {
  id: 'cuota-1',
  socio_id: 'socio-1',
  fecha_inicio: new Date('2026-09-01T00:00:00Z'),
  fecha_vencimiento: new Date('2026-09-10T00:00:00Z'),
  monto_total: 15000,
  estado_actual: 'pendiente',
};

function cuotaStub(db: CuotaDb = {}) {
  const existente = !('cuota' in db) || db.cuota !== null;
  const cuotaRow = ('cuota' in db ? db.cuota : CUOTA_BASE) as Record<string, unknown> | null;
  const lineas = db.lineas ?? [];
  const creada: Record<string, unknown>[] = [];
  const estados: Record<string, unknown>[] = [];
  const tx = {
    cuotas: {
      findUnique: async () =>
        !existente || !cuotaRow ? null : { ...cuotaRow, lineas_cuota: lineas },
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...cuotaRow, ...data }),
    },
    lineas_cuota: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `linea-${creada.length + 1}`, ...data };
        creada.push(row);
        return row;
      },
    },
    estados_cuota: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        estados.push(data);
        return data;
      },
    },
  };
  return {
    prisma: {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    },
    creada,
    estados,
  };
}

const dto = (overrides: Partial<Record<string, unknown>> = {}) =>
  Object.assign(new RegistrarPagoCuotaDto(), { monto: 5000, ...overrides });

describe('CuotasService.registrarPago (ACT-40)', () => {
  it('registers a total payment as pagada with linea 1', async () => {
    const { prisma, estados } = cuotaStub();
    const service = new CuotasService(prisma as never);
    const res = await service.registrarPago('cuota-1', dto({ monto: 15000 }), new Date('2026-09-15T12:00:00Z'));
    assert.equal(res.cuota.estadoActual, 'pagada');
    assert.equal(res.cuota.totalPagado, 15000);
    assert.equal(res.cuota.saldo, 0);
    assert.equal(res.linea.numeroLinea, 1);
    assert.equal(res.linea.monto, 15000);
    assert.equal(estados[0].valor_estado, 'pagada');
  });

  it('registers a partial payment as parcial', async () => {
    const { prisma } = cuotaStub();
    const service = new CuotasService(prisma as never);
    const res = await service.registrarPago('cuota-1', dto({ monto: 5000 }), new Date('2026-09-05T12:00:00Z'));
    assert.equal(res.cuota.estadoActual, 'parcial');
    assert.equal(res.cuota.totalPagado, 5000);
    assert.equal(res.cuota.saldo, 10000);
  });

  it('completes with a second line keeping the correlative number', async () => {
    const { prisma } = cuotaStub({
      lineas: [{ numero_linea: 1, monto: 5000, estado: 'registrada' }],
    });
    const service = new CuotasService(prisma as never);
    const res = await service.registrarPago('cuota-1', dto({ monto: 10000 }), new Date('2026-09-06T12:00:00Z'));
    assert.equal(res.linea.numeroLinea, 2);
    assert.equal(res.cuota.estadoActual, 'pagada');
  });

  it('throws 404 on missing cuota', async () => {
    const { prisma } = cuotaStub({ cuota: null });
    const service = new CuotasService(prisma as never);
    await assert.rejects(() => service.registrarPago('no-existe', dto()), NotFoundException);
  });

  it('throws 409 on cancelada', async () => {
    const { prisma } = cuotaStub({ cuota: { ...CUOTA_BASE, estado_actual: 'cancelada' } });
    const service = new CuotasService(prisma as never);
    await assert.rejects(() => service.registrarPago('cuota-1', dto()), ConflictException);
  });

  it('throws 422 when monto exceeds saldo', async () => {
    const { prisma } = cuotaStub({
      lineas: [{ numero_linea: 1, monto: 12000, estado: 'registrada' }],
    });
    const service = new CuotasService(prisma as never);
    await assert.rejects(
      () => service.registrarPago('cuota-1', dto({ monto: 4000 }), new Date('2026-09-06T12:00:00Z')),
      UnprocessableEntityException,
    );
  });

  it('throws 400 on future fechaPago and non-positive monto', async () => {
    const { prisma } = cuotaStub();
    const service = new CuotasService(prisma as never);
    await assert.rejects(
      () =>
        service.registrarPago(
          'cuota-1',
          dto({ fechaPago: '2999-01-01T00:00:00.000Z' }),
          new Date('2026-09-06T12:00:00Z'),
        ),
      BadRequestException,
    );
    await assert.rejects(
      () => service.registrarPago('cuota-1', dto({ monto: 0 }), new Date('2026-09-06T12:00:00Z')),
      BadRequestException,
    );
  });

  it('validates DTO: monto > 0 and fechaPago ISO', async () => {
    const invalido = dto({ monto: -5, fechaPago: 'no-fecha' });
    const errores = await validate(invalido);
    assert.ok(errores.length >= 2);
  });
});
