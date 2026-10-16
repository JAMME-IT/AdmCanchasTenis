import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PagosTurnoService } from './pagos-turno.service';
import type { CrearPagoTurnoDto } from './dto/crear-pago-turno.dto';

interface PagoDb {
  turno?: Record<string, unknown> | null;
  turnosConPagos?: boolean;
  turnoCancelado?: boolean;
  montoTotalInvalido?: boolean;
  lineasNoSuman?: boolean;
  fechaFutura?: boolean;
}

const TURNO_BASE = {
  id: 'turno-1',
  estado_actual: 'confirmado',
  estado_pago: 'impago',
  usuarios: {
    id: 'user-1',
    nombre: 'Juan',
    apellido: 'Pérez',
    socios: null,
  },
  fecha: new Date('2024-01-15'),
  hora_inicio: new Date('2024-01-01T10:00:00Z'),
  cancha_id: 'cancha-1',
};

function pagoStub(db: PagoDb = {}) {
  const pagoCreado = {
    id: 'pago-1',
    turno_id: 'turno-1',
    monto_total_turno: 1000,
    fecha_pago: new Date(),
  };

  const tx = {
    pagos_turno: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'pago-1',
        ...data,
      }),
      findUnique: async () => ({
        id: 'pago-1',
        turno_id: 'turno-1',
        monto_total_turno: 1000,
        fecha_pago: new Date(),
        turnos: db.turno ?? TURNO_BASE,
        lineas_pago_turno: [],
      }),
    },
    lineas_pago_turno: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => data,
    },
    turnos: {
      findUnique: async ({ include }: { include?: Record<string, unknown> }) => {
        const turno = db.turno ?? TURNO_BASE;
        if (db.turnosConPagos) {
          return {
            ...turno,
            pagos_turno: [{ id: 'pago-existente' }],
          };
        }
        return {
          ...turno,
          pagos_turno: [],
        };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => ({
        ...(db.turno ?? TURNO_BASE),
        ...data,
      }),
    },
    estados_turno: {
      create: async () => ({}),
    },
  };

  return {
    turnos: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        if (db.turno === null) return null;
        const turno = db.turno ?? TURNO_BASE;
        if (db.turnosConPagos) {
          return {
            ...turno,
            pagos_turno: [{ id: 'pago-existente' }],
          };
        }
        return {
          ...turno,
          pagos_turno: [],
        };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => ({
        ...(db.turno ?? TURNO_BASE),
        ...data,
      }),
    },
    pagos_turno: tx.pagos_turno,
    lineas_pago_turno: tx.lineas_pago_turno,
    estados_turno: tx.estados_turno,
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
  };
}

describe('PagosTurnoService - registrarPago', () => {
  it('debería registrar un pago exitosamente', async () => {
    const prisma = pagoStub();
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
    };

    const result = await service.registrarPago(dto);

    assert.equal(result.id, 'pago-1');
    assert.equal(result.turnoId, 'turno-1');
    assert.equal(result.montoTotalTurno, 1000);
    assert.equal(result.usuario.nombre, 'Juan');
    assert.equal(result.usuario.apellido, 'Pérez');
  });

  it('debería registrar un pago con líneas correctamente', async () => {
    const prisma = pagoStub();
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
      lineas: [
        { montoTurnoPago: 500 },
        { montoTurnoPago: 500 },
      ],
    };

    const result = await service.registrarPago(dto);

    assert.equal(result.id, 'pago-1');
    assert.equal(result.lineas.length, 0); // El stub no devuelve líneas
  });

  it('debería lanzar BadRequestException si montoTotalTurno es menor o igual a 0', async () => {
    const prisma = pagoStub();
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 0,
    };

    await assert.rejects(async () => service.registrarPago(dto), BadRequestException);
  });

  it('debería lanzar BadRequestException si las líneas no suman el monto total', async () => {
    const prisma = pagoStub();
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
      lineas: [
        { montoTurnoPago: 500 },
        { montoTurnoPago: 400 },
      ],
    };

    await assert.rejects(async () => service.registrarPago(dto), BadRequestException);
  });

  it('debería lanzar BadRequestException si una línea tiene monto menor o igual a 0', async () => {
    const prisma = pagoStub();
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
      lineas: [
        { montoTurnoPago: 500 },
        { montoTurnoPago: 0 },
      ],
    };

    await assert.rejects(async () => service.registrarPago(dto), BadRequestException);
  });

  it('debería lanzar BadRequestException si fechaPago es futura', async () => {
    const prisma = pagoStub();
    const service = new PagosTurnoService(prisma as any);

    const fechaFutura = new Date();
    fechaFutura.setDate(fechaFutura.getDate() + 1);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
      fechaPago: fechaFutura.toISOString(),
    };

    await assert.rejects(async () => service.registrarPago(dto), BadRequestException);
  });

  it('debería lanzar NotFoundException si el turno no existe', async () => {
    const prisma = pagoStub({ turno: null });
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-inexistente',
      montoTotalTurno: 1000,
    };

    await assert.rejects(async () => service.registrarPago(dto), NotFoundException);
  });

  it('debería lanzar UnprocessableEntityException si el turno está cancelado', async () => {
    const prisma = pagoStub({
      turno: { ...TURNO_BASE, estado_actual: 'cancelado' },
    });
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
    };

    await assert.rejects(async () => service.registrarPago(dto), UnprocessableEntityException);
  });

  it('debería lanzar ConflictException si ya existe un pago para el turno', async () => {
    const prisma = pagoStub({ turnosConPagos: true });
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
    };

    await assert.rejects(async () => service.registrarPago(dto), ConflictException);
  });

  it('debería usar fechaPago personalizada si se proporciona', async () => {
    const prisma = pagoStub();
    const service = new PagosTurnoService(prisma as any);

    const fechaPersonalizada = new Date('2024-01-10T15:30:00Z');
    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
      fechaPago: fechaPersonalizada.toISOString(),
    };

    const result = await service.registrarPago(dto);

    assert.equal(result.id, 'pago-1');
  });

  it('debería devolver numeroSocio null si el usuario no es socio', async () => {
    const prisma = pagoStub();
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
    };

    const result = await service.registrarPago(dto);

    assert.equal(result.usuario.numeroSocio, null);
  });

  it('debería devolver numeroSocio si el usuario es socio', async () => {
    const turnoConSocio = {
      ...TURNO_BASE,
      usuarios: {
        id: 'user-2',
        nombre: 'María',
        apellido: 'González',
        socios: { numero_socio: '123' },
      },
    };
    const prisma = pagoStub({ turno: turnoConSocio });
    const service = new PagosTurnoService(prisma as any);

    const dto: CrearPagoTurnoDto = {
      turnoId: 'turno-1',
      montoTotalTurno: 1000,
    };

    const result = await service.registrarPago(dto);

    assert.equal(result.usuario.numeroSocio, '123');
  });
});

