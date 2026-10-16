export interface PagoTurnoResponse {
  id: string;
  turnoId: string;
  montoTotalTurno: number;
  fechaPago: string;
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
  lineas: {
    id: string;
    montoTurnoPago: number;
  }[];
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

export function toPagoTurnoResponse(
  pago: {
    id: string;
    turno_id: string;
    monto_total_turno: unknown;
    fecha_pago: Date | string;
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
    lineas_pago_turno: {
      id: string;
      monto_turno_pago: unknown;
    }[];
  },
): PagoTurnoResponse {
  const fecha =
    pago.turnos.fecha instanceof Date
      ? pago.turnos.fecha.toISOString().split('T')[0]
      : String(pago.turnos.fecha).split('T')[0];

  const horaInicio =
    pago.turnos.hora_inicio instanceof Date
      ? formatTime(pago.turnos.hora_inicio)
      : String(pago.turnos.hora_inicio);

  return {
    id: pago.id,
    turnoId: pago.turno_id,
    montoTotalTurno: aNumero(pago.monto_total_turno),
    fechaPago:
      pago.fecha_pago instanceof Date
        ? pago.fecha_pago.toISOString()
        : String(pago.fecha_pago),
    turno: {
      id: pago.turnos.id,
      fecha,
      horaInicio,
      canchaId: pago.turnos.cancha_id,
    },
    usuario: {
      id: pago.turnos.usuarios.id,
      nombre: pago.turnos.usuarios.nombre,
      apellido: pago.turnos.usuarios.apellido,
      numeroSocio: pago.turnos.usuarios.socios?.numero_socio ?? null,
    },
    lineas: pago.lineas_pago_turno.map((l) => ({
      id: l.id,
      montoTurnoPago: aNumero(l.monto_turno_pago),
    })),
  };
}

function formatTime(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
