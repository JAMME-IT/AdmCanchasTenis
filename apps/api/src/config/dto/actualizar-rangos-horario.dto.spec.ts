import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarRangosHorarioDto } from './actualizar-rangos-horario.dto';

/**
 * DTO validation tests for RF-34 (PUT /config/rangos-horario,
 * docs/API-CONTRATO.md §5.6). The global ValidationPipe (main.ts) turns these
 * validation errors into HTTP 400: `rangos` cannot be empty, holds at most 20
 * entries, `nombre` is required, at most 50 chars and free of control
 * characters, `id` is an optional UUID and both hours must match `HH:MM` with
 * a valid 24-hour clock.
 */
async function validar(payload: object) {
  return validate(plainToInstance(ActualizarRangosHorarioDto, payload));
}

describe('ActualizarRangosHorarioDto (RF-34)', () => {
  it('acepta un body valido sin id', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'apertura', horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.equal(errores.length, 0);
  });

  it('acepta un body valido con id', async () => {
    const errores = await validar({
      rangos: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          nombre: 'apertura',
          horaInicio: '08:00',
          horaFin: '22:00',
        },
      ],
    });
    assert.equal(errores.length, 0);
  });

  it('acepta los bordes 00:00 y 23:59', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'apertura', horaInicio: '00:00', horaFin: '23:59' }],
    });
    assert.equal(errores.length, 0);
  });

  it('acepta un nombre de 50 caracteres', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'a'.repeat(50), horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.equal(errores.length, 0);
  });

  it('rechaza una horaInicio con un digito en la hora', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'apertura', horaInicio: '8:00', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza la hora 24:00', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'apertura', horaInicio: '08:00', horaFin: '24:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza los minutos 60', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'apertura', horaInicio: '08:60', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza un body sin horaInicio', async () => {
    const errores = await validar({ rangos: [{ nombre: 'apertura', horaFin: '22:00' }] });
    assert.ok(errores.length > 0);
  });

  it('rechaza un body sin horaFin', async () => {
    const errores = await validar({ rangos: [{ nombre: 'apertura', horaInicio: '08:00' }] });
    assert.ok(errores.length > 0);
  });

  it('rechaza un body sin rangos', async () => {
    const errores = await validar({});
    assert.ok(errores.length > 0);
  });

  it('rechaza un array de rangos vacio', async () => {
    const errores = await validar({ rangos: [] });
    assert.ok(errores.length > 0);
  });

  it('rechaza un nombre vacio', async () => {
    const errores = await validar({
      rangos: [{ nombre: '', horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza un nombre que solo tiene espacios', async () => {
    const errores = await validar({
      rangos: [{ nombre: '   ', horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('recorta los espacios del nombre antes de validar', async () => {
    const dto = plainToInstance(ActualizarRangosHorarioDto, {
      rangos: [{ nombre: '  apertura  ', horaInicio: '08:00', horaFin: '22:00' }],
    });
    const errores = await validate(dto);
    assert.equal(errores.length, 0);
    assert.equal(dto.rangos[0].nombre, 'apertura');
  });

  it('rechaza un nombre que no es string', async () => {
    const errores = await validar({
      rangos: [{ nombre: 123, horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza un nombre de 51 caracteres', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'a'.repeat(51), horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza un id que no es UUID', async () => {
    const errores = await validar({
      rangos: [{ id: 'no-es-uuid', nombre: 'apertura', horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza un nombre con un byte NUL', async () => {
    const errores = await validar({
      rangos: [
        { nombre: 'a' + String.fromCharCode(0) + 'b', horaInicio: '08:00', horaFin: '22:00' },
      ],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza un nombre con un salto de linea', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'apertura\n', horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza un nombre con un tabulador', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'aper\ttura', horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.ok(errores.length > 0);
  });

  it('rechaza un nombre con DEL (U+007F)', async () => {
    const errores = await validar({
      rangos: [
        {
          nombre: 'apertura' + String.fromCharCode(127),
          horaInicio: '08:00',
          horaFin: '22:00',
        },
      ],
    });
    assert.ok(errores.length > 0);
  });

  it('acepta un nombre con acentos, enie y emoji', async () => {
    const errores = await validar({
      rangos: [{ nombre: 'Mañana 🎾', horaInicio: '08:00', horaFin: '22:00' }],
    });
    assert.equal(errores.length, 0);
  });

  it('acepta exactamente 20 rangos', async () => {
    const rangos = Array.from({ length: 20 }, (_, indice) => ({
      nombre: `rango-${indice}`,
      horaInicio: '08:00',
      horaFin: '22:00',
    }));
    const errores = await validar({ rangos });
    assert.equal(errores.length, 0);
  });

  it('rechaza 21 rangos', async () => {
    const rangos = Array.from({ length: 21 }, (_, indice) => ({
      nombre: `rango-${indice}`,
      horaInicio: '08:00',
      horaFin: '22:00',
    }));
    const errores = await validar({ rangos });
    assert.ok(errores.length > 0);
  });
});
