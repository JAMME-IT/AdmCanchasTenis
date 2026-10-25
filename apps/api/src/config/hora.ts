/**
 * Time helpers for the `rangos_horario` config endpoints (API contract §5.6,
 * RF-34).
 *
 * `rangos_horario.hora_inicio`/`hora_fin` are `@db.Time(6)` columns; Prisma
 * delivers them as `Date` values on the epoch day. Hours in the contract are
 * wall-clock `HH:MM` strings, so this module always serializes with the UTC
 * fields, the same criterion `turnos.service.ts` uses (never the host timezone).
 */

/** Strict 24-hour `HH:MM` (the contract's only accepted serialization). */
export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `HH:MM` → minutes since midnight. Callers validate the format first. */
export function minutosDeHoraTexto(texto: string): number {
  const [horas, minutos] = texto.split(':').map(Number);
  return horas * 60 + minutos;
}

/**
 * `Date` from a `@db.Time(6)` column → `HH:MM`, reading the UTC fields.
 * Prisma returns epoch-based values, so `getUTCHours()`/`getUTCMinutes()` are
 * the only stable reading across hosts and timezones.
 */
export function formatearHora(fecha: Date): string {
  return `${String(fecha.getUTCHours()).padStart(2, '0')}:${String(fecha.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * `HH:MM` → the `Date` Prisma writes into a `@db.Time(6)` column: epoch
 * 1970-01-01 at the given UTC time. Keeping the epoch day and the UTC fields
 * makes the round-trip with `formatearHora` lossless.
 */
export function horaDesdeTexto(texto: string): Date {
  const minutos = minutosDeHoraTexto(texto);
  return new Date(Date.UTC(1970, 0, 1, Math.floor(minutos / 60), minutos % 60));
}