describe('PagosTurnoService - listar', () => {
  const pagosMock = [
    {
      id: 'pago-1',
      turno_id: 'turno-1',
      monto_total_turno: 1000,
      fecha_pago: new Date('2024-01-15T10:00:00Z'),
      turnos: {
        id: 'turno-1',
        estado_actual: 'confirmado',
        estado_pago: 'pago',
        usuarios: {
          id: 'user-1',
          nombre: 'Juan',
          apellido: 'Pérez',
          socios: null,
        },
        fecha: new Date('2024-01-15'),
        hora_inicio: new Date('2024-01-01T10:00:00Z'),
        cancha_id: 'cancha-1',
      },
      lineas_pago_turno: [],
    },
    {
      id: 'pago-2',
      turno_id: 'turno-2',
      monto_total_turno: 2000,
      fecha_pago: new Date('2024-01-16T15:00:00Z'),
      turnos: {
        id: 'turno-2',
        estado_actual: 'confirmado',
        estado_pago: 'pago',
        usuarios: {
          id: 'user-2',
          nombre: 'María',
          apellido: 'González',
          socios: { numero_socio: '456' },
        },
        fecha: new Date('2024-01-16'),
        hora_inicio: new Date('2024-01-01T15:00:00Z'),
        cancha_id: 'cancha-2',
      },
      lineas_pago_turno: [],
    },
  ];

  function listarStub(pagos: any[] = pagosMock) {
    return {
      pagos_turno: {
        findMany: async () => pagos,
      },
    };
  }

  it('debería listar todos los pagos sin filtros', async () => {
    const prisma = listarStub();
    const service = new PagosTurnoService(prisma as any);

    const result = await service.listar({});

    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'pago-1');
    assert.equal(result[1].id, 'pago-2');
  });

  it('debería filtrar por turnoId', async () => {
    const prisma = listarStub([pagosMock[0]]);
    const service = new PagosTurnoService(prisma as any);

    const result = await service.listar({ turnoId: 'turno-1' });

    assert.equal(result.length, 1);
    assert.equal(result[0].turnoId, 'turno-1');
  });

  it('debería filtrar por usuarioId', async () => {
    const prisma = listarStub([pagosMock[1]]);
    const service = new PagosTurnoService(prisma as any);

    const result = await service.listar({ usuarioId: 'user-2' });

    assert.equal(result.length, 1);
    assert.equal(result[0].usuario.id, 'user-2');
  });

  it('debería filtrar por rango de fechas (desde/hasta)', async () => {
    const prisma = listarStub([pagosMock[0]]);
    const service = new PagosTurnoService(prisma as any);

    const result = await service.listar({
      desde: '2024-01-15T00:00:00Z',
      hasta: '2024-01-15T23:59:59Z',
    });

    assert.equal(result.length, 1);
  });

  it('debería lanzar BadRequestException si desde es inválido', async () => {
    const prisma = listarStub();
    const service = new PagosTurnoService(prisma as any);

    await assert.rejects(
      async () => service.listar({ desde: 'fecha-invalida' }),
      BadRequestException,
    );
  });

  it('debería lanzar BadRequestException si hasta es inválido', async () => {
    const prisma = listarStub();
    const service = new PagosTurnoService(prisma as any);

    await assert.rejects(
      async () => service.listar({ hasta: 'no-es-fecha' }),
      BadRequestException,
    );
  });

  it('debería aplicar múltiples filtros combinados', async () => {
    const prisma = listarStub([pagosMock[0]]);
    const service = new PagosTurnoService(prisma as any);

    const result = await service.listar({
      turnoId: 'turno-1',
      usuarioId: 'user-1',
      desde: '2024-01-01T00:00:00Z',
      hasta: '2024-12-31T23:59:59Z',
    });

    assert.equal(result.length, 1);
  });

  it('debería devolver array vacío si no hay pagos', async () => {
    const prisma = listarStub([]);
    const service = new PagosTurnoService(prisma as any);

    const result = await service.listar({});

    assert.equal(result.length, 0);
  });
});
