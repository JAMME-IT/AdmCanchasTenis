import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ActualizarEstadoPagoTurnoDto } from './dto/actualizar-estado-pago-turno.dto';
import { TurnosController } from './turnos.controller';
import { TurnosService } from './turnos.service';

/** `turnos` row fixture in `confirmado`/`impago` state. */
const TURNO_BASE = {
  id: 'turno-1',
  usuario_id: 'user-1',
  cancha_id: 'c1',
  tipo_turno_id: 't60',
  valor_turno_id: 'v1',
  fecha: new Date('2024-01-15T12:00:00.000Z'),
  hora_inicio: new Date('1970-01-01T10:00:00.000Z'),
  hora_fin: new Date('1970-01-01T11:00:00.000Z'),
  cantidad_personas: 2,
  cantidad_no_socios: 0,
  costo_turno_ns: 0,
  requiere_luz: false,
  estado_actual: 'confirmado',
  estado_pago: 'impago',
  created_at: new Date('2024-01-10T10:00:00.000Z'),
  updated_at: new Date('2024-01-10T10:00:00.000Z'),
};

/**
 * Minimal Prisma stub for cambiarEstadoPago tests.
 */
function estadoPagoStub(db: { turno?: Record<string, unknown> | null } = {}) {
  const llamadas: {
    update?: Record<string, unknown>;
    create?: Record<string, unknown>;
    transacciones: number;
  } = { transacciones: 0 };
  
  const tx = {
    turnos: {
      update: async (args: { data: Record<string, unknown> }) => {
        llamadas.update = args.data;
        const base = 'turno' in db ? db.turno : TURNO_BASE;
        return { ...base, ...args.data };
      },
    },
    estados_turno: {
      create: async (args: { data: Record<string, unknown> }) => {
        llamadas.create = args.data;
        return args.data;
      },
    },
  };

  return {
    turnos: {
      findUnique: async () => ('turno' in db ? db.turno : TURNO_BASE),
    },
    $transaction: async (callback: (t: typeof tx) => Promise<unknown>) => {
      llamadas.transacciones += 1;
      return callback(tx);
    },
    llamadas,
  };
}

describe('TurnosService.cambiarEstadoPago (ACT-54)', () => {
  it('debería actualizar el estado de pago de impago a pago', async () => {
    const prisma = estadoPagoStub();
    const service = new TurnosService(prisma as any);

    const dto: ActualizarEstadoPagoTurnoDto = { estadoPago: 'pago' };
    const result = await service.cambiarEstadoPago('turno-1', dto);

    assert.equal(result.estadoPago, 'pago');
  });

  it('debería actualizar el estado de pago de pago a impago', async () => {
    const turnoPagado = { ...TURNO_BASE, estado_pago: 'pago' };
    const prisma = estadoPagoStub({ turno: turnoPagado });
    const service = new TurnosService(prisma as any);

    const dto: ActualizarEstadoPagoTurnoDto = { estadoPago: 'impago' };
    const result = await service.cambiarEstadoPago('turno-1', dto);

    assert.equal(result.estadoPago, 'impago');
  });

  it('debería lanzar NotFoundException si el turno no existe', async () => {
    const prisma = estadoPagoStub({ turno: null });
    const service = new TurnosService(prisma as any);

    const dto: ActualizarEstadoPagoTurnoDto = { estadoPago: 'pago' };
    await assert.rejects(async () => service.cambiarEstadoPago('turno-inexistente', dto), NotFoundException);
  });

  it('debería lanzar UnprocessableEntityException si el estado es igual al actual', async () => {
    const prisma = estadoPagoStub();
    const service = new TurnosService(prisma as any);

    const dto: ActualizarEstadoPagoTurnoDto = { estadoPago: 'impago' };
    await assert.rejects(
      async () => service.cambiarEstadoPago('turno-1', dto),
      UnprocessableEntityException,
    );
  });

  it('debería insertar la transición en estados_turno con el snapshot combinado', async () => {
    const prisma = estadoPagoStub();
    const service = new TurnosService(prisma as any);

    const dto: ActualizarEstadoPagoTurnoDto = { estadoPago: 'pago' };
    await service.cambiarEstadoPago('turno-1', dto);

    assert.equal(prisma.llamadas.transacciones, 1);
    assert.ok(prisma.llamadas.update, 'debería haber llamado a turnos.update');
    assert.equal(prisma.llamadas.update.estado_pago, 'pago');
    assert.ok(prisma.llamadas.update.updated_at instanceof Date, 'updated_at debería ser una Date');
    assert.deepEqual(prisma.llamadas.create, {
      turno_id: 'turno-1',
      valor_estado: 'confirmado',
      valor_estado_pago: 'pago',
    });
  });
});

describe('ActualizarEstadoPagoTurnoDto (ACT-54)', () => {
  it('debería aceptar un estado de pago válido', async () => {
    const dto = new ActualizarEstadoPagoTurnoDto();
    dto.estadoPago = 'pago';

    const errors = await validate(dto);
    assert.equal(errors.length, 0);
  });

  it('debería aceptar impago como estado válido', async () => {
    const dto = new ActualizarEstadoPagoTurnoDto();
    dto.estadoPago = 'impago';

    const errors = await validate(dto);
    assert.equal(errors.length, 0);
  });

  it('debería rechazar un estado de pago inválido', async () => {
    const dto = new ActualizarEstadoPagoTurnoDto();
    (dto as any).estadoPago = 'invalido';

    const errors = await validate(dto);
    assert.equal(errors.length > 0, true);
  });
});

describe('TurnosController.cambiarEstadoPago (ACT-54)', () => {
  it('debería delegar en el service con (id, dto) y devolver su respuesta', async () => {
    const service = {
      cambiarEstadoPago: async (id: string, dto: ActualizarEstadoPagoTurnoDto) => ({
        id,
        usuarioId: 'user-1',
        canchaId: 'c1',
        fecha: '2024-01-15',
        horaInicio: '10:00',
        horaFin: '11:00',
        estadoActual: 'confirmado',
        estadoPago: dto.estadoPago,
        requiereLuz: false,
      }),
    };
    const controller = new TurnosController(service as any);

    const dto: ActualizarEstadoPagoTurnoDto = { estadoPago: 'pago' };
    const result = await controller.cambiarEstadoPago('turno-1', dto);

    assert.equal(result.id, 'turno-1');
    assert.equal(result.estadoPago, 'pago');
  });
});
