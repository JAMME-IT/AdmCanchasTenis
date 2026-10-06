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

/**
 * Decimal (Prisma) o number → number JSON.
 * Prisma Decimal expone `toNumber()`; se prefiere para no depender de la
 * coerción implícita de `Number()` (que no está garantizada en todas las
 * versiones/adapters de Decimal).
 */
function aNumero(valor: unknown): number {
  if (typeof valor === 'number') {
    return valor;
  }
  if (valor !== null && typeof valor === 'object' && typeof (valor as { toNumber?: unknown }).toNumber === 'function') {
    return (valor as { toNumber: () => number }).toNumber();
  }
  return Number(valor);
}

/**
 * Hora `HH:MM` del contrato. Prisma devuelve TIME como "HH:MM:SS[.f]" según adapter.
 */
function aHora(valor: unknown): string {
  return String(valor).slice(0, 5);
}

/**
 * Offset fijo de la zona del club (America/Argentina/Buenos_Aires, UTC-03:00,
 * sin horario de verano). El contrato §1 exige el offset del club en las
 * respuestas, NO el del host: serializar con la TZ del proceso volvería la
 * salida dependiente del entorno de despliegue.
 */
const CLUB_UTC_OFFSET_MINUTES = -180;

/**
 * Timestamp ISO 8601 con el offset fijo del club (contrato §1:
 * `2026-09-01T00:00:00-03:00`, sin milisegundos). Determinista: el mismo
 * instante produce la misma cadena en cualquier host/TZ.
 */
export function formatearFechaCambio(fecha: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const club = new Date(fecha.getTime() + CLUB_UTC_OFFSET_MINUTES * 60_000);
  const local = `${club.getUTCFullYear()}-${pad(club.getUTCMonth() + 1)}-${pad(club.getUTCDate())}`;
  const hora = `${pad(club.getUTCHours())}:${pad(club.getUTCMinutes())}:${pad(club.getUTCSeconds())}`;
  return `${local}T${hora}-03:00`;
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