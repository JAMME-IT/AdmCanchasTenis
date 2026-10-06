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
describe('TarifasService (ACT-42)', () => {
  const prisma = {
    valores_turno: { create: jest.fn(), findFirst: jest.fn() },
    valores_cuota: { create: jest.fn(), findFirst: jest.fn() },
    luz: { findFirst: jest.fn() },
    estados_luz: { findFirst: jest.fn() },
  };

  const service = new TarifasService(
    prisma as unknown as ConstructorParameters<typeof TarifasService>[0],
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('actualizarTarifaTurno (PUT /tarifas/turno, RF-27)', () => {
    it('inserta en valores_turno y devuelve la tarifa vigente insertada', async () => {
      const fechaCambio = new Date('2026-09-01T00:00:00-03:00');
      prisma.valores_turno.create.mockResolvedValue({
        id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
        costo_x_hora: 4500,
        fecha_cambio: fechaCambio,
      });

      const resultado = await service.actualizarTarifaTurno({ costoXHora: 4500 });

      expect(prisma.valores_turno.create).toHaveBeenCalledWith({
        data: { costo_x_hora: 4500 },
      });
      expect(resultado).toEqual({
        id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
        costoXHora: 4500,
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
    });
  });

  describe('actualizarTarifaCuota (PUT /tarifas/cuota, RF-29)', () => {
    it('inserta en valores_cuota y devuelve la tarifa vigente insertada', async () => {
      const fechaCambio = new Date('2026-09-01T00:00:00-03:00');
      prisma.valores_cuota.create.mockResolvedValue({
        id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
        precio: 16000,
        fecha_cambio: fechaCambio,
      });

      const resultado = await service.actualizarTarifaCuota({ precio: 16000 });

      expect(prisma.valores_cuota.create).toHaveBeenCalledWith({
        data: { precio: 16000 },
      });
      expect(resultado).toEqual({
        id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
        precio: 16000,
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
    });
  });

  describe('obtenerVigentes (GET /tarifas, RF-43)', () => {
    it('devuelve null en cada tipo sin historial', async () => {
      prisma.valores_turno.findFirst.mockResolvedValue(null);
      prisma.valores_cuota.findFirst.mockResolvedValue(null);
      prisma.luz.findFirst.mockResolvedValue(null);

      const resultado = await service.obtenerVigentes();

      expect(resultado).toEqual({ turno: null, luz: null, cuota: null });
    });

    it('devuelve la vigente de mayor fecha_cambio <= now() para turno y cuota', async () => {
      prisma.valores_turno.findFirst.mockResolvedValue({
        id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
        costo_x_hora: 4500,
        fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
      });
      prisma.valores_cuota.findFirst.mockResolvedValue({
        id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
        precio: 16000,
        fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
      });
      prisma.luz.findFirst.mockResolvedValue(null);

      const resultado = await service.obtenerVigentes();

      expect(prisma.valores_turno.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fecha_cambio: { lte: expect.any(Date) } },
          orderBy: { fecha_cambio: 'desc' },
        }),
      );
      expect(resultado.turno).toEqual({
        id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
        costoXHora: 4500,
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
      expect(resultado.cuota).toEqual({
        id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
        precio: 16000,
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
      expect(resultado.luz).toBeNull();
    });

    it('devuelve la vigente de turno, luz y cuota cuando existen', async () => {
      prisma.valores_turno.findFirst.mockResolvedValue({
        id: '6426f33f-0a7b-404a-8cd5-1d3e7f19f5d2',
        costo_x_hora: 4500,
        fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
      });
      prisma.valores_cuota.findFirst.mockResolvedValue({
        id: '9f8e7d6c-aaaa-bbbb-cccc-ddddeeeefff0',
        precio: 16000,
        fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
      });
      prisma.luz.findFirst.mockResolvedValue({
        id: 'aabbccdd-1111-2222-3333-444455556666',
        costo_x_hora: 4000,
        franja_horario_inicio: '18:30:00',
        franja_horario_fin: '22:00:00',
        created_at: new Date('2026-08-01T00:00:00-03:00'),
      });
      prisma.estados_luz.findFirst.mockResolvedValue({
        fecha: new Date('2026-09-01T00:00:00-03:00'),
      });

      const resultado = await service.obtenerVigentes();

      expect(prisma.luz.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { created_at: 'desc' } }),
      );
      expect(resultado.luz).toEqual({
        id: 'aabbccdd-1111-2222-3333-444455556666',
        costoXHora: 4000,
        franjaHorarioInicio: '18:30',
        franjaHorarioFin: '22:00',
        fechaCambio: '2026-09-01T00:00:00-03:00',
      });
    });

    it('usa created_at de luz como fechaCambio si no hay historial en estados_luz', async () => {
      prisma.valores_turno.findFirst.mockResolvedValue(null);
      prisma.valores_cuota.findFirst.mockResolvedValue(null);
      prisma.luz.findFirst.mockResolvedValue({
        id: 'aabbccdd-1111-2222-3333-444455556666',
        costo_x_hora: 4000,
        franja_horario_inicio: '18:30',
        franja_horario_fin: '22:00',
        created_at: new Date('2026-08-01T00:00:00-03:00'),
      });
      prisma.estados_luz.findFirst.mockResolvedValue(null);

      const resultado = await service.obtenerVigentes();

      expect(resultado.luz?.fechaCambio).toBe('2026-08-01T00:00:00-03:00');
    });
  });
});