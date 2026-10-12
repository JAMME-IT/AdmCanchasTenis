import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ActualizarEstadoTurnoDto } from './dto/actualizar-estado-turno.dto';
import {
  estadosDestinoDe,
  ESTADOS_TURNO,
  transicionPermitida,
  TRANSICIONES_ESTADO_TURNO,
} from './estados-turno';
import { TurnosController } from './turnos.controller';
import { TurnosService } from './turnos.service';

/** `turnos` row fixture (TurnoFila shape) in `confirmado`/`impago` (DB-SCHEMA §4). */
const TURNO_CONFIRMADO = {
  id: 'turno-1',
  usuario_id: 'user-1',
  cancha_id: 'c1',
  tipo_turno_id: 't60',
  valor_turno_id: 'v1',
  fecha: new Date('2026-09-30T12:00:00.000Z'),
  hora_inicio: new Date('1970-01-01T19:00:00.000Z'),
  hora_fin: new Date('1970-01-01T20:00:00.000Z'),
  cantidad_personas: 4,
  cantidad_no_socios: 2,
  costo_turno_ns: 8000,
  requiere_luz: false,
  estado_actual: 'confirmado',
  estado_pago: 'impago',
  created_at: new Date('2026-09-25T14:30:00.000Z'),
  updated_at: new Date('2026-09-25T14:30:00.000Z'),
};

/**
 * Minimal Prisma stub: a `turnos.findUnique` plus a `$transaction` whose tx
 * records every `turnos.update` and `estados_turno.create` argument. The tx
 * methods are ONLY reachable through `$transaction`, so a write outside the
 * single transaction would fail with a TypeError in the test.
 */
