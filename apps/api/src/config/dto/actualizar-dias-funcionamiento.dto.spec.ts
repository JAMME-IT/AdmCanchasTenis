import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarDiasFuncionamientoDto } from './actualizar-dias-funcionamiento.dto';

/**
 * DTO validation tests for RF-35 (PUT /config/dias-funcionamiento,
 * docs/API-CONTRATO.md §5.6). The global ValidationPipe (main.ts) turns these
 * validation errors into HTTP 400: `diaSemana` must be an integer 1..7 and
 * `habilitado` must be a boolean.
 */
async function validar(payload: object) {
  return validate(plainToInstance(ActualizarDiasFuncionamientoDto, payload));
}

describe('ActualizarDiasFuncionamientoDto (RF-35)', () => {
  it('acepta un body valido', async () => {
    const errores = await validar({
      dias: [
        { diaSemana: 1, habilitado: true },
        { diaSemana: 7, habilitado: false },
      ],
    });
    assert.equal(errores.length, 0);
  });

  it('acepta los bordes 1 y 7', async () => {
    const errores = await validar({
      dias: [
        { diaSemana: 1, habilitado: false },
        { diaSemana: 7, habilitado: true },
      ],
    });
    assert.equal(errores.length, 0);
  });

  it('rechaza diaSemana 0', async () => {
    const errores = await validar({ dias: [{ diaSemana: 0, habilitado: true }] });
    assert.ok(errores.length > 0);
  });

  it('rechaza diaSemana 8', async () => {
    const errores = await validar({ dias: [{ diaSemana: 8, habilitado: true }] });
    assert.ok(errores.length > 0);
  });

  it('rechaza un diaSemana no entero', async () => {
    const errores = await validar({ dias: [{ diaSemana: 1.5, habilitado: true }] });
    assert.ok(errores.length > 0);
  });

  it('rechaza un habilitado no booleano', async () => {
    const errores = await validar({ dias: [{ diaSemana: 1, habilitado: 'si' }] });
    assert.ok(errores.length > 0);
  });

  it('rechaza un body sin dias', async () => {
    const errores = await validar({});
    assert.ok(errores.length > 0);
  });

  it('rechaza un array de dias vacio', async () => {
    const errores = await validar({ dias: [] });
    assert.ok(errores.length > 0);
  });

  it('rechaza un dia sin campos', async () => {
    const errores = await validar({ dias: [{}] });
    assert.ok(errores.length > 0);
  });
});
