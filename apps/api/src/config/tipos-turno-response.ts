/** Raw `tipos_turno` row (Prisma model or test stub). */
export interface TipoTurnoFila {
  id: string;
  duracion_max: number;
}

/** `TipoTurnoResponse` shape (ACT-32, RF-15, camelCase over snake_case). */
export interface TipoTurnoResponse {
  id: string;
  duracionMinutos: number;
}

/**
 * Maps one `tipos_turno` row to its contract shape. `duracionMinutos` is the
 * public name because `GET /turnos/disponibilidad` already exposes that field.
 */
export function toTipoTurnoResponse(fila: TipoTurnoFila): TipoTurnoResponse {
  return {
    id: fila.id,
    duracionMinutos: fila.duracion_max,
  };
}
