import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarTipoTurnoDto } from './actualizar-tipo-turno.dto';

/**
 * DTO validation tests for RF-15 (PATCH /config/tipos-turno/:id,
 * docs/API-CONTRATO.md §7.9). The global ValidationPipe (main.ts) turns these
 * validation errors into HTTP 400: `duracionMinutos` must be an integer in
 * 15..240.
 */
async function validar(payload: object) {
  return validate(plainToInstance(ActualizarTipoTurnoDto, payload));
}

describe('ActualizarTipoTurnoDto (RF-15)', () => {
  it('acepta 15 minutos', async () => {
    const errores = await validar({ duracionMinutos: 15 });
    assert.equal(errores.length, 0);
  });

  it('acepta 60 minutos', async () => {
    const errores = await validar({ duracionMinutos: 60 });
    assert.equal(errores.length, 0);
  });

  it('acepta 75 minutos', async () => {
    const errores = await validar({ duracionMinutos: 75 });
    assert.equal(errores.length, 0);
  });

  it('acepta 240 minutos', async () => {
    const errores = await validar({ duracionMinutos: 240 });
    assert.equal(errores.length, 0);
  });

  it('rechaza 14 minutos', async () => {
    const errores = await validar({ duracionMinutos: 14 });
    assert.ok(errores.length > 0);
  });

  it('rechaza 241 minutos', async () => {
    const errores = await validar({ duracionMinutos: 241 });
    assert.ok(errores.length > 0);
  });

  it('rechaza un valor no entero', async () => {
    const errores = await validar({ duracionMinutos: 75.5 });
    assert.ok(errores.length > 0);
  });

  it('rechaza un string numerico', async () => {
    const errores = await validar({ duracionMinutos: '75' });
    assert.ok(errores.length > 0);
  });

  it('rechaza null', async () => {
    const errores = await validar({ duracionMinutos: null });
    assert.ok(errores.length > 0);
  });

  it('rechaza un body sin duracionMinutos', async () => {
    const errores = await validar({});
    assert.ok(errores.length > 0);
  });
});
