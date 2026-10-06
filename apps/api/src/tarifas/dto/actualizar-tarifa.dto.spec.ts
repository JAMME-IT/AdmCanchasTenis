import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarTarifaCuotaDto } from './actualizar-tarifa-cuota.dto';
import { ActualizarTarifaTurnoDto } from './actualizar-tarifa-turno.dto';

/**
 * DTO validation tests. Covers reliability finding R3-005: acceptance criterion 4
 * (400 on invalid/negative values) had zero coverage. The global ValidationPipe
 * (main.ts) turns these validation errors into HTTP 400.
 */
async function validar<T extends object>(clase: new () => T, payload: object) {
  return validate(plainToInstance(clase, payload));
}

describe('ActualizarTarifaTurnoDto (RF-27)', () => {
  it('acepta un monto valido con dos decimales', async () => {
    const errores = await validar(ActualizarTarifaTurnoDto, { costoXHora: 4500.5 });
    expect(errores).toHaveLength(0);
  });

  it('acepta el borde cero', async () => {
    const errores = await validar(ActualizarTarifaTurnoDto, { costoXHora: 0 });
    expect(errores).toHaveLength(0);
  });

  it('rechaza un monto negativo', async () => {
    const errores = await validar(ActualizarTarifaTurnoDto, { costoXHora: -1 });
    expect(errores).toHaveLength(1);
  });

  it('rechaza mas de dos decimales', async () => {
    const errores = await validar(ActualizarTarifaTurnoDto, { costoXHora: 10.999 });
    expect(errores).toHaveLength(1);
  });

  it('rechaza un body sin costoXHora', async () => {
    const errores = await validar(ActualizarTarifaTurnoDto, {});
    expect(errores.length).toBeGreaterThan(0);
  });

  it('rechaza un valor no numerico', async () => {
    const errores = await validar(ActualizarTarifaTurnoDto, { costoXHora: 'mucho' });
    expect(errores.length).toBeGreaterThan(0);
  });
});

describe('ActualizarTarifaCuotaDto (RF-29)', () => {
  it('acepta un precio valido', async () => {
    const errores = await validar(ActualizarTarifaCuotaDto, { precio: 16000 });
    expect(errores).toHaveLength(0);
  });

  it('rechaza un precio negativo', async () => {
    const errores = await validar(ActualizarTarifaCuotaDto, { precio: -100 });
    expect(errores).toHaveLength(1);
  });

  it('rechaza un body sin precio', async () => {
    const errores = await validar(ActualizarTarifaCuotaDto, {});
    expect(errores.length).toBeGreaterThan(0);
  });
});