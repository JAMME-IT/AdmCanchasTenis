/** GET /reportes/financiero response shape (API contract §5.10, RF-45). */

import type { PeriodoEstadisticas } from './estadisticas-response';

export interface IngresosFinanciero {
  pagosTurno: number;
  pagosLuz: number;
  cuotasCobradas: number;
  total: number;
}

export interface CuotasFinanciero {
  emitidas: number;
  montoEmitido: number;
  pagadas: number;
  parciales: number;
  adeudadas: number;
}

export interface UsoCanchasFinanciero {
  turnosTotal: number;
  horasOcupadas: number;
  ocupacionPromedio: number;
}

export interface FinancieroResponse {
  periodo: PeriodoEstadisticas;
  ingresos: IngresosFinanciero;
  cuotas: CuotasFinanciero;
  usoCanchas: UsoCanchasFinanciero;
}
