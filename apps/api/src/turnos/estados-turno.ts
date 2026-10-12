/**
 * Turn lifecycle transitions for PATCH /turnos/:id/estado (ACT-36, API contract §5.3).
 *
 * This module is intentionally free of NestJS decorators so it can be unit
 * tested without the framework: the service reads the turno from the database
 * and delegates the transition decision here.
 *
 * The table mirrors the contract exactly: `confirmado` can be started or
 * marked as a no-show, `iniciado` can be finished, and the remaining states
 * are terminal. `cancelado` is NOT a destination here: it is only reachable
 * through POST /turnos/:id/cancelar, which enforces RN-1 and the `motivo`.
 */

/** Full `estado_turno` domain values (DB-SCHEMA §4, `turnos.estado_actual`). */
export const ESTADOS_TURNO = [
  'confirmado',
  'cancelado',
  'iniciado',
  'finalizado',
  'no_asistio',
] as const;

export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

/**
 * Lifecycle transition table (API contract §5.3): current state → allowed
 * destination states. Terminal states (`finalizado`, `no_asistio`,
 * `cancelado`) map to an empty list: no transition is allowed out of them.
 */
export const TRANSICIONES_ESTADO_TURNO: Readonly<Record<EstadoTurno, readonly EstadoTurno[]>> = {
  confirmado: ['iniciado', 'no_asistio'],
  iniciado: ['finalizado'],
  finalizado: [],
  no_asistio: [],
  cancelado: [],
};

/** Whether `actual → destino` is an allowed lifecycle transition (§5.3 table). */
export function transicionPermitida(actual: string, destino: string): boolean {
  return (
    TRANSICIONES_ESTADO_TURNO[actual as EstadoTurno]?.includes(destino as EstadoTurno) ?? false
  );
}

/** Allowed destination states for `actual` (empty for terminal states). */
export function estadosDestinoDe(actual: string): string[] {
  return [...(TRANSICIONES_ESTADO_TURNO[actual as EstadoTurno] ?? [])];
}