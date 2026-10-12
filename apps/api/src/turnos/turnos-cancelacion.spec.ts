import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CancelarTurnoDto } from './dto/cancelar-turno.dto';
import { TurnosController } from './turnos.controller';
import { instanteDeInicioEnArgentina, TurnosService } from './turnos.service';

/**
 * Turno confirmado con fecha futura fija (2030-01-15): con el reloj real la
 * cancelacion siempre queda > 1 h antes del inicio (RN-1 no corta estos casos).
 */
const TURNO_CONFIRMADO = {
  id: 'turno-1',
  usuario_id: 'user-1',
  cancha_id: 'c1',
  tipo_turno_id: 't60',
  valor_turno_id: 'v1',
  fecha: '2030-01-15',
  hora_inicio: '19:00',
  hora_fin: '20:00',
  cantidad_personas: 4,
  cantidad_no_socios: 0,
  costo_turno_ns: 0,
  requiere_luz: false,
  estado_actual: 'confirmado',
  estado_pago: 'impago',
  created_at: new Date('2030-01-10T12:00:00Z'),
  updated_at: new Date('2030-01-10T12:00:00Z'),
};

function authDe(rol: 'admin' | 'socio' | 'no_socio') {
  return { clerkUserId: 'clerk-1', sessionId: null, usuario: { id: 'user-1' }, rol };
}

const dto = (overrides: Partial<Record<string, unknown>> = {}) =>
  Object.assign(new CancelarTurnoDto(), { motivo: 'Lesion', ...overrides });

/**
 * Stub minimo de Prisma: `$transaction` corre contra un `tx` con `turnos` y
 * `estados_turno`; el historial se captura en `estados[]` (patron de
 * cuotas-pagos.spec.ts) y el update del cache en `actualizado()`.
 */
function cancelacionStub(db: { turno?: Record<string, unknown> | null } = {}) {
  const existe = !('turno' in db) || db.turno !== null;
  const turnoRow = ('turno' in db ? db.turno : TURNO_CONFIRMADO) as Record<string, unknown> | null;
  const estados: Record<string, unknown>[] = [];
  let actualizado: Record<string, unknown> | null = null;
  const tx = {
    turnos: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        actualizado = { ...turnoRow, ...data };
        return actualizado;
      },
    },
    estados_turno: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        estados.push(data);
        return data;
      },
    },
  };
  return {
    prisma: {
      turnos: { findUnique: async () => (!existe ? null : turnoRow) },
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    },
    estados,
    actualizado: () => actualizado,
  };
}

