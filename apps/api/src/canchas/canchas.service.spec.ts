import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CanchasService } from './canchas.service';
import { ListarCanchasDto } from './dto/listar-canchas.dto';

const ADMIN: AuthContext = { clerkUserId: 'admin-1', sessionId: null, usuario: null, rol: 'admin' };
const SOCIO: AuthContext = { clerkUserId: 'socio-1', sessionId: null, usuario: null, rol: 'socio' };

const CANCHA_FILA = {
  id: 'cancha-1',
  nro_cancha: 1,
  superficie: 'polvo_de_ladrillo',
  iluminacion: true,
  estado_actual: 'disponible',
};

/** Minimal Prisma stub: only the read methods the listing uses. */
function prismaStub(filas: Record<string, unknown>[] = [CANCHA_FILA]) {
  const findManyCalls: Record<string, unknown>[] = [];
  return {
    prisma: {
      canchas: {
        findMany: async (args: Record<string, unknown>) => {
          findManyCalls.push(args ?? {});
          return filas;
        },
      },
    },
    findManyCalls,
  };
}

const query = (overrides: Partial<ListarCanchasDto> = {}) =>
  Object.assign(new ListarCanchasDto(), overrides);

describe('CanchasService.listar (ACT-29)', () => {
  it('returns the catalog without estados by default', async () => {
    const { prisma } = prismaStub();
    const service = new CanchasService(prisma as never);
    const res = await service.listar(ADMIN, query());
    assert.equal(res.length, 1);
    assert.deepEqual(res[0], {
      id: 'cancha-1',
      nroCancha: 1,
      superficie: 'polvo_de_ladrillo',
      iluminacion: true,
      estadoActual: 'disponible',
    });
  });

  it('includes the estados history when conEstados is true (admin)', async () => {
    const { prisma } = prismaStub([
      {
        ...CANCHA_FILA,
        estados_cancha: [
          {
            valor_state: 'en_mantenimiento',
            fecha_cambio: new Date('2026-09-20T10:00:00Z'),
            motivo: 'Riego',
          },
        ],
      },
    ]);
    const service = new CanchasService(prisma as never);
    const res = await service.listar(ADMIN, query({ conEstados: true }));
    assert.deepEqual(res[0].estados, [
      { valorState: 'en_mantenimiento', fechaCambio: '2026-09-20T10:00:00.000Z', motivo: 'Riego' },
    ]);
  });

  it('throws 403 when a non-admin requests conEstados', async () => {
    const { prisma } = prismaStub();
    const service = new CanchasService(prisma as never);
    await assert.rejects(() => service.listar(SOCIO, query({ conEstados: true })), ForbiddenException);
  });
});
