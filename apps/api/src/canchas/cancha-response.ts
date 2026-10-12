import type { estado_cancha, superficie_cancha } from '../generated/prisma/client';

/** One `estados_cancha` history row in the API contract shape (§5.5 GET /canchas). */
export interface EstadoCanchaResponse {
  valorState: estado_cancha;
  fechaCambio: string;
  motivo: string | null;
}

/** POST/PATCH/GET `Cancha` shape (API contract §5.0/§5.5, camelCase over snake_case). */
export interface CanchaResponse {
  id: string;
  nroCancha: number;
  superficie: superficie_cancha;
  iluminacion: boolean;
  estadoActual: estado_cancha;
  estados?: EstadoCanchaResponse[];
}

/** Raw `canchas` row (Prisma model or test stub); `estados_cancha` only when included. */
export interface CanchaFila {
  id: string;
  nro_cancha: number;
  superficie: superficie_cancha;
  iluminacion: boolean;
  estado_actual: estado_cancha;
  estados_cancha?: EstadoCanchaFila[];
}

/** Raw `estados_cancha` row (Prisma model or test stub). */
export interface EstadoCanchaFila {
  valor_state: estado_cancha;
  fecha_cambio: Date | string;
  motivo: string | null;
}

/**
 * Maps a `canchas` row to the contract shape. `estados` is only present when
 * the row carries the included history (`conEstados=true`), matching §5.5.
 */
export function toCanchaResponse(cancha: CanchaFila): CanchaResponse {
  const response: CanchaResponse = {
    id: cancha.id,
    nroCancha: cancha.nro_cancha,
    superficie: cancha.superficie,
    iluminacion: cancha.iluminacion,
    estadoActual: cancha.estado_actual,
  };
  if (cancha.estados_cancha) {
    response.estados = cancha.estados_cancha.map(toEstadoCanchaResponse);
  }
  return response;
}

/** Maps an `estados_cancha` row to its camelCase contract shape. */
export function toEstadoCanchaResponse(estado: EstadoCanchaFila): EstadoCanchaResponse {
  return {
    valorState: estado.valor_state,
    fechaCambio: new Date(estado.fecha_cambio).toISOString(),
    motivo: estado.motivo,
  };
}
