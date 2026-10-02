/** Pure slot-building logic for GET /turnos/disponibilidad (ACT-33, API contract §5.3).
 *
 * This module is intentionally free of NestJS decorators so it can be unit
 * tested without the framework. The service (`turnos.service.ts`) only reads
 * the database and delegates the computation here.
 *
 * Conventions (API contract §1, DB-SCHEMA §1):
 * - Hours are `HH:MM` in the club's local time. Ranges are half-open:
 *   a slot covers `[horaInicio, horaFin)`, so a booking ending exactly when
 *   a slot starts does not block it.
 * - Time values coming from Prisma `@db.Time` columns may arrive as `Date`
 *   (midnight-based) or as strings, depending on the driver: both are accepted.
 */

export interface CanchaSlotInput {
  id: string;
  nroCancha: number;
  /** `canchas.estado_actual`: only `disponible` courts offer bookable slots. */
  estadoActual: string;
}

export interface RangoSlotInput {
  horaInicio: string;
  horaFin: string;
}

export interface TurnoOcupanteInput {
  canchaId: string;
  horaInicio: string;
  horaFin: string;
  /** `turnos.estado_actual` of a non-cancelled booking (e.g. `confirmado`). */
  estadoActual: string;
}

export interface FranjaLuzInput {
  horaInicio: string;
  horaFin: string;
}

export interface SlotDisponibilidad {
  canchaId: string;
  nroCancha: number;
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
  requiereLuz: boolean;
  motivo: string | null;
}

/** Default durations (minutes) when no `tipoTurnoId` is given (contract §5.3). */
export const DURACION_DIA_SEMANA = 60;
export const DURACION_FIN_SEMANA = 90;

/** Weekday (ISO 1-5) → 60 min; weekend (ISO 6-7) → 90 min. */
export function duracionPorDefecto(diaSemanaISO: number): number {
  return diaSemanaISO >= 6 ? DURACION_FIN_SEMANA : DURACION_DIA_SEMANA;
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Strict `YYYY-MM-DD` validation: rejects impossible dates like 2026-02-30. */
export function esFechaValida(fecha: string): boolean {
  if (!FECHA_REGEX.test(fecha)) {
    return false;
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaUTC = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fechaUTC.getUTCFullYear() === anio &&
    fechaUTC.getUTCMonth() === mes - 1 &&
    fechaUTC.getUTCDate() === dia
  );
}

/** ISO-8601 weekday (1 = Monday, 7 = Sunday) for a valid `YYYY-MM-DD` date. */
export function diaSemanaISODeFecha(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const diaJS = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return diaJS === 0 ? 7 : diaJS;
}

/** `Date` (Prisma `@db.Time`) or `"HH:MM[:SS]"` → minutes since midnight. */
export function minutosDeHora(valor: Date | string): number {
  if (typeof valor === 'string') {
    const [horas, minutos = '0'] = valor.split(':');
    return Number(horas) * 60 + Number(minutos);
  }
  return valor.getUTCHours() * 60 + valor.getUTCMinutes();
}

/** Minutes since midnight → `HH:MM`. */
export function formatearHora(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

/** Half-open overlap: `[inicioA, finA)` vs `[inicioB, finB)`. */
export function haySolapamiento(
  inicioA: number,
  finA: number,
  inicioB: number,
  finB: number,
): boolean {
  return inicioA < finB && inicioB < finA;
}

/**
 * Builds every slot of the day: consecutive, non-overlapping slots of
 * `duracionMinutos` fully contained in each `rangos_horario` range, for every
 * court. A slot is unavailable when its court is not `disponible` or when it
 * overlaps a non-cancelled booking; `requiereLuz` is the intersection of the
 * slot with the `luz` lighting range (contract §5.3).
 */
export function construirSlots(args: {
  canchas: CanchaSlotInput[];
  rangos: RangoSlotInput[];
  turnos: TurnoOcupanteInput[];
  duracionMinutos: number;
  luz: FranjaLuzInput | null;
}): SlotDisponibilidad[] {
  const { canchas, rangos, turnos, duracionMinutos, luz } = args;
  const luzInicio = luz ? minutosDeHora(luz.horaInicio) : null;
  const luzFin = luz ? minutosDeHora(luz.horaFin) : null;

  const turnosPorCancha = new Map<string, { inicio: number; fin: number; estado: string }[]>();
  for (const turno of turnos) {
    const lista = turnosPorCancha.get(turno.canchaId) ?? [];
    lista.push({
      inicio: minutosDeHora(turno.horaInicio),
      fin: minutosDeHora(turno.horaFin),
      estado: turno.estadoActual,
    });
    turnosPorCancha.set(turno.canchaId, lista);
  }

  const rangosMinutos = rangos
    .map((rango) => ({ inicio: minutosDeHora(rango.horaInicio), fin: minutosDeHora(rango.horaFin) }))
    .filter((rango) => rango.fin > rango.inicio)
    .sort((a, b) => a.inicio - b.inicio);

  const slots: SlotDisponibilidad[] = [];
  for (const cancha of canchas) {
    const ocupantes = turnosPorCancha.get(cancha.id) ?? [];
    for (const rango of rangosMinutos) {
      for (let inicio = rango.inicio; inicio + duracionMinutos <= rango.fin; inicio += duracionMinutos) {
        const fin = inicio + duracionMinutos;
        const requiereLuz =
          luzInicio !== null && luzFin !== null && haySolapamiento(inicio, fin, luzInicio, luzFin);

        let disponible = true;
        let motivo: string | null = null;
        if (cancha.estadoActual !== 'disponible') {
          disponible = false;
          motivo = 'Cancha no disponible';
        } else {
          const ocupante = ocupantes.find((turno) =>
            haySolapamiento(inicio, fin, turno.inicio, turno.fin),
          );
          if (ocupante) {
            disponible = false;
            motivo = `Turno ${ocupante.estado}`;
          }
        }

        slots.push({
          canchaId: cancha.id,
          nroCancha: cancha.nroCancha,
          horaInicio: formatearHora(inicio),
          horaFin: formatearHora(fin),
          disponible,
          requiereLuz,
          motivo,
        });
      }
    }
  }
  return slots;
}
