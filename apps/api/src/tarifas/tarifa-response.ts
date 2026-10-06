/**
 * Response mappers for the tarifas endpoints (API contract §5.8).
 * Converts Prisma rows (snake_case, Decimal, Date) to the JSON contract
 * (camelCase, number money, timestamp with local offset).
 */

export interface TarifaTurnoResponse {
  id: string;
  costoXHora: number;
  fechaCambio: string;
}

export interface TarifaCuotaResponse {
  id: string;
  precio: number;
  fechaCambio: string;
}

export interface TarifaLuzResponse {
  id: string;
  costoXHora: number;
  franjaHorarioInicio: string;
  franjaHorarioFin: string;
  fechaCambio: string;
}

export interface TarifasResponse {
  turno: TarifaTurnoResponse | null;
  luz: TarifaLuzResponse | null;
  cuota: TarifaCuotaResponse | null;
}

interface FilaValoresTurno {
  id: string;
  costo_x_hora: unknown;
  fecha_cambio: Date;
}

interface FilaValoresCuota {
  id: string;
  precio: unknown;
  fecha_cambio: Date;
}

interface FilaLuz {
  id: string;
  costo_x_hora: unknown;
  franja_horario_inicio: unknown;
  franja_horario_fin: unknown;
  created_at: Date;
}

/** Decimal (Prisma) o number → number JSON. */
function aNumero(valor: unknown): number {
  return typeof valor === 'number' ? valor : Number(valor);
}

/**
 * Hora `HH:MM` del contrato. Prisma devuelve TIME como "HH:MM:SS[.f]" según adapter.
 */
function aHora(valor: unknown): string {
  return String(valor).slice(0, 5);
}

/**
 * Timestamp ISO 8601 con offset local del servidor (contrato §1:
 * `2026-09-01T00:00:00-03:00`, sin milisegundos). NO se usa toISOString()
 * porque produce `.000Z` y pierde el offset local del club.
 */
export function formatearFechaCambio(fecha: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const offsetMin = -fecha.getTimezoneOffset();
  const signo = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const offset = `${signo}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  const local = `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
  const hora = `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())}`;
  return `${local}T${hora}${offset}`;
}

export function toTarifaTurnoResponse(fila: FilaValoresTurno): TarifaTurnoResponse {
  return {
    id: fila.id,
    costoXHora: aNumero(fila.costo_x_hora),
    fechaCambio: formatearFechaCambio(fila.fecha_cambio),
  };
}

export function toTarifaCuotaResponse(fila: FilaValoresCuota): TarifaCuotaResponse {
  return {
    id: fila.id,
    precio: aNumero(fila.precio),
    fechaCambio: formatearFechaCambio(fila.fecha_cambio),
  };
}

export function toTarifaLuzResponse(
  fila: FilaLuz,
  fechaCambio: Date,
): TarifaLuzResponse {
  return {
    id: fila.id,
    costoXHora: aNumero(fila.costo_x_hora),
    franjaHorarioInicio: aHora(fila.franja_horario_inicio),
    franjaHorarioFin: aHora(fila.franja_horario_fin),
    fechaCambio: formatearFechaCambio(fechaCambio),
  };
}