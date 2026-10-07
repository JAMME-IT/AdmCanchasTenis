import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { TurnosController } from './turnos.controller';
import { TurnosService } from './turnos.service';

/** Minimal Prisma stub: only the read methods the availability query uses. */
function prismaStub(overrides: Record<string, Record<string, () => Promise<unknown>>> = {}) {
  return {
    dias_funcionamiento: { findUnique: async () => ({ habilitado: true }), ...overrides.dias_funcionamiento },
    tipos_turno: { findUnique: async () => null, ...overrides.tipos_turno },
    canchas: {
      findUnique: async () => null,
      findMany: async () => [],
      ...overrides.canchas,
    },
    rangos_horario: { findMany: async () => [], ...overrides.rangos_horario },
    luz: { findFirst: async () => null, ...overrides.luz },
    turnos: { findMany: async () => [], ...overrides.turnos },
  };
}

const CANCHA = { id: 'c1', nro_cancha: 1, estado_actual: 'disponible' };
const RANGO = (inicio: string, fin: string) => ({
  hora_inicio: new Date(`1970-01-01T${inicio}:00Z`),
  hora_fin: new Date(`1970-01-01T${fin}:00Z`),
});

describe('TurnosService.obtenerDisponibilidad (ACT-33)', () => {
  it('returns 200 with empty slots on a non-enabled day', async () => {
    const service = new TurnosService(prismaStub({
      dias_funcionamiento: { findUnique: async () => ({ habilitado: false }) },
      canchas: { findMany: async () => [CANCHA] },
    }) as never);
    // 2026-09-30 is a Wednesday → default 60 min.
    const respuesta = await service.obtenerDisponibilidad({ fecha: '2026-09-30' });
    assert.deepEqual(respuesta, { fecha: '2026-09-30', duracionMinutos: 60, slots: [] });
  });

  it('resolves the full contract shape on an enabled day', async () => {
    const service = new TurnosService(prismaStub({
      canchas: { findMany: async () => [CANCHA] },
      rangos_horario: { findMany: async () => [RANGO('08:00', '10:00')] },
      luz: {
        findFirst: async () => ({
          franja_horario_inicio: new Date('1970-01-01T09:30:00Z'),
          franja_horario_fin: new Date('1970-01-01T22:00:00Z'),
        }),
      },
      turnos: {
        findMany: async () => [
          {
            cancha_id: 'c1',
            hora_inicio: new Date('1970-01-01T08:00:00Z'),
            hora_fin: new Date('1970-01-01T09:00:00Z'),
            estado_actual: 'confirmado',
          },
        ],
      },
    }) as never);
    const respuesta = await service.obtenerDisponibilidad({ fecha: '2026-09-30' });
    assert.deepEqual(respuesta, {
      fecha: '2026-09-30',
      duracionMinutos: 60,
      slots: [
        {
          canchaId: 'c1',
          nroCancha: 1,
          horaInicio: '08:00',
          horaFin: '09:00',
          disponible: false,
          requiereLuz: false,
          motivo: 'Turno confirmado',
        },
        {
          canchaId: 'c1',
          nroCancha: 1,
          horaInicio: '09:00',
          horaFin: '10:00',
          disponible: true,
          requiereLuz: true,
          motivo: null,
        },
      ],
    });
  });

  it('uses the explicit tipoTurno duration and 90 min by default on weekends', async () => {
    const conTipo = new TurnosService(prismaStub({
      tipos_turno: { findUnique: async () => ({ id: 't90', duracion_max: 90 }) },
      dias_funcionamiento: { findUnique: async () => ({ habilitado: false }) },
      canchas: { findMany: async () => [] },
    }) as never);
    const respuesta = await conTipo.obtenerDisponibilidad({
      fecha: '2026-09-30',
      tipoTurnoId: 't90',
    });
    assert.equal(respuesta.duracionMinutos, 90);

    const finDeSemana = new TurnosService(prismaStub({
      dias_funcionamiento: { findUnique: async () => ({ habilitado: false }) },
      canchas: { findMany: async () => [] },
    }) as never);
    // 2026-10-03 is a Saturday.
    const sabado = await finDeSemana.obtenerDisponibilidad({ fecha: '2026-10-03' });
    assert.equal(sabado.duracionMinutos, 90);
  });

  it('rejects invalid fecha, unknown tipoTurnoId and unknown canchaId with 400', async () => {
    const service = new TurnosService(prismaStub() as never);
    await assert.rejects(
      service.obtenerDisponibilidad({ fecha: '2026-02-30' }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerDisponibilidad({
        fecha: '2026-09-30',
        tipoTurnoId: '11111111-1111-4111-8111-111111111111',
      }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerDisponibilidad({
        fecha: '2026-09-30',
        canchaId: '22222222-2222-4222-8222-222222222222',
      }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });
});

describe('TurnosController.disponibilidad (ACT-33)', () => {
  it('delegates to the service and returns its response untouched', async () => {
    const esperada = { fecha: '2026-09-30', duracionMinutos: 60, slots: [] };
    let recibida: unknown;
    const controller = new TurnosController({
      obtenerDisponibilidad: async (query: unknown) => {
        recibida = query;
        return esperada;
      },
    } as never);
    const respuesta = await controller.disponibilidad({ fecha: '2026-09-30' });
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibida, { fecha: '2026-09-30' });
  });
});
