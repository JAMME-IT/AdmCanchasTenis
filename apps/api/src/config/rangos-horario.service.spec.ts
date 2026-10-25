import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { RangosHorarioService } from './rangos-horario.service';

/**
 * Unit tests for ticket ACT-31 (Rangos horarios).
 * Contract under test (docs/API-CONTRATO.md §5.6, RF-34):
 *  - GET /config/rangos-horario: camelCase mapping with HH:MM hours, ascending
 *    by horaInicio; an empty table is [].
 *  - PUT /config/rangos-horario: the body replaces the whole set inside one
 *    transaction. Entries are upserted by `id` when present, otherwise by
 *    `nombre`; stored rows not kept by the body are deleted. Duplicate `nombre`
 *    or two entries resolving to the same stored row are a 409; duplicate `id`,
 *    an unknown `id`, `horaFin <= horaInicio` and overlapping ranges are a 400.
 *    Ranges are half-open, so adjacent ranges are valid.
 */

interface FilaStub {
  id: string;
  nombre: string;
  hora_inicio: Date;
  hora_fin: Date;
}

interface UpsertArgs {
  where: { nombre: string };
  update: { nombre: string; hora_inicio: Date; hora_fin: Date; updated_at: Date };
  create: { nombre: string; hora_inicio: Date; hora_fin: Date };
}

interface UpdateArgs {
  where: { id: string };
  data: { nombre: string; hora_inicio: Date; hora_fin: Date; updated_at: Date };
}

interface DeleteManyArgs {
  where: { id: { notIn: string[] } };
}

/** `HH:MM` on the epoch UTC basis, the same criterion turnos.service.ts reads. */
function fecha(hora: string): Date {
  const [horas, minutos] = hora.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, horas, minutos));
}

/**
 * Minimal in-memory Prisma stub: only the rangos_horario methods the service
 * uses. `findMany` returns the current rows so the service's post-transaction
 * `listar()` observes the resulting set.
 */
function prismaStub(filas: FilaStub[] = []) {
  const estado = filas.map((fila) => ({ ...fila }));
  const upserts: UpsertArgs[] = [];
  const updates: UpdateArgs[] = [];
  const deleteManys: DeleteManyArgs[] = [];
  let transacciones = 0;
  let secuencia = 0;

  const tx = {
    rangos_horario: {
      deleteMany: async (args: DeleteManyArgs) => {
        deleteManys.push(args);
        const conservados = new Set(args.where.id.notIn);
        let borrados = 0;
        for (let i = estado.length - 1; i >= 0; i -= 1) {
          if (!conservados.has(estado[i].id)) {
            estado.splice(i, 1);
            borrados += 1;
          }
        }
        return { count: borrados };
      },
      update: async (args: UpdateArgs) => {
        updates.push(args);
        const fila = estado.find((actual) => actual.id === args.where.id);
        if (!fila) {
          throw new Error(`stub: no existe la fila ${args.where.id}`);
        }
        Object.assign(fila, args.data);
        return { ...fila };
      },
      upsert: async (args: UpsertArgs) => {
        upserts.push(args);
        const existente = estado.find((fila) => fila.nombre === args.where.nombre);
        if (existente) {
          Object.assign(existente, args.update);
          return { ...existente };
        }
        secuencia += 1;
        const nueva: FilaStub = { id: `nuevo-${secuencia}`, ...args.create };
        estado.push(nueva);
        return { ...nueva };
      },
    },
  };

  return {
    prisma: {
      rangos_horario: {
        findMany: async () => estado.map((fila) => ({ ...fila })),
      },
      $transaction: async (cb: (t: unknown) => Promise<unknown>) => {
        transacciones += 1;
        return cb(tx);
      },
    },
    estado,
    upserts,
    updates,
    deleteManys,
    transacciones: () => transacciones,
  };
}

/**
 * Stub whose `$transaction` rejects before running the callback, so the
 * service's unique-violation translation can be exercised without a real
 * database.
 */
function prismaStubConTransaccionFallida(error: unknown) {
  return {
    rangos_horario: {
      findMany: async () => [],
    },
    $transaction: async () => {
      throw error;
    },
  };
}

describe('RangosHorarioService.listar (ACT-31, GET /config/rangos-horario, RF-34)', () => {
  it('mapea snake_case a camelCase, formatea HH:MM y ordena por horaInicio', async () => {
    const { prisma } = prismaStub([
      { id: 'b', nombre: 'noche', hora_inicio: fecha('20:00'), hora_fin: fecha('23:30') },
      { id: 'a', nombre: 'apertura', hora_inicio: fecha('08:00'), hora_fin: fecha('22:00') },
    ]);
    const service = new RangosHorarioService(prisma as never);

    const resultado = await service.listar();

    assert.deepEqual(resultado, [
      { id: 'a', nombre: 'apertura', horaInicio: '08:00', horaFin: '22:00' },
      { id: 'b', nombre: 'noche', horaInicio: '20:00', horaFin: '23:30' },
    ]);
  });

  it('devuelve un array vacio cuando no hay rangos', async () => {
    const { prisma } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    const resultado = await service.listar();

    assert.deepEqual(resultado, []);
  });
});

