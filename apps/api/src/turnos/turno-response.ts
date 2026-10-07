import { formatearHora, minutosDeHora } from './disponibilidad-slots';

/** POST /turnos `Turno` shape (API contract §5.0, camelCase over snake_case). */
export interface TurnoResponse {
  id: string;
  usuarioId: string;
  canchaId: string;
  tipoTurnoId: string;
  valorTurnoId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cantidadPersonas: number;
  cantidadNoSocios: number;
  costoTurnoNs: number;
  requiereLuz: boolean;
  estadoActual: string;
  estadoPago: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /turnos response (API contract §5.3): the created `Turno` plus the
 * shared lighting charge (`luz.costoXHora` when `requiereLuz`, else `null`)
 * and the user-facing notices (RF-13, CU04).
 */
export interface ReservarTurnoResponse extends TurnoResponse {
  cargoLuzCompartido: number | null;
  avisos: string[];
}

/** Raw `turnos` row shape (Prisma model or test stub). */
export interface TurnoFila {
  id: string;
  usuario_id: string;
  cancha_id: string;
  tipo_turno_id: string;
  valor_turno_id: string;
  fecha: Date | string;
  hora_inicio: Date | string;
  hora_fin: Date | string;
  cantidad_personas: number;
  cantidad_no_socios: number;
  costo_turno_ns: number | { toString(): string };
  requiere_luz: boolean;
  estado_actual: string;
  estado_pago: string;
  created_at: Date | string;
  updated_at: Date | string;
}

/** Maps a `turnos` row to the contract shape (amounts as numbers, ISO timestamps). */
export function toTurnoResponse(turno: TurnoFila): TurnoResponse {
  return {
    id: turno.id,
    usuarioId: turno.usuario_id,
    canchaId: turno.cancha_id,
    tipoTurnoId: turno.tipo_turno_id,
    valorTurnoId: turno.valor_turno_id,
    fecha: formatearFecha(turno.fecha),
    horaInicio: formatearHora(minutosDeHora(turno.hora_inicio)),
    horaFin: formatearHora(minutosDeHora(turno.hora_fin)),
    cantidadPersonas: turno.cantidad_personas,
    cantidadNoSocios: turno.cantidad_no_socios,
    costoTurnoNs: Number(turno.costo_turno_ns),
    requiereLuz: turno.requiere_luz,
    estadoActual: turno.estado_actual,
    estadoPago: turno.estado_pago,
    createdAt: new Date(turno.created_at).toISOString(),
    updatedAt: new Date(turno.updated_at).toISOString(),
  };
}

/** `YYYY-MM-DD` out of a `@db.Date` value (stored noon UTC, so the UTC part is stable). */
function formatearFecha(valor: Date | string): string {
  if (typeof valor === 'string') {
    return valor.slice(0, 10);
  }
  return valor.toISOString().slice(0, 10);
}
