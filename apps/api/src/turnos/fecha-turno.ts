/** Pure Argentina-time (ART) helpers shared across the turnos modules.
 *
 * This module is the single source of truth for the club's business-day time
 * logic: Argentina time is a fixed UTC-3 offset with no DST, so the instant is
 * shifted and read through UTC getters instead of relying on ICU/timezone data.
 *
 * It is intentionally free of NestJS decorators so the pure modules
 * (`mis-turno-response.ts`) can use it without depending on the service
 * (`turnos.service.ts`), which re-exports this surface for its importers.
 */

import { minutosDeHora } from './disponibilidad-slots';

/**
 * Project rule: ALL business-day logic uses Argentina time
 * (America/Argentina/Buenos_Aires, fixed UTC-3, no DST). Shifting the instant
 * back 3 h and reading UTC getters yields the ART calendar date without
 * ICU/timezone data. A server-local `new Date()` is wrong here: on a UTC
 * host the local date flips at 21:00 ART, moving the RN-11 window off by one.
 */
export const ARGENTINA_UTC_OFFSET_MS = 3 * 3600 * 1000;

/** Instant shifted so UTC getters read the Argentina (UTC-3) calendar date. */
export function hoyEnArgentina(ahora = new Date()): Date {
  return new Date(ahora.getTime() - ARGENTINA_UTC_OFFSET_MS);
}

/**
 * Instante (epoch ms) de inicio del turno compuesto en hora local del club
 * (ART, UTC-3 fijo, sin DST): `fecha` es `YYYY-MM-DD` y `horaInicio` es
 * `HH:MM` o un `Date` de `@db.Time` (RN-1, ACT-35).
 */
export function instanteDeInicioEnArgentina(fecha: Date | string, horaInicio: string | Date): number {
  const [anio, mes, dia] = (typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10))
    .split('-')
    .map(Number);
  const minutos = minutosDeHora(horaInicio);
  return (
    Date.UTC(anio, mes - 1, dia, Math.floor(minutos / 60), minutos % 60) +
    ARGENTINA_UTC_OFFSET_MS
  );
}

/**
 * RN-1: cancelacion permitida hasta 1 hora antes del inicio del turno.
 * Exported so the pure `mis-turno-response` mapper can compute `puedeCancelar`
 * without duplicating the margin.
 */
export const UNA_HORA_MS = 60 * 60 * 1000;