describe('RangosHorarioService.actualizar (ACT-31, PUT /config/rangos-horario, RF-34)', () => {
  it('crea un rango nuevo por nombre dentro de una transaccion y lo devuelve', async () => {
    const { prisma, upserts, deleteManys, transacciones } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    const resultado = await service.actualizar({
      rangos: [{ nombre: 'apertura', horaInicio: '08:00', horaFin: '22:00' }],
    });

    assert.equal(transacciones(), 1);
    assert.equal(upserts.length, 1);
    assert.deepEqual(upserts[0].where, { nombre: 'apertura' });
    assert.equal(upserts[0].create.nombre, 'apertura');
    assert.ok(upserts[0].create.hora_inicio instanceof Date);
    assert.equal(upserts[0].create.hora_inicio.getUTCHours(), 8);
    assert.equal(upserts[0].create.hora_inicio.getUTCMinutes(), 0);
    assert.equal(upserts[0].create.hora_fin.getUTCHours(), 22);
    assert.deepEqual(deleteManys[0].where, { id: { notIn: [] } });
    assert.deepEqual(resultado, [
      { id: 'nuevo-1', nombre: 'apertura', horaInicio: '08:00', horaFin: '22:00' },
    ]);
  });

  it('actualiza por id cuando el body trae id, sin hacer upsert por nombre', async () => {
    const { prisma, upserts, updates, deleteManys } = prismaStub([
      { id: 'r1', nombre: 'apertura', hora_inicio: fecha('08:00'), hora_fin: fecha('20:00') },
    ]);
    const service = new RangosHorarioService(prisma as never);

    const resultado = await service.actualizar({
      rangos: [{ id: 'r1', nombre: 'apertura', horaInicio: '09:00', horaFin: '21:00' }],
    });

    assert.equal(upserts.length, 0);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].where, { id: 'r1' });
    assert.equal(updates[0].data.hora_inicio.getUTCHours(), 9);
    assert.ok(updates[0].data.updated_at instanceof Date);
    assert.deepEqual(deleteManys[0].where, { id: { notIn: ['r1'] } });
    assert.deepEqual(resultado, [
      { id: 'r1', nombre: 'apertura', horaInicio: '09:00', horaFin: '21:00' },
    ]);
  });

  it('actualiza por nombre cuando el body no trae id', async () => {
    const { prisma, upserts, updates } = prismaStub([
      { id: 'r1', nombre: 'apertura', hora_inicio: fecha('08:00'), hora_fin: fecha('20:00') },
    ]);
    const service = new RangosHorarioService(prisma as never);

    const resultado = await service.actualizar({
      rangos: [{ nombre: 'apertura', horaInicio: '07:30', horaFin: '19:30' }],
    });

    assert.equal(upserts.length, 0);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].where, { id: 'r1' });
    assert.deepEqual(resultado, [
      { id: 'r1', nombre: 'apertura', horaInicio: '07:30', horaFin: '19:30' },
    ]);
  });

  it('intercambia los nombres de dos filas conservadas sin chocar con la unique (rename en dos fases)', async () => {
    const { prisma, updates } = prismaStub([
      { id: 'r1', nombre: 'apertura', hora_inicio: fecha('08:00'), hora_fin: fecha('12:00') },
      { id: 'r2', nombre: 'tarde', hora_inicio: fecha('12:00'), hora_fin: fecha('18:00') },
    ]);
    const service = new RangosHorarioService(prisma as never);

    const resultado = await service.actualizar({
      rangos: [
        { id: 'r1', nombre: 'tarde', horaInicio: '08:00', horaFin: '12:00' },
        { id: 'r2', nombre: 'apertura', horaInicio: '12:00', horaFin: '18:00' },
      ],
    });

    // 2 updates temporales (uno por renombre) + 2 updates finales.
    assert.equal(updates.length, 4);
    const temporales = updates.slice(0, 2).map((update) => update.data.nombre);
    assert.ok(temporales.every((nombre) => nombre.startsWith('tmp-')));
    assert.deepEqual(
      resultado.map((rango) => `${rango.id}:${rango.nombre}`),
      ['r1:tarde', 'r2:apertura'],
    );
  });

  it('borra las filas que el body no conserva y devuelve solo el conjunto resultante', async () => {
    const { prisma, deleteManys, estado } = prismaStub([
      { id: 'r1', nombre: 'apertura', hora_inicio: fecha('08:00'), hora_fin: fecha('12:00') },
      { id: 'r2', nombre: 'tarde', hora_inicio: fecha('12:00'), hora_fin: fecha('18:00') },
      { id: 'r3', nombre: 'noche', hora_inicio: fecha('18:00'), hora_fin: fecha('22:00') },
    ]);
    const service = new RangosHorarioService(prisma as never);

    const resultado = await service.actualizar({
      rangos: [
        { id: 'r1', nombre: 'apertura', horaInicio: '08:00', horaFin: '12:00' },
        { nombre: 'continuo', horaInicio: '12:00', horaFin: '22:00' },
      ],
    });

    assert.deepEqual(deleteManys[0].where, { id: { notIn: ['r1'] } });
    assert.deepEqual(
      estado.map((fila) => fila.nombre),
      ['apertura', 'continuo'],
    );
    assert.deepEqual(
      resultado.map((rango) => rango.nombre),
      ['apertura', 'continuo'],
    );
  });

  it('rechaza un nombre duplicado en el body con ConflictException y no abre transaccion', async () => {
    const { prisma, transacciones } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () =>
        service.actualizar({
          rangos: [
            { nombre: 'apertura', horaInicio: '08:00', horaFin: '12:00' },
            { nombre: 'apertura', horaInicio: '12:00', horaFin: '18:00' },
          ],
        }),
      ConflictException,
    );
    assert.equal(transacciones(), 0);
  });

  it('rechaza con ConflictException dos entradas que resuelven a la misma fila', async () => {
    const { prisma, transacciones } = prismaStub([
      { id: 'r1', nombre: 'apertura', hora_inicio: fecha('08:00'), hora_fin: fecha('12:00') },
    ]);
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () =>
        service.actualizar({
          rangos: [
            { id: 'r1', nombre: 'matutino', horaInicio: '08:00', horaFin: '12:00' },
            { nombre: 'apertura', horaInicio: '12:00', horaFin: '18:00' },
          ],
        }),
      ConflictException,
    );
    assert.equal(transacciones(), 0);
  });

  it('rechaza un id duplicado en el body con BadRequestException', async () => {
    const { prisma, transacciones } = prismaStub([
      { id: 'r1', nombre: 'apertura', hora_inicio: fecha('08:00'), hora_fin: fecha('12:00') },
    ]);
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () =>
        service.actualizar({
          rangos: [
            { id: 'r1', nombre: 'apertura', horaInicio: '08:00', horaFin: '12:00' },
            { id: 'r1', nombre: 'matutino', horaInicio: '12:00', horaFin: '18:00' },
          ],
        }),
      BadRequestException,
    );
    assert.equal(transacciones(), 0);
  });

  it('rechaza un id inexistente con BadRequestException', async () => {
    const { prisma, transacciones } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () =>
        service.actualizar({
          rangos: [
            { id: '11111111-1111-4111-8111-111111111111', nombre: 'apertura', horaInicio: '08:00', horaFin: '12:00' },
          ],
        }),
      BadRequestException,
    );
    assert.equal(transacciones(), 0);
  });

  it('rechaza horaFin igual a horaInicio con BadRequestException', async () => {
    const { prisma, transacciones } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () => service.actualizar({ rangos: [{ nombre: 'apertura', horaInicio: '08:00', horaFin: '08:00' }] }),
      BadRequestException,
    );
    assert.equal(transacciones(), 0);
  });

  it('rechaza horaFin anterior a horaInicio con BadRequestException', async () => {
    const { prisma } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () => service.actualizar({ rangos: [{ nombre: 'apertura', horaInicio: '22:00', horaFin: '08:00' }] }),
      BadRequestException,
    );
  });

  it('rechaza rangos solapados con BadRequestException', async () => {
    const { prisma, transacciones } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () =>
        service.actualizar({
          rangos: [
            { nombre: 'apertura', horaInicio: '08:00', horaFin: '12:00' },
            { nombre: 'tarde', horaInicio: '11:59', horaFin: '18:00' },
          ],
        }),
      BadRequestException,
    );
    assert.equal(transacciones(), 0);
  });

  it('acepta rangos adyacentes porque el solapamiento es half-open', async () => {
    const { prisma, upserts } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    const resultado = await service.actualizar({
      rangos: [
        { nombre: 'apertura', horaInicio: '08:00', horaFin: '12:00' },
        { nombre: 'tarde', horaInicio: '12:00', horaFin: '18:00' },
      ],
    });

    assert.equal(upserts.length, 2);
    assert.deepEqual(
      resultado.map((rango) => rango.nombre),
      ['apertura', 'tarde'],
    );
  });

  it('rechaza un body con rangos vacio con BadRequestException', async () => {
    const { prisma, transacciones } = prismaStub();
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(() => service.actualizar({ rangos: [] }), BadRequestException);
    assert.equal(transacciones(), 0);
  });

  it('traduce una violacion de unicidad de Prisma (P2002) a ConflictException', async () => {
    const prisma = prismaStubConTransaccionFallida({ code: 'P2002' });
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () =>
        service.actualizar({
          rangos: [{ nombre: 'apertura', horaInicio: '08:00', horaFin: '22:00' }],
        }),
      ConflictException,
    );
  });

  it('repropaga sin cambios un error que no es de unicidad', async () => {
    const boom = new Error('boom');
    const prisma = prismaStubConTransaccionFallida(boom);
    const service = new RangosHorarioService(prisma as never);

    await assert.rejects(
      () =>
        service.actualizar({
          rangos: [{ nombre: 'apertura', horaInicio: '08:00', horaFin: '22:00' }],
        }),
      (error) => error === boom,
    );
  });
});
