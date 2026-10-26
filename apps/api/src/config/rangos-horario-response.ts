import { formatearHora } from './hora';

/**
 * Response mapper for the rangos horarios endpoints (API contract §5.6, RF-34).
 * Converts `rangos_horario` rows (snake_case, `@db.Time` as `Date`) to the
 * camelCase contract shape with `HH:MM` hours.
 */

/** Raw `rangos_horario` row (Prisma model or test stub). */
export interface RangoHorarioFila {
  id: string;
  nombre: string;
  hora_inicio: Date;
  hora_fin: Date;
}

/** `RangoHorarioResponse` shape (API contract §5.6). */
export interface RangoHorarioResponse {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
}

/** Maps one `rangos_horario` row to its camelCase contract shape. */
export function toRangoHorarioResponse(fila: RangoHorarioFila): RangoHorarioResponse {
  return {
    id: fila.id,
    nombre: fila.nombre,
    horaInicio: formatearHora(fila.hora_inicio),
    horaFin: formatearHora(fila.hora_fin),
  };
}

/**
 * Maps the stored rows to the contract list, ascending by `horaInicio`.
 * `HH:MM` strings compare correctly lexicographically, so the mapper sorts
 * defensively even if the caller's query order changes.
 */
export function toRangosHorarioResponse(filas: RangoHorarioFila[]): RangoHorarioResponse[] {
  return filas
    .map(toRangoHorarioResponse)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.nombre.localeCompare(b.nombre));
}
