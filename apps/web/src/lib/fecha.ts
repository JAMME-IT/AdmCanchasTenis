/**
 * Fechas del calendario de turnos. Todo se calcula sin depender de la zona
 * horaria del host: el club trabaja en ART (UTC-3) y las fechas viajan como
 * `YYYY-MM-DD`, igual que en la API (contrato §5.3).
 */

/** Fecha de hoy en hora del club (ART), como `YYYY-MM-DD`. */
export function hoyART(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