describe('TurnosService.cancelar (ACT-35)', () => {
  it('cancela el turno del dueno, registra el historial y devuelve estadoActual = cancelado', async () => {
    const { prisma, estados, actualizado } = cancelacionStub();
    const service = new TurnosService(prisma as never);
    const respuesta = await service.cancelar(authDe('socio') as never, 'turno-1', dto());
    assert.equal(respuesta.estadoActual, 'cancelado');
    assert.equal(respuesta.id, 'turno-1');
    assert.equal(actualizado()!.estado_actual, 'cancelado');
    assert.deepEqual(estados[0], {
      turno_id: 'turno-1',
      valor_estado: 'cancelado',
      valor_estado_pago: 'impago',
      motivo: 'Lesion',
    });
  });

  it('permite que un admin cancele el turno de otro usuario', async () => {
    const { prisma, estados } = cancelacionStub({ turno: { ...TURNO_CONFIRMADO, usuario_id: 'otro-user' } });
    const service = new TurnosService(prisma as never);
    const respuesta = await service.cancelar(authDe('admin') as never, 'turno-1', dto());
    assert.equal(respuesta.estadoActual, 'cancelado');
    assert.equal(estados[0].valor_estado, 'cancelado');
    assert.equal(estados[0].motivo, 'Lesion');
  });

  it('lanza 404 si el turno no existe', async () => {
    const { prisma } = cancelacionStub({ turno: null });
    const service = new TurnosService(prisma as never);
    await assert.rejects(
      service.cancelar(authDe('socio') as never, 'no-existe', dto()),
      (error: unknown) => error instanceof NotFoundException,
    );
  });

  it('lanza 403 si el turno es de otro usuario y el caller no es admin', async () => {
    const { prisma } = cancelacionStub({ turno: { ...TURNO_CONFIRMADO, usuario_id: 'otro-user' } });
    const service = new TurnosService(prisma as never);
    await assert.rejects(
      service.cancelar(authDe('socio') as never, 'turno-1', dto()),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });

  it('lanza 409 si el turno ya no esta en estado confirmado', async () => {
    const { prisma } = cancelacionStub({ turno: { ...TURNO_CONFIRMADO, estado_actual: 'iniciado' } });
    const service = new TurnosService(prisma as never);
    await assert.rejects(
      service.cancelar(authDe('socio') as never, 'turno-1', dto()),
      (error: unknown) => error instanceof ConflictException,
    );
  });

  it('exige un usuario registrado (RN-6)', async () => {
    const { prisma } = cancelacionStub();
    const service = new TurnosService(prisma as never);
    await assert.rejects(
      service.cancelar(
        { clerkUserId: 'clerk-1', sessionId: null, usuario: null, rol: null } as never,
        'turno-1',
        dto(),
      ),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });
});

describe('TurnosService.cancelar RN-1 (limite de 1 hora, ART UTC-3 fijo)', () => {
  const RealDate = Date;

  /** Congela `new Date()` / `Date.now()` en un instante fijo (servidor UTC). */
  function fijarReloj(isoAhora: string): void {
    const fijo = new RealDate(isoAhora).getTime();
    class FechaFija extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fijo);
        } else {
          super(...(args as []));
        }
      }
      static now(): number {
        return fijo;
      }
    }
    (globalThis as Record<string, unknown>).Date = FechaFija;
  }

  function restaurarReloj(): void {
    (globalThis as Record<string, unknown>).Date = RealDate;
  }

  // inicio = 2026-10-10 19:00 ART = 2026-10-10T22:00:00Z (compuesto por el helper).
  const TURNO_LIMITE = { ...TURNO_CONFIRMADO, fecha: '2026-10-10', hora_inicio: '19:00' };

  it('permite cancelar exactamente 60 min antes del inicio', async () => {
    fijarReloj('2026-10-10T21:00:00.000Z');
    try {
      const { prisma, estados } = cancelacionStub({ turno: TURNO_LIMITE });
      const service = new TurnosService(prisma as never);
      const respuesta = await service.cancelar(authDe('socio') as never, 'turno-1', dto());
      assert.equal(respuesta.estadoActual, 'cancelado');
      assert.equal(estados[0].valor_estado, 'cancelado');
    } finally {
      restaurarReloj();
    }
  });

  it('lanza 422 si faltan 59 min para el inicio (RN-1)', async () => {
    fijarReloj('2026-10-10T21:01:00.000Z');
    try {
      const { prisma } = cancelacionStub({ turno: TURNO_LIMITE });
      const service = new TurnosService(prisma as never);
      await assert.rejects(
        service.cancelar(authDe('socio') as never, 'turno-1', dto()),
        (error: unknown) => error instanceof UnprocessableEntityException,
      );
    } finally {
      restaurarReloj();
    }
  });

  it('permite cancelar con mas de 1 h de anticipacion', async () => {
    fijarReloj('2026-10-10T20:00:00.000Z');
    try {
      const { prisma } = cancelacionStub({ turno: TURNO_LIMITE });
      const service = new TurnosService(prisma as never);
      const respuesta = await service.cancelar(authDe('socio') as never, 'turno-1', dto());
      assert.equal(respuesta.estadoActual, 'cancelado');
    } finally {
      restaurarReloj();
    }
  });
});

describe('instanteDeInicioEnArgentina (ART UTC-3 fijo)', () => {
  it('compone fecha + hora local como instante UTC-3', () => {
    assert.equal(
      instanteDeInicioEnArgentina('2026-10-10', '19:00'),
      Date.parse('2026-10-10T22:00:00.000Z'),
    );
    assert.equal(
      instanteDeInicioEnArgentina('2026-10-10', '19:30'),
      Date.parse('2026-10-10T22:30:00.000Z'),
    );
  });

  it('acepta un Date de @db.Time y un Date de @db.Date', () => {
    assert.equal(
      instanteDeInicioEnArgentina(
        new Date('2026-10-10T12:00:00Z'),
        new Date('1970-01-01T19:00:00Z'),
      ),
      Date.parse('2026-10-10T22:00:00.000Z'),
    );
  });
});

describe('CancelarTurnoDto (ACT-35)', () => {
  it('acepta un motivo valido (1-500 caracteres)', async () => {
    assert.equal((await validate(dto())).length, 0);
    assert.equal((await validate(dto({ motivo: 'a'.repeat(500) }))).length, 0);
  });

  it('rechaza motivo vacio o ausente', async () => {
    assert.ok((await validate(dto({ motivo: '' }))).length > 0);
    assert.ok((await validate(new CancelarTurnoDto())).length > 0);
  });

  it('rechaza motivo de mas de 500 caracteres o que no es texto', async () => {
    assert.ok((await validate(dto({ motivo: 'a'.repeat(501) }))).length > 0);
    assert.ok((await validate(dto({ motivo: 42 }))).length > 0);
  });
});

describe('TurnosController.cancelar (ACT-35)', () => {
  it('delega en el service con auth, id y body', async () => {
    const esperada = { id: 'turno-1', estadoActual: 'cancelado' };
    let recibidos: unknown[];
    const controller = new TurnosController({
      cancelar: async (...args: unknown[]) => {
        recibidos = args;
        return esperada;
      },
    } as never);
    const auth = authDe('socio');
    const body = dto();
    const respuesta = await controller.cancelar('turno-1', auth as never, body as never);
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibidos!, [auth, 'turno-1', body]);
  });
});