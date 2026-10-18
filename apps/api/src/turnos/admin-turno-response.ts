import { toTurnoResponse, type TurnoFila, type TurnoResponse } from './turno-response';

/** `turnos` row with `usuarios` and `canchas` relations included. */
export interface TurnoAdminFila extends TurnoFila {
  usuarios: { id: string; nombre: string; apellido: string };
  canchas: { id: string; nro_cancha: number };
}

/** User summary for admin listing (API contract §5.3). */
export interface UsuarioResumenResponse {
  id: string;
  nombre: string;
  apellido: string;
}

/** Court summary for admin listing (API contract §5.3). */
export interface CanchaResumenAdminResponse {
  id: string;
  nroCancha: number;
}

/** `Turno` plus expanded user and court for admin (ACT-37, RF-36/RF-37/RF-38). */
export interface TurnoAdminResponse extends TurnoResponse {
  usuario: UsuarioResumenResponse;
  cancha: CanchaResumenAdminResponse;
}

/** Maps an admin booking row (user + court included) to the contract shape. */
export function toTurnoAdminResponse(fila: TurnoAdminFila): TurnoAdminResponse {
  return {
    ...toTurnoResponse(fila),
    usuario: {
      id: fila.usuarios.id,
      nombre: fila.usuarios.nombre,
      apellido: fila.usuarios.apellido,
    },
    cancha: { id: fila.canchas.id, nroCancha: fila.canchas.nro_cancha },
  };
}
