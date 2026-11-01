export interface PagoLuzResponse {
  id: string;
  turnoId: string;
  montoTotalLuz: number;
  fechaPago: string;
  createdAt: string;
}

/**
 * Decimal (Prisma) o number → number JSON.
 * Prisma Decimal expone `toNumber()`; se prefiere para no depender de la
 * coerción implícita de `Number()`.
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
 * Offset fijo de la zona del club (America/Argentina/Buenos_Aires, UTC-03:00,
 * sin horario de verano). El contrato §1 exige el offset del club, no el del
 * host: la salida debe ser determinista en cualquier entorno.
 */
const CLUB_UTC_OFFSET_MINUTES = -180;

function formatearTimestamp(fecha: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const club = new Date(fecha.getTime() + CLUB_UTC_OFFSET_MINUTES * 60_000);
  const dia = `${club.getUTCFullYear()}-${pad(club.getUTCMonth() + 1)}-${pad(club.getUTCDate())}`;
  const hora = `${pad(club.getUTCHours())}:${pad(club.getUTCMinutes())}:${pad(club.getUTCSeconds())}`;
  return `${dia}T${hora}-03:00`;
}

export function toPagoLuzResponse(pago: {
  id_pago_luz: string;
  turno_id: string;
  monto_total_luz: unknown;
  fecha_pago: Date | string;
  created_at: Date | string;
}): PagoLuzResponse {
  return {
    id: pago.id_pago_luz,
    turnoId: pago.turno_id,
    montoTotalLuz: aNumero(pago.monto_total_luz),
    fechaPago:
      pago.fecha_pago instanceof Date
        ? formatearTimestamp(pago.fecha_pago)
        : String(pago.fecha_pago),
    createdAt:
      pago.created_at instanceof Date
        ? formatearTimestamp(pago.created_at)
        : String(pago.created_at),
  };
}