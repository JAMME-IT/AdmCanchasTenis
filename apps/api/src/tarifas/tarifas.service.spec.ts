import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TarifasService } from './tarifas.service';

/**
 * First unit test for ticket ACT-42 (Tarifas de turno y cuota).
 * Contract under test (docs/API-CONTRATO.md §5.8):
 *  - PUT /tarifas/turno  (RF-27): insert append-only in valores_turno; response is the
 *    vigente tariff { id, costoXHora, fechaCambio } (highest fecha_cambio <= now()).
 *  - PUT /tarifas/cuota  (RF-29): insert append-only in valores_cuota; response is the
 *    vigente tariff { id, precio, fechaCambio }.
 *  - GET /tarifas        (RF-43): { turno, luz, cuota }, each vigente or null when the
 *    type has no history yet (confirmed decision: null, never 404).
 */

/** Minimal Prisma stub: only the tarifa methods the service uses. */
function prismaStub(
  overrides: Record<string, Record<string, (args?: unknown) => Promise<unknown>>> = {},
) {
  return {
    valores_turno: {
      create: async () => null,
      findFirst: async () => null,
      ...overrides.valores_turno,
    },
    valores_cuota: {
      create: async () => null,
      findFirst: async () => null,
      ...overrides.valores_cuota,
    },
    luz: { findFirst: async () => null, ...overrides.luz },
    estados_luz: { findFirst: async () => null, ...overrides.estados_luz },
  };
}

describe('TarifasService (ACT-42)', () => {
  describe('actualizarTarifaTurno (PUT /tarifas/turno, RF-27)', () => {
    it('inserta en valores_turno y devuelve la tarifa vigente insertada', async () => {
      const fechaCambio = new Date('2026-09-01T00:00:00-03:00');
      const llamadasCreate: unknown[] = [];
      const service = new TarifasService(
        prismaStub({
          valores_turno: {
            create: async (args?: unknown) => {
              llamadasCreate.push(args);
              return {
                id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
                costo_x_hora: 4500,
                fecha_cambio: fechaCambio,
              };
            },
          },
        }) as never,
      );

      const resultado = await service.actualizarTarifaTurno({ costoXHora: 4500 });

      assert.deepEqual(llamadasCreate[0], {
        data: { costo_x_hora: 4500 },
      });
      assert.deepEqual(resultado, {
        id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
        costoXHora: 4500,
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
    });
  });

  describe('actualizarTarifaCuota (PUT /tarifas/cuota, RF-29)', () => {
    it('inserta en valores_cuota y devuelve la tarifa vigente insertada', async () => {
      const fechaCambio = new Date('2026-09-01T00:00:00-03:00');
      const llamadasCreate: unknown[] = [];
      const service = new TarifasService(
        prismaStub({
          valores_cuota: {
            create: async (args?: unknown) => {
              llamadasCreate.push(args);
              return {
                id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
                precio: 16000,
                fecha_cambio: fechaCambio,
              };
            },
          },
        }) as never,
      );

      const resultado = await service.actualizarTarifaCuota({ precio: 16000 });

      assert.deepEqual(llamadasCreate[0], {
        data: { precio: 16000 },
      });
      assert.deepEqual(resultado, {
        id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
        precio: 16000,
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
    });
  });

  describe('obtenerVigentes (GET /tarifas, RF-43)', () => {
    it('devuelve null en cada tipo sin historial', async () => {
      const service = new TarifasService(prismaStub() as never);

      const resultado = await service.obtenerVigentes();

      assert.deepEqual(resultado, { turno: null, luz: null, cuota: null });
    });

    it('devuelve la vigente de mayor fecha_cambio <= now() para turno y cuota', async () => {
      const llamadasTurno: unknown[] = [];
      const service = new TarifasService(
        prismaStub({
          valores_turno: {
            findFirst: async (args?: unknown) => {
              llamadasTurno.push(args);
              return {
                id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
                costo_x_hora: 4500,
                fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
              };
            },
          },
          valores_cuota: {
            findFirst: async () => ({
              id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
              precio: 16000,
              fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
            }),
          },
          luz: { findFirst: async () => null },
        }) as never,
      );

      const resultado = await service.obtenerVigentes();

      const llamadaTurno = llamadasTurno[0] as {
        where: { fecha_cambio: { lte: unknown } };
        orderBy: unknown;
      };
      assert.deepEqual(Object.keys(llamadaTurno.where), ['fecha_cambio']);
      assert.deepEqual(Object.keys(llamadaTurno.where.fecha_cambio), ['lte']);
      assert.ok(llamadaTurno.where.fecha_cambio.lte instanceof Date);
      assert.deepEqual(llamadaTurno.orderBy, { fecha_cambio: 'desc' });
      assert.deepEqual(resultado.turno, {
        id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
        costoXHora: 4500,
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
      assert.deepEqual(resultado.cuota, {
        id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
        precio: 16000,
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
      assert.strictEqual(resultado.luz, null);
    });

    it('devuelve la vigente de turno, luz y cuota cuando existen', async () => {
      const llamadasLuz: unknown[] = [];
      const service = new TarifasService(
        prismaStub({
          valores_turno: {
            findFirst: async () => ({
              id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
              costo_x_hora: 4500,
              fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
            }),
          },
          valores_cuota: {
            findFirst: async () => ({
              id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
              precio: 16000,
              fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
            }),
          },
          luz: {
            findFirst: async (args?: unknown) => {
              llamadasLuz.push(args);
              return {
                id: 'aabbccdd-1111-2222-3333-444455556666',
                costo_x_hora: 4000,
                franja_horario_inicio: '18:30:00',
                franja_horario_fin: '22:00:00',
                created_at: new Date('2026-08-01T00:00:00-03:00'),
              };
            },
          },
          estados_luz: {
            findFirst: async () => ({
              fecha: new Date('2026-09-01T00:00:00-03:00'),
            }),
          },
        }) as never,
      );

      const resultado = await service.obtenerVigentes();

      const llamadaLuz = llamadasLuz[0] as { orderBy: unknown };
      assert.deepEqual(llamadaLuz.orderBy, { created_at: 'desc' });
      assert.deepEqual(resultado.luz, {
        id: 'aabbccdd-1111-2222-3333-444455556666',
        costoXHora: 4000,
        franjaHorarioInicio: '18:30',
        franjaHorarioFin: '22:00',
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
    });

    it('usa created_at de luz como fechaCambio si no hay historial en estados_luz', async () => {
      const service = new TarifasService(
        prismaStub({
          valores_turno: { findFirst: async () => null },
          valores_cuota: { findFirst: async () => null },
          luz: {
            findFirst: async () => ({
              id: 'aabbccdd-1111-2222-3333-444455556666',
              costo_x_hora: 4000,
              franja_horario_inicio: '18:30',
              franja_horario_fin: '22:00',
              created_at: new Date('2026-08-01T00:00:00-03:00'),
            }),
          },
          estados_luz: { findFirst: async () => null },
        }) as never,
      );

      const resultado = await service.obtenerVigentes();

      assert.strictEqual(resultado.luz?.fechaCambio, '2026-08-01T00:00:00-03:00');
    });
  });
});
