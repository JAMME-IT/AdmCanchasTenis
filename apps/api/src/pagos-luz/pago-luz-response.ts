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

export interface PagoLuzListItemResponse extends PagoLuzResponse {
  turno: {
    id: string;
    fecha: string;
    horaInicio: string;
    canchaId: string;
  };
  usuario: {
    id: string;
    nombre: string;
    apellido: string;
    numeroSocio: string | null;
  };
}

/** `@db.Time` Date anchored at the Unix epoch (UTC) → `HH:MM`. */
function formatearHora(valor: Date | string): string {
  if (!(valor instanceof Date)) {
    return String(valor).slice(0, 5);
  }
  const horas = String(valor.getUTCHours()).padStart(2, '0');
  const minutos = String(valor.getUTCMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

export function toPagoLuzListItemResponse(pago: {
  id_pago_luz: string;
  turno_id: string;
  monto_total_luz: unknown;
  fecha_pago: Date | string;
  created_at: Date | string;
  turnos: {
    id: string;
    fecha: Date | string;
    hora_inicio: Date | string;
    cancha_id: string;
    usuarios: {
      id: string;
      nombre: string;
      apellido: string;
      socios: { numero_socio: string } | null;
    };
  };
}): PagoLuzListItemResponse {
  const fecha =
    pago.turnos.fecha instanceof Date
      ? pago.turnos.fecha.toISOString().split('T')[0]
      : String(pago.turnos.fecha).split('T')[0];

  return {
    ...toPagoLuzResponse(pago),
    turno: {
      id: pago.turnos.id,
      fecha,
      horaInicio: formatearHora(pago.turnos.hora_inicio),
      canchaId: pago.turnos.cancha_id,
    },
    usuario: {
      id: pago.turnos.usuarios.id,
      nombre: pago.turnos.usuarios.nombre,
      apellido: pago.turnos.usuarios.apellido,
      numeroSocio: pago.turnos.usuarios.socios?.numero_socio ?? null,
    },
  };
}