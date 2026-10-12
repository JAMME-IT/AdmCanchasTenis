import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CanchasService } from './canchas.service';
import { ActualizarCanchaDto } from './dto/actualizar-cancha.dto';
import { CambiarEstadoCanchaDto } from './dto/cambiar-estado-cancha.dto';
import { CrearCanchaDto } from './dto/crear-cancha.dto';
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

interface CrudOptions {
  existente?: Record<string, unknown> | null;
  errorCreate?: unknown;
  errorUpdate?: unknown;
}

/** Prisma stub for the write flows (alta, edicion, cambio de estado). */
function crudStub(options: CrudOptions = {}) {
  const creates: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const estadosCreados: Record<string, unknown>[] = [];
  const tx = {
    canchas: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options.errorCreate) throw options.errorCreate;
        creates.push(data);
        return { id: 'cancha-nueva', ...data };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { ...(options.existente ?? {}), ...data };
      },
    },
    estados_cancha: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        estadosCreados.push(data);
        return { id: `estado-${estadosCreados.length}`, fecha_cambio: new Date(), ...data };
      },
    },
  };
  return {
    prisma: {
      canchas: {
        findUnique: async () => options.existente ?? null,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (options.errorUpdate) throw options.errorUpdate;
          updates.push(data);
          return { ...(options.existente ?? {}), ...data };
        },
      },
      $transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
    },
    creates,
    updates,
    estadosCreados,
  };
}

const dtoCrear = (overrides: Partial<CrearCanchaDto> = {}) =>
  Object.assign(new CrearCanchaDto(), { nroCancha: 2, superficie: 'dura', ...overrides });

const dtoActualizar = (overrides: Partial<ActualizarCanchaDto> = {}) =>
  Object.assign(new ActualizarCanchaDto(), overrides);

describe('CanchasService.crear (ACT-28)', () => {
  it('creates the court and its initial disponible estado in one transaction', async () => {
    const { prisma, creates, estadosCreados } = crudStub();
    const service = new CanchasService(prisma as never);
    const res = await service.crear(dtoCrear({ nroCancha: 3, superficie: 'cesped' }));
    assert.equal(res.id, 'cancha-nueva');
    assert.equal(res.nroCancha, 3);
    assert.equal(res.superficie, 'cesped');
    assert.equal(res.iluminacion, true);
    assert.equal(res.estadoActual, 'disponible');
    assert.equal(creates[0].estado_actual, 'disponible');
    assert.equal(creates[0].nro_cancha, 3);
    assert.deepEqual(estadosCreados[0], { cancha_id: 'cancha-nueva', valor_state: 'disponible' });
  });

  it('honors an explicit iluminacion=false', async () => {
    const { prisma, creates } = crudStub();
    const service = new CanchasService(prisma as never);
    const res = await service.crear(dtoCrear({ iluminacion: false }));
    assert.equal(res.iluminacion, false);
    assert.equal(creates[0].iluminacion, false);
  });

  it('throws 409 when nro_cancha is duplicated (P2002)', async () => {
    const { prisma } = crudStub({ errorCreate: { code: 'P2002' } });
    const service = new CanchasService(prisma as never);
    await assert.rejects(() => service.crear(dtoCrear()), ConflictException);
  });
});

describe('CanchasService.actualizar (ACT-28)', () => {
  it('updates only the provided fields without touching the estado', async () => {
    const { prisma, updates } = crudStub({ existente: { ...CANCHA_FILA } });
    const service = new CanchasService(prisma as never);
    const res = await service.actualizar('cancha-1', dtoActualizar({ superficie: 'cesped' }));
    assert.equal(res.superficie, 'cesped');
    assert.equal(res.estadoActual, 'disponible');
    assert.deepEqual(updates[0], { superficie: 'cesped' });
  });

  it('throws 400 when the body carries no editable field', async () => {
    const { prisma } = crudStub({ existente: { ...CANCHA_FILA } });
    const service = new CanchasService(prisma as never);
    await assert.rejects(() => service.actualizar('cancha-1', dtoActualizar()), BadRequestException);
  });

  it('throws 404 on a missing court', async () => {
    const { prisma } = crudStub();
    const service = new CanchasService(prisma as never);
    await assert.rejects(
      () => service.actualizar('no-existe', dtoActualizar({ nroCancha: 9 })),
      NotFoundException,
    );
  });

  it('throws 409 when nro_cancha is duplicated (P2002)', async () => {
    const { prisma } = crudStub({ existente: { ...CANCHA_FILA }, errorUpdate: { code: 'P2002' } });
    const service = new CanchasService(prisma as never);
    await assert.rejects(
      () => service.actualizar('cancha-1', dtoActualizar({ nroCancha: 9 })),
      ConflictException,
    );
  });
});

const dtoEstado = (overrides: Partial<CambiarEstadoCanchaDto> = {}) =>
  Object.assign(new CambiarEstadoCanchaDto(), {
    estado: 'en_mantenimiento',
    motivo: 'Riego',
    ...overrides,
  });

describe('CanchasService.cambiarEstado (ACT-28)', () => {
  it('appends the historial row and refreshes the cache in one transaction', async () => {
    const { prisma, updates, estadosCreados } = crudStub({ existente: { ...CANCHA_FILA } });
    const service = new CanchasService(prisma as never);
    const res = await service.cambiarEstado(
      'cancha-1',
      dtoEstado({ estado: 'inhabilitada', motivo: 'Reforma' }),
    );
    assert.equal(res.estadoActual, 'inhabilitada');
    assert.deepEqual(estadosCreados[0], {
      cancha_id: 'cancha-1',
      valor_state: 'inhabilitada',
      motivo: 'Reforma',
    });
    assert.deepEqual(updates[0], { estado_actual: 'inhabilitada' });
  });

  it('accepts disponible without motivo', async () => {
    const { prisma, estadosCreados } = crudStub({
      existente: { ...CANCHA_FILA, estado_actual: 'inhabilitada' },
    });
    const service = new CanchasService(prisma as never);
    const res = await service.cambiarEstado('cancha-1', dtoEstado({ estado: 'disponible', motivo: undefined }));
    assert.equal(res.estadoActual, 'disponible');
    assert.deepEqual(estadosCreados[0], { cancha_id: 'cancha-1', valor_state: 'disponible' });
  });

  it('throws 400 when motivo is missing for a non-disponible state', async () => {
    const { prisma } = crudStub({ existente: { ...CANCHA_FILA } });
    const service = new CanchasService(prisma as never);
    await assert.rejects(
      () => service.cambiarEstado('cancha-1', dtoEstado({ estado: 'en_mantenimiento', motivo: undefined })),
      BadRequestException,
    );
  });

  it('throws 422 when the state equals the current one', async () => {
    const { prisma } = crudStub({
      existente: { ...CANCHA_FILA, estado_actual: 'inhabilitada' },
    });
    const service = new CanchasService(prisma as never);
    await assert.rejects(
      () => service.cambiarEstado('cancha-1', dtoEstado({ estado: 'inhabilitada', motivo: 'x' })),
      UnprocessableEntityException,
    );
  });

  it('throws 404 on a missing court', async () => {
    const { prisma } = crudStub();
    const service = new CanchasService(prisma as never);
    await assert.rejects(
      () => service.cambiarEstado('no-existe', dtoEstado()),
      NotFoundException,
    );
  });
});
