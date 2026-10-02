import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CrearTurnoDto } from './dto/crear-turno.dto';
import { TurnosController } from './turnos.controller';
import { calcularCostoTurnoNs, TurnosService } from './turnos.service';

interface ReservaDb {
  cancha?: Record<string, unknown> | null;
  tipo?: Record<string, unknown> | null;
  dia?: Record<string, unknown> | null;
  rangos?: Record<string, unknown>[];
  tarifa?: Record<string, unknown> | null;
  luz?: Record<string, unknown> | null;
  socio?: Record<string, unknown> | null;
  cuotasAdeudadas?: number;
  turnosDelDia?: number;
  turnosVigentes?: number;
  ocupantes?: Record<string, unknown>[];
  fallaUnica?: boolean;
}

const CANCHA = { id: 'c1', estado_actual: 'disponible', iluminacion: true };
const TIPO_60 = { id: 't60', duracion_max: 60 };
const TARIFA = { id: 'v1', costo_x_hora: 4000 };
const LUZ = { costo_x_hora: 4000 };

/** Minimal Prisma stub: config reads plus a $transaction running against a tx stub. */
function reservaStub(db: ReservaDb = {}) {
  // Explicit nulls mean "missing row": check key presence instead of `??`.
  const tx = {
    socios: {
      findUnique: async () => db.socio ?? null,
    },
    cuotas: {
      count: async () => db.cuotasAdeudadas ?? 0,
    },
    turnos: {
      // RN-2 counts by day (`not: cancelado`); RN-9 counts active (`in: [...]`).
      count: async (args: { where?: { estado_actual?: { in?: unknown[] } } }) =>
        args.where?.estado_actual?.in ? (db.turnosVigentes ?? 0) : (db.turnosDelDia ?? 0),
      findMany: async () => db.ocupantes ?? [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (db.fallaUnica) {
          throw { code: 'P2002' };
        }
        const ahora = new Date();
        return {
          id: 'turno-1',
          ...data,
          estado_actual: 'confirmado',
          estado_pago: 'impago',
          created_at: ahora,
          updated_at: ahora,
        };
      },
    },
    estados_turno: { create: async () => ({}) },
  };
  return {
    canchas: { findUnique: async () => ('cancha' in db ? db.cancha : CANCHA) },
    tipos_turno: { findUnique: async () => ('tipo' in db ? db.tipo : TIPO_60) },
    dias_funcionamiento: { findUnique: async () => db.dia ?? { habilitado: true } },
    rangos_horario: {
      findMany: async () => db.rangos ?? [{ hora_inicio: '08:00', hora_fin: '22:00' }],
    },
    valores_turno: { findFirst: async () => ('tarifa' in db ? db.tarifa : TARIFA) },
    luz: { findFirst: async () => ('luz' in db ? db.luz : LUZ) },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
  };
}

function authDe(rol: 'admin' | 'socio' | 'no_socio') {
  return { clerkUserId: 'clerk-1', sessionId: null, usuario: { id: 'user-1' }, rol };
}

/** Local `YYYY-MM-DD` n days from today (mirrors the service RN-11 clock). */
function masDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function dtoBase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    canchaId: 'c1',
    fecha: masDias(1),
    horaInicio: '19:00',
    tipoTurnoId: 't60',
    cantidadPersonas: 4,
    cantidadNoSocios: 2,
    requiereLuz: false,
    ...overrides,
  };
}

