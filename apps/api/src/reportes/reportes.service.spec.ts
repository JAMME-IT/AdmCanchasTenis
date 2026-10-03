import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

/** Minimal Prisma stub: only the read methods the statistics query uses. */
function prismaStub(overrides: Record<string, Record<string, unknown>> = {}) {
  return {
    turnos: { findMany: async () => [], ...overrides.turnos },
    canchas: { findMany: async () => [], ...overrides.canchas },
    usuarios: { findMany: async () => [], ...overrides.usuarios },
  };
}

/** `HH:MM` → Date for a Prisma `@db.Time` column (midnight-based, UTC). */
const HORA = (hora: string) => new Date(`1970-01-01T${hora}:00Z`);

const CANCHAS = [
  { id: 'c1', nro_cancha: 1 },
  { id: 'c2', nro_cancha: 2 },
];

const SIN_USUARIOS = { usuarios: { findMany: async () => [] } };

describe('ReportesService.obtenerEstadisticas (ACT-45)', () => {
  it('returns zeros with the exact §5.10 shape on an empty period', async () => {
    const service = new ReportesService(prismaStub(SIN_USUARIOS) as never);
    const respuesta = await service.obtenerEstadisticas({ desde: '2026-09-01', hasta: '2026-09-30' });
    assert.deepEqual(respuesta, {
      periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      turnos: {
        total: 0,
        porEstado: { confirmado: 0, iniciado: 0, finalizado: 0, cancelado: 0, no_asistio: 0 },
        porCancha: [],
        porFranja: [],
      },
      usuarios: { sociosActivos: 0, noSocios: 0, morosos: 0 },
    });
  });

  it('aggregates porEstado, porCancha (with nroCancha join) and porFranja', async () => {
    const service = new ReportesService(
      prismaStub({
        ...SIN_USUARIOS,
        canchas: { findMany: async () => CANCHAS },
        turnos: {
          findMany: async () => [
            { estado_actual: 'finalizado', cancha_id: 'c2', hora_inicio: HORA('19:00') },
            { estado_actual: 'finalizado', cancha_id: 'c1', hora_inicio: HORA('19:00') },
            { estado_actual: 'cancelado', cancha_id: 'c1', hora_inicio: HORA('08:00') },
            { estado_actual: 'no_asistio', cancha_id: 'c1', hora_inicio: HORA('08:00') },
          ],
        },
      }) as never,
    );
    const respuesta = await service.obtenerEstadisticas({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    assert.equal(respuesta.turnos.total, 4);
    assert.deepEqual(respuesta.turnos.porEstado, {
      confirmado: 0,
      iniciado: 0,
      finalizado: 2,
      cancelado: 1,
      no_asistio: 1,
    });
    assert.deepEqual(respuesta.turnos.porCancha, [
      { canchaId: 'c1', nroCancha: 1, cantidad: 3 },
      { canchaId: 'c2', nroCancha: 2, cantidad: 1 },
    ]);
    assert.deepEqual(respuesta.turnos.porFranja, [
      { horaInicio: '08:00', cantidad: 2 },
      { horaInicio: '19:00', cantidad: 2 },
    ]);
  });

  it('defaults a missing bound to the current month in America/Argentina/Buenos_Aires', async () => {
    let whereRecibido: { fecha?: { gte?: Date; lte?: Date } } = {};
    const service = new ReportesService(
      prismaStub({
        ...SIN_USUARIOS,
        canchas: { findMany: async () => [] },
        turnos: {
          findMany: async (args?: { where?: { fecha?: { gte?: Date; lte?: Date } } }) => {
            whereRecibido = args?.where ?? {};
            return [];
          },
        },
      }) as never,
    );
    // 2026-09-15 12:00 UTC is still 2026-09-15 09:00 in Buenos Aires (UTC-3).
    const respuesta = await service.obtenerEstadisticas({}, new Date('2026-09-15T12:00:00Z'));
    assert.deepEqual(respuesta.periodo, { desde: '2026-09-01', hasta: '2026-09-30' });
    assert.equal(whereRecibido.fecha?.gte?.toISOString(), '2026-09-01T12:00:00.000Z');
    assert.equal(whereRecibido.fecha?.lte?.toISOString(), '2026-09-30T12:00:00.000Z');
  });

  it('rejects invalid dates and desde>hasta with 400', async () => {
    const service = new ReportesService(prismaStub(SIN_USUARIOS) as never);
    await assert.rejects(
      service.obtenerEstadisticas({ desde: '2026-02-30', hasta: '2026-03-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerEstadisticas({ desde: '09/01/2026', hasta: '2026-09-30' }),
      (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
      service.obtenerEstadisticas({ desde: '2026-09-30', hasta: '2026-09-01' }),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('counts usuarios by current role + estado, with role winning over the socios row', async () => {
    const service = new ReportesService(
      prismaStub({
        canchas: { findMany: async () => [] },
        usuarios: {
          findMany: async () => [
            // Socio role + active state → socio, whether or not a socios row exists.
            { id: 'u1', estado_actual: 'activo', usuarios_roles: { roles: { nombre: 'socio' } } },
            { id: 'u2', estado_actual: 'activo', usuarios_roles: { roles: { nombre: 'socio' } } },
            // Socio role but moroso state → moroso (state wins within the role rule).
            { id: 'u3', estado_actual: 'moroso', usuarios_roles: { roles: { nombre: 'socio' } } },
            // Moroso without any current role → still moroso (any role).
            { id: 'u4', estado_actual: 'moroso', usuarios_roles: null },
            // Former socio (socios row may remain) whose current role is no_socio → noSocios.
            { id: 'u5', estado_actual: 'activo', usuarios_roles: { roles: { nombre: 'no_socio' } } },
            // Admin and role-less active users → noSocios (remainder without socio role).
            { id: 'u6', estado_actual: 'activo', usuarios_roles: { roles: { nombre: 'admin' } } },
            { id: 'u7', estado_actual: 'suspendido', usuarios_roles: { roles: { nombre: 'socio' } } },
          ],
        },
      }) as never,
    );
    const respuesta = await service.obtenerEstadisticas({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    });
    assert.deepEqual(respuesta.usuarios, { sociosActivos: 2, noSocios: 3, morosos: 2 });
  });
});

describe('ReportesController.estadisticas (ACT-45)', () => {
  it('delegates to the service and returns its response untouched', async () => {
    const esperada = {
      periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      turnos: {
        total: 0,
        porEstado: { confirmado: 0, iniciado: 0, finalizado: 0, cancelado: 0, no_asistio: 0 },
        porCancha: [],
        porFranja: [],
      },
      usuarios: { sociosActivos: 0, noSocios: 0, morosos: 0 },
    };
    let recibida: unknown;
    const controller = new ReportesController({
      obtenerEstadisticas: async (query: unknown) => {
        recibida = query;
        return esperada;
      },
    } as never);
    const respuesta = await controller.estadisticas({ desde: '2026-09-01', hasta: '2026-09-30' });
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibida, { desde: '2026-09-01', hasta: '2026-09-30' });
  });
});
