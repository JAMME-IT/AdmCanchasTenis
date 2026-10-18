import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { CuotasService } from './cuotas.service';

function servicioCon(cuotas: unknown[], socio: unknown) {
  const prisma = {
    socios: {
      findUnique: async () => socio,
    },
    cuotas: {
      findMany: async () => cuotas,
    },
  };
  return new CuotasService(prisma as never);
}

const authSocio = (id = 'usuario-1') =>
  ({ usuario: { id }, rol: 'socio', clerkUserId: 'user_x', sessionId: 'sess_x' }) as never;

describe('CuotasService.obtenerMias (ACT-48)', () => {
  it('returns own fees with pagos, totals and saldo', async () => {
    const cuotas = [
      {
        id: 'cuota-1',
        socio_id: 'socio-1',
        fecha_inicio: new Date('2026-09-01T00:00:00Z'),
        fecha_vencimiento: new Date('2026-09-10T00:00:00Z'),
        monto_total: 15000,
        estado_actual: 'parcial',
        created_at: new Date('2026-09-01T00:05:00Z'),
        updated_at: new Date('2026-09-15T10:00:00Z'),
        lineas_cuota: [
          { id: 'l1', numero_linea: 1, monto: 10000, fecha_pago: new Date('2026-09-15T10:00:00Z'), estado: 'registrada' },
          { id: 'l2', numero_linea: 2, monto: 100, fecha_pago: new Date('2026-09-16T10:00:00Z'), estado: 'anulada' },
        ],
      },
    ];
    const service = servicioCon(cuotas, { id: 'socio-1' });
    const res = await service.obtenerMias(authSocio());
    assert.equal(res.length, 1);
    assert.equal(res[0].id, 'cuota-1');
    assert.equal(res[0].totalPagado, 10000);
    assert.equal(res[0].saldo, 5000);
    assert.equal(res[0].pagos.length, 1);
    assert.equal(res[0].pagos[0].numeroLinea, 1);
  });

  it('rejects without registered user (403)', async () => {
    const service = servicioCon([], { id: 'socio-1' });
    await assert.rejects(service.obtenerMias({ usuario: null } as never), ForbiddenException);
  });

  it('rejects when the user has no socio row (403)', async () => {
    const service = servicioCon([], null);
    await assert.rejects(service.obtenerMias(authSocio()), ForbiddenException);
  });
});