describe('TurnosService.reservar (ACT-34)', () => {
  it('creates the turno with frozen rate, computed cost and notices', async () => {
    const service = new TurnosService(reservaStub() as never);
    const respuesta = await service.reservar(authDe('socio') as never, dtoBase());
    assert.equal(respuesta.estadoActual, 'confirmado');
    assert.equal(respuesta.estadoPago, 'impago');
    assert.equal(respuesta.horaInicio, '19:00');
    assert.equal(respuesta.horaFin, '20:00');
    assert.equal(respuesta.valorTurnoId, 'v1');
    assert.equal(respuesta.costoTurnoNs, 8000);
    assert.equal(respuesta.cargoLuzCompartido, null);
    assert.equal(respuesta.avisos.length, 1);
    assert.match(respuesta.avisos[0] as string, /Recordatorio/);
  });

  it('returns the shared lighting charge and both notices when requiereLuz', async () => {
    const service = new TurnosService(reservaStub() as never);
    const respuesta = await service.reservar(
      authDe('socio') as never,
      dtoBase({ requiereLuz: true, cantidadNoSocios: 0 }),
    );
    assert.equal(respuesta.cargoLuzCompartido, 4000);
    assert.equal(respuesta.avisos.length, 1);
    assert.match(respuesta.avisos[0] as string, /luz/);
  });

  it('rejects overlapping bookings with 409, covering 60 vs 90 min', async () => {
    const service = new TurnosService(
      reservaStub({ ocupantes: [{ hora_inicio: '19:00', hora_fin: '20:30' }] }) as never,
    );
    await assert.rejects(
      service.reservar(authDe('socio') as never, dtoBase({ horaInicio: '20:00' })),
      (error: unknown) => error instanceof ConflictException,
    );
  });

  it('allows a booking starting exactly when another ends', async () => {
    const service = new TurnosService(
      reservaStub({ ocupantes: [{ hora_inicio: '18:00', hora_fin: '19:00' }] }) as never,
    );
    const respuesta = await service.reservar(authDe('socio') as never, dtoBase());
    assert.equal(respuesta.horaInicio, '19:00');
  });

  it('enforces RN-2 (422) but exempts admin (RN-10)', async () => {
    const lleno = new TurnosService(reservaStub({ turnosDelDia: 2 }) as never);
    await assert.rejects(
      lleno.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await assert.rejects(
      lleno.reservar(authDe('no_socio') as never, dtoBase()),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    const comoAdmin = await lleno.reservar(authDe('admin') as never, dtoBase());
    assert.equal(comoAdmin.estadoActual, 'confirmado');
  });

  it('enforces RN-9: socio with 2+ adeudada keeps a single active booking', async () => {
    const base = { socio: { id: 's1' }, cuotasAdeudadas: 2, turnosVigentes: 1 };
    const service = new TurnosService(reservaStub(base) as never);
    await assert.rejects(
      service.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const conCupo = new TurnosService(reservaStub({ ...base, turnosVigentes: 0 }) as never);
    const respuesta = await conCupo.reservar(authDe('socio') as never, dtoBase());
    assert.equal(respuesta.estadoActual, 'confirmado');

    const alDia = new TurnosService(
      reservaStub({ ...base, cuotasAdeudadas: 1, turnosVigentes: 5 }) as never,
    );
    const sinTope = await alDia.reservar(authDe('socio') as never, dtoBase());
    assert.equal(sinTope.estadoActual, 'confirmado');
  });

  it('enforces RN-11: at most 1 day ahead, never in the past (422)', async () => {
    const service = new TurnosService(reservaStub() as never);
    await assert.rejects(
      service.reservar(authDe('socio') as never, dtoBase({ fecha: masDias(2) })),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await assert.rejects(
      service.reservar(authDe('socio') as never, dtoBase({ fecha: masDias(-1) })),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    const hoy = await service.reservar(authDe('socio') as never, dtoBase({ fecha: masDias(0) }));
    assert.equal(hoy.fecha, masDias(0));
  });

  it('rejects light requested on a court without lighting with 422', async () => {
    const service = new TurnosService(
      reservaStub({ cancha: { ...CANCHA, iluminacion: false } }) as never,
    );
    await assert.rejects(
      service.reservar(authDe('socio') as never, dtoBase({ requiereLuz: true })),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
  });

  it('maps the unique race on (cancha, fecha, hora) to 409', async () => {
    const service = new TurnosService(reservaStub({ fallaUnica: true }) as never);
    await assert.rejects(
      service.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof ConflictException,
    );
  });

  it('rejects a missing current rate with 400', async () => {
    const service = new TurnosService(reservaStub({ tarifa: null }) as never);
    await assert.rejects(
      service.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  it('rejects unknown court/type with 404 and business blocks with 422', async () => {
    const sinCancha = new TurnosService(reservaStub({ cancha: null }) as never);
    await assert.rejects(
      sinCancha.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof NotFoundException,
    );
    const sinTipo = new TurnosService(reservaStub({ tipo: null }) as never);
    await assert.rejects(
      sinTipo.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof NotFoundException,
    );
    const diaCerrado = new TurnosService(reservaStub({ dia: { habilitado: false } }) as never);
    await assert.rejects(
      diaCerrado.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    const fueraDeFranja = new TurnosService(
      reservaStub({ rangos: [{ hora_inicio: '08:00', hora_fin: '09:00' }] }) as never,
    );
    await assert.rejects(
      fueraDeFranja.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    const canchaOcupada = new TurnosService(
      reservaStub({ cancha: { ...CANCHA, estado_actual: 'en_mantenimiento' } }) as never,
    );
    await assert.rejects(
      canchaOcupada.reservar(authDe('socio') as never, dtoBase()),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
  });

  it('requires a registered user (RN-6)', async () => {
    const service = new TurnosService(reservaStub() as never);
    await assert.rejects(
      service.reservar(
        { clerkUserId: 'clerk-1', sessionId: null, usuario: null, rol: null } as never,
        dtoBase(),
      ),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });

  it('prices 90-min bookings with the duration factor', async () => {
    const service = new TurnosService(
      reservaStub({ tipo: { id: 't90', duracion_max: 90 } }) as never,
    );
    const respuesta = await service.reservar(
      authDe('socio') as never,
      dtoBase({ tipoTurnoId: 't90' }),
    );
    assert.equal(respuesta.horaFin, '20:30');
    assert.equal(respuesta.costoTurnoNs, 12000);
  });
});

describe('calcularCostoTurnoNs (ACT-34)', () => {
  it('applies cantidadNoSocios x tarifa x (duracion / 60)', () => {
    assert.equal(calcularCostoTurnoNs(2, 4000, 60), 8000);
    assert.equal(calcularCostoTurnoNs(2, 4000, 90), 12000);
    assert.equal(calcularCostoTurnoNs(0, 4000, 60), 0);
    assert.equal(calcularCostoTurnoNs(1, 3333.33, 90), 5000);
  });
});

describe('CrearTurnoDto (ACT-34)', () => {
  const valido = () =>
    Object.assign(new CrearTurnoDto(), {
      canchaId: '8f14e45f-ea2b-4c3d-9a1b-2c3d4e5f6a7b',
      fecha: '2026-09-30',
      horaInicio: '19:00',
      tipoTurnoId: '9f8e7d6c-1a2b-4b3c-8d4d-ddddeeeeffff',
      cantidadPersonas: 4,
      cantidadNoSocios: 2,
      requiereLuz: true,
    });

  it('accepts a valid booking body', async () => {
    assert.equal(await validate(valido()).then((errores) => errores.length), 0);
  });

  it('rejects no-socios above personas, bad formats and non-boolean luz', async () => {
    const cruzado = valido();
    cruzado.cantidadNoSocios = 5;
    assert.ok((await validate(cruzado)).length > 0);

    const malaFecha = valido();
    malaFecha.fecha = '30/09/2026';
    assert.ok((await validate(malaFecha)).length > 0);

    const malaHora = valido();
    malaHora.horaInicio = '25:00';
    assert.ok((await validate(malaHora)).length > 0);

    const malUuid = valido();
    (malUuid as unknown as Record<string, unknown>).canchaId = 'no-uuid';
    assert.ok((await validate(malUuid)).length > 0);
  });
});

describe('TurnosController.reservar (ACT-34)', () => {
  it('delegates to the service with auth and body', async () => {
    const esperada = { id: 'turno-1', avisos: [] };
    let recibidos: unknown[];
    const controller = new TurnosController({
      reservar: async (...args: unknown[]) => {
        recibidos = args;
        return esperada;
      },
    } as never);
    const auth = authDe('socio');
    const dto = dtoBase();
    const respuesta = await controller.reservar(auth as never, dto as never);
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibidos!, [auth, dto]);
  });
});