function estadoStub(db: { turno?: Record<string, unknown> | null } = {}) {
  const llamadas: {
    update?: Record<string, unknown>;
    create?: Record<string, unknown>;
    transacciones: number;
  } = { transacciones: 0 };
  const tx = {
    turnos: {
      update: async (args: { data: Record<string, unknown> }) => {
        llamadas.update = args.data;
        return { ...TURNO_CONFIRMADO, ...args.data, estado_pago: TURNO_CONFIRMADO.estado_pago };
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
      findUnique: async () => ('turno' in db ? db.turno : TURNO_CONFIRMADO),
    },
    $transaction: async (callback: (t: typeof tx) => Promise<unknown>) => {
      llamadas.transacciones += 1;
      return callback(tx);
    },
    llamadas,
  };
}

describe('estados-turno (ACT-36, tabla de transiciones del contrato §5.3)', () => {
  it('documents the full transition table and the 5-value domain enum', () => {
    assert.deepEqual(ESTADOS_TURNO, ['confirmado', 'cancelado', 'iniciado', 'finalizado', 'no_asistio']);
    assert.deepEqual(TRANSICIONES_ESTADO_TURNO, {
      confirmado: ['iniciado', 'no_asistio'],
      iniciado: ['finalizado'],
      finalizado: [],
      no_asistio: [],
      cancelado: [],
    });
  });

  it('terminal states have no destinations and cancelado is never a destination', () => {
    for (const estado of ['finalizado', 'no_asistio', 'cancelado']) {
      assert.deepEqual(
        estadosDestinoDe(estado),
        [],
        `${estado} es terminal y no deberia tener destinos`,
      );
    }
    for (const actual of ESTADOS_TURNO) {
      assert.ok(
        !transicionPermitida(actual, 'cancelado'),
        `cancelado no deberia ser destino desde ${actual}`,
      );
    }
  });

  it('allows exactly the contract transitions (transicionPermitida)', () => {
    assert.equal(transicionPermitida('confirmado', 'iniciado'), true);
    assert.equal(transicionPermitida('confirmado', 'no_asistio'), true);
    assert.equal(transicionPermitida('iniciado', 'finalizado'), true);
    assert.equal(transicionPermitida('finalizado', 'iniciado'), false);
    assert.equal(transicionPermitida('no_asistio', 'iniciado'), false);
    assert.equal(transicionPermitida('iniciado', 'no_asistio'), false);
    assert.equal(transicionPermitida('confirmado', 'finalizado'), false);
  });

  it('estadosDestinoDe returns a defensive copy and [] for unknown states', () => {
    const destinos = estadosDestinoDe('confirmado');
    destinos.push('cancelado');
    assert.deepEqual(TRANSICIONES_ESTADO_TURNO.confirmado, ['iniciado', 'no_asistio']);
    assert.deepEqual(estadosDestinoDe('fantasma'), []);
    assert.equal(transicionPermitida('fantasma', 'iniciado'), false);
  });
});

describe('TurnosService.cambiarEstado (ACT-36)', () => {
  it('throws 404 when the turno does not exist', async () => {
    const service = new TurnosService(estadoStub({ turno: null }) as never);
    await assert.rejects(
      service.cambiarEstado('turno-1', { estado: 'iniciado', motivo: null }),
      (error: unknown) => error instanceof NotFoundException,
      'un turno inexistente debe responder 404',
    );
  });

  it('throws 422 when the requested estado equals the current one', async () => {
    const service = new TurnosService(estadoStub() as never);
    await assert.rejects(
      service.cambiarEstado('turno-1', { estado: 'confirmado', motivo: null }),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'un destino igual al estado actual debe responder 422',
    );
  });

  it('throws 422 for a transition the table does not allow (finalizado → iniciado)', async () => {
    const service = new TurnosService(
      estadoStub({ turno: { ...TURNO_CONFIRMADO, estado_actual: 'finalizado' } }) as never,
    );
    await assert.rejects(
      service.cambiarEstado('turno-1', { estado: 'iniciado', motivo: null }),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'finalizado es terminal: iniciado debe responder 422',
    );
  });

  it('throws 422 for cancelado as destination with the POST /cancelar hint', async () => {
    const service = new TurnosService(estadoStub() as never);
    const error = await service
      .cambiarEstado('turno-1', { estado: 'cancelado', motivo: 'Lesion' })
      .then(
        () => null,
        (e: unknown) => e,
      );
    assert.ok(error instanceof UnprocessableEntityException, 'cancelado debe responder 422');
    const respuesta = (error as InstanceType<typeof UnprocessableEntityException>).getResponse();
    assert.match(JSON.stringify(respuesta), /cancelar/, 'el mensaje debe citar POST /turnos/:id/cancelar');
  });

  it('applies a valid transition with the combined snapshot in ONE transaction', async () => {
    const stub = estadoStub();
    const service = new TurnosService(stub as never);
    const respuesta = await service.cambiarEstado('turno-1', { estado: 'iniciado', motivo: null });

    assert.equal(respuesta.estadoActual, 'iniciado');
    assert.equal(stub.llamadas.transacciones, 1, 'update y create deben correr en la misma $transaction');
    assert.equal(stub.llamadas.update?.estado_actual, 'iniciado');
    assert.ok(stub.llamadas.update?.updated_at instanceof Date, 'updated_at debe actualizarse (Date)');
    assert.deepEqual(stub.llamadas.create, {
      turno_id: 'turno-1',
      valor_estado: 'iniciado',
      valor_estado_pago: 'impago',
    });
  });

  it('keeps the previous estado_pago in the snapshot even when it is pago', async () => {
    const stub = estadoStub({ turno: { ...TURNO_CONFIRMADO, estado_pago: 'pago' } });
    const service = new TurnosService(stub as never);
    const respuesta = await service.cambiarEstado('turno-1', { estado: 'iniciado', motivo: null });

    assert.equal(respuesta.estadoActual, 'iniciado');
    assert.equal(stub.llamadas.create?.valor_estado_pago, 'pago');
  });

  it('persists motivo on the estados_turno row when provided', async () => {
    const stub = estadoStub();
    const service = new TurnosService(stub as never);
    const respuesta = await service.cambiarEstado('turno-1', {
      estado: 'no_asistio',
      motivo: 'No se presento',
    });

    assert.equal(respuesta.estadoActual, 'no_asistio');
    assert.equal(stub.llamadas.create?.motivo, 'No se presento');
  });
});

describe('ActualizarEstadoTurnoDto (ACT-36)', () => {
  const dtoValido = () => Object.assign(new ActualizarEstadoTurnoDto(), { estado: 'iniciado' });

  it('accepts a valid body and a null motivo', async () => {
    assert.equal(await validate(dtoValido()).then((errores) => errores.length), 0);
    const conMotivoNulo = dtoValido();
    conMotivoNulo.motivo = null;
    assert.equal(await validate(conMotivoNulo).then((errores) => errores.length), 0);
  });

  it('accepts every domain token (cancelado included): the 422 is the service job', async () => {
    for (const estado of ESTADOS_TURNO) {
      const dto = dtoValido();
      (dto as unknown as Record<string, unknown>).estado = estado;
      assert.equal(
        await validate(dto).then((errores) => errores.length),
        0,
        `estado ${estado} debe pasar el pipe (dominio completo, 400 solo fuera del enum)`,
      );
    }
  });

  it('rejects a token outside the domain and bad motivo values', async () => {
    const fueraDeDominio = dtoValido();
    (fueraDeDominio as unknown as Record<string, unknown>).estado = 'entregado';
    assert.ok((await validate(fueraDeDominio)).length > 0, 'estado fuera del enum debe dar 400');

    const motivoVacio = dtoValido();
    motivoVacio.motivo = '';
    assert.ok((await validate(motivoVacio)).length > 0, 'motivo vacio debe dar 400');

    const motivoLargo = dtoValido();
    motivoLargo.motivo = 'x'.repeat(501);
    assert.ok((await validate(motivoLargo)).length > 0, 'motivo mayor a 500 debe dar 400');

    const motivoNumerico = dtoValido();
    (motivoNumerico as unknown as Record<string, unknown>).motivo = 42;
    assert.ok((await validate(motivoNumerico)).length > 0, 'motivo no string debe dar 400');
  });
});

describe('TurnosController.cambiarEstado (ACT-36)', () => {
  it('delegates to the service with (id, dto) and returns its response untouched', async () => {
    const esperada = { id: 'turno-1', estadoActual: 'iniciado' };
    let recibidos: unknown[];
    const controller = new TurnosController({
      cambiarEstado: async (...args: unknown[]) => {
        recibidos = args;
        return esperada;
      },
    } as never);
    const dto = new ActualizarEstadoTurnoDto();
    dto.estado = 'iniciado';
    const respuesta = await controller.cambiarEstado('turno-1', dto);
    assert.deepEqual(respuesta, esperada);
    assert.deepEqual(recibidos!, ['turno-1', dto]);
  });
});