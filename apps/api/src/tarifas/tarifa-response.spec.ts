import {
  formatearFechaCambio,
  toTarifaLuzResponse,
  toTarifaTurnoResponse,
} from './tarifa-response';

/**
 * Mapper-level tests. Covers reliability finding R3-001 (output must not depend
 * on the host timezone) and R3-007 (Decimal / degenerate TIME handling).
 */
describe('tarifa-response mappers', () => {
  describe('formatearFechaCambio (determinismo, R3-001)', () => {
    it('serializa con el offset fijo del club sin importar la TZ del host', () => {
      // 2026-09-01T03:00:00Z == 2026-09-01T00:00:00-03:00 (hora del club).
      expect(formatearFechaCambio(new Date('2026-09-01T03:00:00Z'))).toBe(
        '2026-09-01T00:00:00-03:00',
      );
      // Medianoche UTC es el día anterior en el club.
      expect(formatearFechaCambio(new Date('2026-09-01T00:00:00Z'))).toBe(
        '2026-08-31T21:00:00-03:00',
      );
    });

    it('no depende de la TZ del proceso: el mismo instante da la misma cadena', () => {
      const instante = new Date(Date.UTC(2026, 8, 1, 3, 0, 0));
      const original = process.env.TZ;
      try {
        process.env.TZ = 'UTC';
        const enUtc = formatearFechaCambio(instante);
        process.env.TZ = 'America/Argentina/Buenos_Aires';
        const enArgentina = formatearFechaCambio(instante);
        expect(enUtc).toBe(enArgentina);
        expect(enUtc).toBe('2026-09-01T00:00:00-03:00');
      } finally {
        if (original === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = original;
        }
      }
    });

    it('no emite milisegundos', () => {
      const salida = formatearFechaCambio(new Date('2026-09-01T00:00:00.456-03:00'));
      expect(salida).toBe('2026-09-01T00:00:00-03:00');
    });
  });

  describe('aNumero via toTarifaTurnoResponse (R3-007)', () => {
    it('convierte un Decimal de Prisma usando toNumber()', () => {
      const decimal = { toNumber: (): number => 4500.5 };
      const resultado = toTarifaTurnoResponse({
        id: 'x',
        costo_x_hora: decimal,
        fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
      });
      expect(resultado.costoXHora).toBe(4500.5);
    });

    it('convierte un number plano tal cual', () => {
      const resultado = toTarifaTurnoResponse({
        id: 'x',
        costo_x_hora: 4000,
        fecha_cambio: new Date('2026-09-01T00:00:00-03:00'),
      });
      expect(resultado.costoXHora).toBe(4000);
    });
  });

  describe('aHora via toTarifaLuzResponse (R3-007)', () => {
    it('recorta HH:MM:SS a HH:MM', () => {
      const resultado = toTarifaLuzResponse(
        {
          id: 'luz',
          costo_x_hora: 4000,
          franja_horario_inicio: '18:30:00',
          franja_horario_fin: '22:00:00',
          created_at: new Date('2026-08-01T00:00:00-03:00'),
        },
        new Date('2026-09-01T00:00:00-03:00'),
      );
      expect(resultado.franjaHorarioInicio).toBe('18:30');
      expect(resultado.franjaHorarioFin).toBe('22:00');
    });

    it('acepta un TIME ya normalizado a HH:MM', () => {
      const resultado = toTarifaLuzResponse(
        {
          id: 'luz',
          costo_x_hora: 4000,
          franja_horario_inicio: '08:00',
          franja_horario_fin: '22:00',
          created_at: new Date('2026-08-01T00:00:00-03:00'),
        },
        new Date('2026-09-01T00:00:00-03:00'),
      );
      expect(resultado.franjaHorarioInicio).toBe('08:00');
    });
  });
});