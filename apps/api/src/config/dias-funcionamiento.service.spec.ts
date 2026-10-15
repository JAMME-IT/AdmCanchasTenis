import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { DiasFuncionamientoService } from './dias-funcionamiento.service';

/**
 * Unit tests for ticket ACT-30 (Dias de funcionamiento).
 * Contract under test (docs/API-CONTRATO.md §5.6, RF-35):
 *  - GET /config/dias-funcionamiento: always the full 7-day ISO view (1..7).
 *    A day without a stored row is reported as habilitado=false, because booking
 *    availability reads a missing row as a non-operating day (turnos.service.ts).
 *  - PUT /config/dias-funcionamiento: transactional upsert of only the provided
 *    days; a duplicate diaSemana in the body is a 400; the response is the full
 *    7-day view after the upsert.
 */

interface UpsertCall {
  where: { dia_semana: number };
  update: { habilitado: boolean; updated_at: Date };
  create: { dia_semana: number; habilitado: boolean };
}

/** Minimal Prisma stub: only the dias_funcionamiento methods the service uses. */
function prismaStub(filas: Array<{ dia_semana: number; habilitado: boolean }> = []) {
  const upserts: UpsertCall[] = [];
  const tx = {
    dias_funcionamiento: {
      upsert: async (args: UpsertCall) => {
        upserts.push(args);
        return { dia_semana: args.where.dia_semana, habilitado: args.create.habilitado };
      },
    },
  };
  return {
    prisma: {
      dias_funcionamiento: {
        findMany: async () => filas,
      },
      $transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
    },
    upserts,
  };
}

describe('DiasFuncionamientoService.listar (ACT-30, GET /config/dias-funcionamiento, RF-35)', () => {
  it('devuelve los 7 dias ordenados 1..7 y marca en false los dias sin fila', async () => {
    const { prisma } = prismaStub([{ dia_semana: 1, habilitado: true }]);
    const service = new DiasFuncionamientoService(prisma as never);

    const resultado = await service.listar();

    assert.equal(resultado.length, 7);
    assert.deepEqual(
      resultado.map((dia) => dia.diaSemana),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.deepEqual(resultado[0], { diaSemana: 1, habilitado: true });
    assert.deepEqual(
      resultado.slice(1),
      [2, 3, 4, 5, 6, 7].map((diaSemana) => ({ diaSemana, habilitado: false })),
    );
  });

  it('devuelve los 7 dias en false cuando no hay filas', async () => {
    const { prisma } = prismaStub();
    const service = new DiasFuncionamientoService(prisma as never);

    const resultado = await service.listar();

    assert.equal(resultado.length, 7);
    assert.ok(resultado.every((dia) => dia.habilitado === false));
  });
});

describe('DiasFuncionamientoService.actualizar (ACT-30, PUT /config/dias-funcionamiento, RF-35)', () => {
  it('hace upsert de cada dia con updated_at y devuelve la vista completa de 7 dias', async () => {
    const { prisma, upserts } = prismaStub([{ dia_semana: 1, habilitado: true }]);
    const service = new DiasFuncionamientoService(prisma as never);

    const resultado = await service.actualizar({
      dias: [
        { diaSemana: 1, habilitado: true },
        { diaSemana: 7, habilitado: false },
      ],
    });

    assert.equal(upserts.length, 2);
    assert.deepEqual(upserts[0].where, { dia_semana: 1 });
    assert.deepEqual(upserts[0].create, { dia_semana: 1, habilitado: true });
    assert.equal(upserts[0].update.habilitado, true);
    assert.ok(upserts[0].update.updated_at instanceof Date);
    assert.deepEqual(upserts[1].where, { dia_semana: 7 });
    assert.deepEqual(upserts[1].create, { dia_semana: 7, habilitado: false });
    assert.equal(upserts[1].update.habilitado, false);
    assert.ok(upserts[1].update.updated_at instanceof Date);

    assert.equal(resultado.length, 7);
    assert.deepEqual(resultado[0], { diaSemana: 1, habilitado: true });
    assert.deepEqual(resultado[6], { diaSemana: 7, habilitado: false });
  });

  it('rechaza dias duplicados en el body con BadRequestException y no hace upsert', async () => {
    const { prisma, upserts } = prismaStub();
    const service = new DiasFuncionamientoService(prisma as never);

    await assert.rejects(
      () =>
        service.actualizar({
          dias: [
            { diaSemana: 3, habilitado: true },
            { diaSemana: 3, habilitado: false },
          ],
        }),
      BadRequestException,
    );
    assert.equal(upserts.length, 0);
  });
});
