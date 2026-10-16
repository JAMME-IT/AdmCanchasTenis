import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { TurnosController } from './turnos.controller';
import { TurnosService } from './turnos.service';

/** Minimal Prisma stub for admin listing tests. */
function prismaStub(overrides: Record<string, Record<string, () => Promise<unknown>>> = {}) {
  return {
    turnos: {
      findMany: async () => [],
      ...overrides.turnos,
    },
  };
}

const USUARIO_1 = { id: 'u1', nombre: 'Juan', apellido: 'Perez' };
const USUARIO_2 = { id: 'u2', nombre: 'Maria', apellido: 'Gonzalez' };
const CANCHA_1 = { id: 'c1', nro_cancha: 1 };
const CANCHA_2 = { id: 'c2', nro_cancha: 2 };

const TURNO_BASE = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  usuario_id: 'u1',
  cancha_id: 'c1',
  tipo_turno_id: 'tt1',
  valor_turno_id: 'vt1',
  fecha: new Date('2026-10-15T12:00:00Z'),
  hora_inicio: new Date('1970-01-01T18:00:00Z'),
  hora_fin: new Date('1970-01-01T19:00:00Z'),
  cantidad_personas: 4,
  cantidad_no_socios: 1,
  costo_turno_ns: 5000,
  requiere_luz: false,
  estado_actual: 'confirmado',
  estado_pago: 'impago',
  created_at: new Date('2026-10-10T10:00:00Z'),
  updated_at: new Date('2026-10-10T10:00:00Z'),
  usuarios: USUARIO_1,
  canchas: CANCHA_1,
  ...overrides,
});

describe('TurnosService.listarAdmin (ACT-37)', () => {
  it('returns all turnos without filters ordered by fecha and hora descending', async () => {
    const turnos = [
      TURNO_BASE({ id: 't1', fecha: new Date('2026-10-15T12:00:00Z') }),
      TURNO_BASE({ id: 't2', fecha: new Date('2026-10-14T12:00:00Z') }),
    ];
    const service = new TurnosService(
      prismaStub({
        turnos: { findMany: async () => turnos },
      }) as never,
    );

    const resultado = await service.listarAdmin({});

    assert.equal(resultado.length, 2);
    assert.equal(resultado[0].id, 't1');
    assert.equal(resultado[0].usuario.nombre, 'Juan');
    assert.equal(resultado[0].usuario.apellido, 'Perez');
    assert.equal(resultado[0].cancha.nroCancha, 1);
  });

  it('filters by exact fecha', async () => {
    let receivedWhere: unknown;
    const service = new TurnosService(
      prismaStub({
        turnos: {
          findMany: async (...args: unknown[]) => {
            receivedWhere = (args[0] as { where: unknown }).where;
            return [TURNO_BASE()];
          },
        },
      }) as never,
    );

    await service.listarAdmin({ fecha: '2026-10-15' });

    assert.ok(receivedWhere);
    const where = receivedWhere as { fecha: Date };
    assert.ok(where.fecha);
    assert.equal(where.fecha.toISOString().slice(0, 10), '2026-10-15');
  });

  it('filters by desde/hasta range inclusively', async () => {
    let receivedWhere: unknown;
    const service = new TurnosService(
      prismaStub({
        turnos: {
          findMany: async (...args: unknown[]) => {
            receivedWhere = (args[0] as { where: unknown }).where;
            return [];
          },
        },
      }) as never,
    );

    await service.listarAdmin({ desde: '2026-10-01', hasta: '2026-10-31' });

    assert.ok(receivedWhere);
    const where = receivedWhere as { fecha: { gte: Date; lte: Date } };
    assert.ok(where.fecha.gte);
    assert.ok(where.fecha.lte);
    assert.equal(where.fecha.gte.toISOString().slice(0, 10), '2026-10-01');
    assert.equal(where.fecha.lte.toISOString().slice(0, 10), '2026-10-31');
  });

  it('filters by busqueda on usuario nombre/apellido with ILIKE', async () => {
    let receivedWhere: unknown;
    const service = new TurnosService(
      prismaStub({
        turnos: {
          findMany: async (...args: unknown[]) => {
            receivedWhere = (args[0] as { where: unknown }).where;
            return [];
          },
        },
      }) as never,
    );

    await service.listarAdmin({ busqueda: 'juan' });

    assert.ok(receivedWhere);
    const where = receivedWhere as {
      usuarios: { OR: Array<{ nombre: { contains: string; mode: string }; apellido: { contains: string; mode: string } }> };
    };
    assert.ok(where.usuarios);
    assert.ok(where.usuarios.OR);
    assert.equal(where.usuarios.OR.length, 2);
    assert.equal(where.usuarios.OR[0].nombre.contains, 'juan');
    assert.equal(where.usuarios.OR[0].nombre.mode, 'insensitive');
  });

  it('rejects invalid fecha format with 400', async () => {
    const service = new TurnosService(prismaStub() as never);

    await assert.rejects(
      service.listarAdmin({ fecha: '2026-13-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('rejects invalid desde format with 400', async () => {
    const service = new TurnosService(prismaStub() as never);

    await assert.rejects(
      service.listarAdmin({ desde: 'invalid-date' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('rejects invalid hasta format with 400', async () => {
    const service = new TurnosService(prismaStub() as never);

    await assert.rejects(
      service.listarAdmin({ hasta: '2026/10/31' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('rejects cuando desde es posterior a hasta with 400', async () => {
    const service = new TurnosService(prismaStub() as never);

    await assert.rejects(
      service.listarAdmin({ desde: '2026-10-31', hasta: '2026-10-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('combines multiple filters in the same query', async () => {
    let receivedWhere: unknown;
    const service = new TurnosService(
      prismaStub({
        turnos: {
          findMany: async (...args: unknown[]) => {
            receivedWhere = (args[0] as { where: unknown }).where;
            return [];
          },
        },
      }) as never,
    );

    await service.listarAdmin({
      busqueda: 'perez',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });

    assert.ok(receivedWhere);
    const where = receivedWhere as {
      usuarios: unknown;
      fecha: { gte: Date; lte: Date };
    };
    assert.ok(where.usuarios);
    assert.ok(where.fecha);
    assert.ok(where.fecha.gte);
    assert.ok(where.fecha.lte);
  });
});

describe('TurnosController.listarAdmin (ACT-37)', () => {
  it('delegates to the service and returns its response', async () => {
    const esperada = [
      {
        id: 't1',
        usuarioId: 'u1',
        canchaId: 'c1',
        tipoTurnoId: 'tt1',
        valorTurnoId: 'vt1',
        fecha: '2026-10-15',
        horaInicio: '18:00',
        horaFin: '19:00',
        cantidadPersonas: 4,
        cantidadNoSocios: 1,
        costoTurnoNs: 5000,
        requiereLuz: false,
        estadoActual: 'confirmado',
        estadoPago: 'impago',
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-10T10:00:00.000Z',
        usuario: { id: 'u1', nombre: 'Juan', apellido: 'Perez' },
        cancha: { id: 'c1', nroCancha: 1 },
      },
    ];
    let recibida: unknown;
    const controller = new TurnosController({
      listarAdmin: async (query: unknown) => {
        recibida = query;
        return esperada;
      },
    } as never);

    const respuesta = await controller.listarAdmin({ busqueda: 'juan', fecha: '2026-10-15' });

    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibida, { busqueda: 'juan', fecha: '2026-10-15' });
  });
});
