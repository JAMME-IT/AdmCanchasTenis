import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TiposTurnoService } from './tipos-turno.service';

/**
 * Unit tests for ticket ACT-32 (duracion de turno configurable).
 * Contract under test (docs/API-CONTRATO.md §7.9, RF-15):
 *  - PATCH /config/tipos-turno/:id is admin-only and updates
 *    `tipos_turno.duracion_max` from `duracionMinutos` in the body.
 *  - Unknown id is a 404 and must not reach the update.
 *  - A duplicated duration (`uq_tipos_turno_duracion_max`) is a 409.
 *  - Any other Prisma error is rethrown unchanged.
 *  - Sending the current duration is a normal 200 (unique index vs itself).
 */

interface FilaTipoTurno {
  id: string;
  duracion_max: number;
}

interface ActualizacionCall {
  where: { id: string };
  data: { duracion_max: number; updated_at: Date };
}

/** Minimal Prisma stub: only the tipos_turno methods the service uses. */
function prismaStub(fila: FilaTipoTurno | null, errorAlActualizar?: unknown) {
  const actualizaciones: ActualizacionCall[] = [];
  return {
    prisma: {
      tipos_turno: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          fila !== null && fila.id === where.id ? fila : null,
        update: async (args: ActualizacionCall) => {
          if (errorAlActualizar !== undefined) {
            throw errorAlActualizar;
          }
          actualizaciones.push(args);
          return {
            ...(fila as FilaTipoTurno),
            duracion_max: args.data.duracion_max,
          };
        },
      },
    },
    actualizaciones,
  };
}

describe('TiposTurnoService.actualizar (ACT-32, PATCH /config/tipos-turno/:id, RF-15)', () => {
  it('actualiza duracion_max con updated_at y responde { id, duracionMinutos }', async () => {
    const { prisma, actualizaciones } = prismaStub({ id: 'tipo-60', duracion_max: 60 });
    const service = new TiposTurnoService(prisma as never);

    const resultado = await service.actualizar('tipo-60', { duracionMinutos: 75 });

    assert.equal(actualizaciones.length, 1);
    assert.deepEqual(actualizaciones[0].where, { id: 'tipo-60' });
    assert.equal(actualizaciones[0].data.duracion_max, 75);
    assert.ok(actualizaciones[0].data.updated_at instanceof Date);
    assert.deepEqual(resultado, { id: 'tipo-60', duracionMinutos: 75 });
  });

  it('lanza NotFoundException y no actualiza cuando el tipo no existe', async () => {
    const { prisma, actualizaciones } = prismaStub(null);
    const service = new TiposTurnoService(prisma as never);

    await assert.rejects(
      () => service.actualizar('tipo-inexistente', { duracionMinutos: 75 }),
      NotFoundException,
    );
    assert.equal(actualizaciones.length, 0);
  });

  it('mapea la violacion de unicidad (P2002) a ConflictException', async () => {
    const violacion = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    const { prisma } = prismaStub({ id: 'tipo-60', duracion_max: 60 }, violacion);
    const service = new TiposTurnoService(prisma as never);

    await assert.rejects(
      () => service.actualizar('tipo-60', { duracionMinutos: 90 }),
      ConflictException,
    );
  });

  it('relanza sin cambios cualquier otro error del update', async () => {
    const fallo = new Error('conexion caida');
    const { prisma } = prismaStub({ id: 'tipo-60', duracion_max: 60 }, fallo);
    const service = new TiposTurnoService(prisma as never);

    await assert.rejects(
      () => service.actualizar('tipo-60', { duracionMinutos: 75 }),
      (error: unknown) => {
        assert.equal(error, fallo);
        return true;
      },
    );
  });

  it('responde 200 cuando se envia la duracion actual', async () => {
    const { prisma, actualizaciones } = prismaStub({ id: 'tipo-75', duracion_max: 75 });
    const service = new TiposTurnoService(prisma as never);

    const resultado = await service.actualizar('tipo-75', { duracionMinutos: 75 });

    assert.equal(actualizaciones.length, 1);
    assert.equal(actualizaciones[0].data.duracion_max, 75);
    assert.deepEqual(resultado, { id: 'tipo-75', duracionMinutos: 75 });
  });
});
