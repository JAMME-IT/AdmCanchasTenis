import { instanteDeInicioEnArgentina, UNA_HORA_MS } from './fecha-turno';
import { toTurnoResponse, type TurnoFila, type TurnoResponse } from './turno-response';

/** `turnos` row with the `canchas` relation included as `{ id, nro_cancha }`. */
export interface TurnoConCanchaFila extends TurnoFila {
  canchas: { id: string; nro_cancha: number };
}

/** Expanded court (`cancha: { id, nroCancha }`, API contract §5.3). */
export interface CanchaResumenResponse {
  id: string;
  nroCancha: number;
}

/** `Turno` plus the expanded court, shared by GET /turnos/mios[/historial]. */
export interface TurnoConCanchaResponse extends TurnoResponse {
  cancha: CanchaResumenResponse;
}

/** GET /turnos/mios item: the expanded booking plus the RN-1 `puedeCancelar`. */
export interface MiTurnoResponse extends TurnoConCanchaResponse {
  puedeCancelar: boolean;
}

/** Maps a booking row (court included) to the contract shape with `cancha`. */
export function toTurnoConCanchaResponse(fila: TurnoConCanchaFila): TurnoConCanchaResponse {
  return {
    ...toTurnoResponse(fila),
    cancha: { id: fila.canchas.id, nroCancha: fila.canchas.nro_cancha },
  };
}

/**
 * RN-1 (API contract §5.3 GET /turnos/mios): cancellation stays open while
 * `ahora <= fecha+horaInicio - 1h`, i.e. the start instant in Argentina time
 * is at least one hour ahead of the reference clock. Same formula used by
 * `cancelar` (ACT-35). `ahora` is injected so tests can freeze the clock.
 */
export function toMiTurnoResponse(
  fila: TurnoConCanchaFila,
  ahora: Date = new Date(),
): MiTurnoResponse {
  const inicioMs = instanteDeInicioEnArgentina(fila.fecha, fila.hora_inicio);
  return {
    ...toTurnoConCanchaResponse(fila),
    puedeCancelar: ahora.getTime() + UNA_HORA_MS <= inicioMs,
  };
}
