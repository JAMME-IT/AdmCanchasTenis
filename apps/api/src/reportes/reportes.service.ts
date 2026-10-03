import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  esFechaValida,
  formatearHora,
  minutosDeHora,
} from '../turnos/disponibilidad-slots';
import type { ConsultarEstadisticasDto } from './dto/consultar-estadisticas.dto';
import type {
  EstadisticasResponse,
  PeriodoEstadisticas,
  PorEstadoTurnos,
} from './estadisticas-response';
import type { FinancieroResponse } from './financiero-response';

/** Club timezone for the default period (UTC-3 year-round, no DST). */
const ZONA_CLUB = 'America/Argentina/Buenos_Aires';

/** Daily opening hours assumed when no `rangos_horario` rows exist (F6: 08–22). */
const HORAS_DIARIAS_POR_DEFECTO = 14;

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * General club metrics (ACT-45, API contract §5.10 GET /reportes/estadisticas):
   * booking aggregates over `turnos.fecha` within [desde, hasta] plus user
   * counts by current role + estado. Reads only the cached `estado_actual`
   * columns, never the history tables (DOMINIO + ADR-0004).
   */
  async obtenerEstadisticas(
    query: ConsultarEstadisticasDto,
    ahora = new Date(),
  ): Promise<EstadisticasResponse> {
    const periodo = resolverPeriodo(query, ahora);
    const [turnos, canchas, usuarios] = await Promise.all([
      this.prisma.turnos.findMany({
        where: { fecha: { gte: fechaParaPrisma(periodo.desde), lte: fechaParaPrisma(periodo.hasta) } },
        select: { estado_actual: true, cancha_id: true, hora_inicio: true },
      }),
      this.prisma.canchas.findMany({ orderBy: { nro_cancha: 'asc' } }),
      this.prisma.usuarios.findMany({
        select: {
          id: true,
          estado_actual: true,
          usuarios_roles: { select: { roles: { select: { nombre: true } } } },
        },
      }),
    ]);

    const nroPorCancha = new Map(canchas.map((cancha) => [cancha.id, cancha.nro_cancha]));
    const porEstado: PorEstadoTurnos = {
      confirmado: 0,
      iniciado: 0,
      finalizado: 0,
      cancelado: 0,
      no_asistio: 0,
    };
    const cantidadPorCancha = new Map<string, number>();
    const cantidadPorFranja = new Map<string, number>();
    for (const turno of turnos) {
      porEstado[turno.estado_actual as keyof PorEstadoTurnos] += 1;
      cantidadPorCancha.set(turno.cancha_id, (cantidadPorCancha.get(turno.cancha_id) ?? 0) + 1);
      const horaInicio = formatearHora(minutosDeHora(turno.hora_inicio));
      cantidadPorFranja.set(horaInicio, (cantidadPorFranja.get(horaInicio) ?? 0) + 1);
    }

    return {
      periodo,
      turnos: {
        total: turnos.length,
        porEstado,
        porCancha: [...cantidadPorCancha.entries()]
          .filter(([canchaId]) => nroPorCancha.has(canchaId))
          .map(([canchaId, cantidad]) => ({
            canchaId,
            nroCancha: nroPorCancha.get(canchaId) ?? 0,
            cantidad,
          }))
          .sort((a, b) => a.nroCancha - b.nroCancha),
        porFranja: [...cantidadPorFranja.entries()]
          .map(([horaInicio, cantidad]) => ({ horaInicio, cantidad }))
          .sort((a, b) => (a.horaInicio < b.horaInicio ? -1 : 1)),
      },
      usuarios: contarUsuarios(usuarios),
    };
  }

  /**
   * Financial metrics (ACT-46, API contract §5.10 GET /reportes/financiero):
   * collected income (`pagos_turno`, `pagos_luz`, registered `lineas_cuota`),
   * issued `cuotas` bucketed by current estado, and court usage from
   * non-cancelled `turnos` over the same periodo semantics as estadisticas.
   * Reads only the cached `estado_actual` columns, never the history tables
   * (DOMINIO + ADR-0004). Aggregation follows F1–F7 exactly.
   */
  async obtenerFinanciero(
    query: ConsultarEstadisticasDto,
    ahora = new Date(),
  ): Promise<FinancieroResponse> {
    const periodo = resolverPeriodo(query, ahora);
    const diaDesde = inicioDiaUTC(periodo.desde);
    const diaSiguienteAlHasta = inicioDiaUTC(periodo.hasta, 1);
    const [pagosTurno, pagosLuz, lineas, cuotas, turnos, canchas, dias, rangos] =
      await Promise.all([
        this.prisma.pagos_turno.findMany({
          where: { fecha_pago: { gte: diaDesde, lt: diaSiguienteAlHasta } },
          select: { monto_total_turno: true },
        }),
        this.prisma.pagos_luz.findMany({
          where: { fecha_pago: { gte: diaDesde, lt: diaSiguienteAlHasta } },
          select: { monto_total_luz: true },
        }),
        this.prisma.lineas_cuota.findMany({
          where: { fecha_pago: { gte: diaDesde, lt: diaSiguienteAlHasta } },
          select: { monto: true, estado: true, fecha_pago: true },
        }),
        this.prisma.cuotas.findMany({
          where: {
            fecha_inicio: {
              gte: fechaParaPrisma(periodo.desde),
              lte: fechaParaPrisma(periodo.hasta),
            },
          },
          select: { monto_total: true, estado_actual: true },
        }),
        this.prisma.turnos.findMany({
          where: {
            fecha: { gte: fechaParaPrisma(periodo.desde), lte: fechaParaPrisma(periodo.hasta) },
          },
          select: { estado_actual: true, hora_inicio: true, hora_fin: true },
        }),
        this.prisma.canchas.findMany({ select: { estado_actual: true } }),
        this.prisma.dias_funcionamiento.findMany(),
        this.prisma.rangos_horario.findMany(),
      ]);

    const ingresos = {
      pagosTurno: redondear2(pagosTurno.reduce((total, pago) => total + aNumero(pago.monto_total_turno), 0)),
      pagosLuz: redondear2(pagosLuz.reduce((total, pago) => total + aNumero(pago.monto_total_luz), 0)),
      // F2: only registrada lines with a payment date inside the range count.
      cuotasCobradas: redondear2(
        lineas
          .filter((linea) => linea.estado === 'registrada' && linea.fecha_pago !== null)
          .reduce((total, linea) => total + aNumero(linea.monto), 0),
      ),
    };

    // F3–F4: every issued cuota counts in emitidas; only the three buckets split out.
    const cuotasAgregadas = {
      emitidas: cuotas.length,
      montoEmitido: redondear2(cuotas.reduce((total, cuota) => total + aNumero(cuota.monto_total), 0)),
      pagadas: cuotas.filter((cuota) => cuota.estado_actual === 'pagada').length,
      parciales: cuotas.filter((cuota) => cuota.estado_actual === 'parcial').length,
      adeudadas: cuotas.filter((cuota) => cuota.estado_actual === 'adeudada').length,
    };

    // F5: cancelled bookings occupy no court time.
    const turnosVigentes = turnos.filter((turno) => turno.estado_actual !== 'cancelado');
    const horasOcupadas = redondear2(
      turnosVigentes.reduce(
        (total, turno) => total + (minutosDeHora(turno.hora_fin) - minutosDeHora(turno.hora_inicio)) / 60,
        0,
      ),
    );

    return {
      periodo,
      ingresos: {
        ...ingresos,
        total: redondear2(ingresos.pagosTurno + ingresos.pagosLuz + ingresos.cuotasCobradas),
      },
      cuotas: cuotasAgregadas,
      usoCanchas: {
        turnosTotal: turnosVigentes.length,
        horasOcupadas,
        ocupacionPromedio: calcularOcupacion(periodo, horasOcupadas, canchas, dias, rangos),
      },
    };
  }
}

/**
 * Missing bounds default to the current-month edges in the club timezone;
 * each bound defaults independently so a partial range still works.
 * Rejects impossible dates and desde>hasta with 400 (contract §5.10).
 */
export function resolverPeriodo(
  query: ConsultarEstadisticasDto,
  ahora = new Date(),
): PeriodoEstadisticas {
  const porDefecto = mesActualZonaClub(ahora);
  const desde = query.desde ?? porDefecto.desde;
  const hasta = query.hasta ?? porDefecto.hasta;
  if (!esFechaValida(desde)) {
    throw new BadRequestException('desde debe ser un dia calendario valido (YYYY-MM-DD)');
  }
  if (!esFechaValida(hasta)) {
    throw new BadRequestException('hasta debe ser un dia calendario valido (YYYY-MM-DD)');
  }
  if (desde > hasta) {
    throw new BadRequestException('desde no puede ser posterior a hasta');
  }
  return { desde, hasta };
}

/** First and last day of the current month in the club timezone. */
export function mesActualZonaClub(ahora = new Date()): PeriodoEstadisticas {
  const parte = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CLUB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
  const [anio, mes] = parte.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  return {
    desde: `${prefijo}-01`,
    hasta: `${prefijo}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

/**
 * User counts (PO 2026-10-03): the current role in `usuarios_roles`
 * (fecha_fin null) wins over the `socios` row, which is never read.
 * morosos = estado moroso (any role); sociosActivos = socio role + activo;
 * noSocios = the remainder.
 */
export function contarUsuarios(
  usuarios: { estado_actual: string; usuarios_roles: { roles: { nombre: string } } | null }[],
): { sociosActivos: number; noSocios: number; morosos: number } {
  let sociosActivos = 0;
  let noSocios = 0;
  let morosos = 0;
  for (const usuario of usuarios) {
    if (usuario.estado_actual === 'moroso') {
      morosos += 1;
      continue;
    }
    if (usuario.usuarios_roles?.roles?.nombre === 'socio' && usuario.estado_actual === 'activo') {
      sociosActivos += 1;
    } else {
      noSocios += 1;
    }
  }
  return { sociosActivos, noSocios, morosos };
}

/**
 * F6: share of the bookable capacity actually used.
 * Capacity = courts with `estado_actual = 'disponible'` × enabled days in
 * range × daily opening hours from `rangos_horario` (`dias_funcionamiento`
 * decides which weekdays count; a weekday without a config row counts as
 * enabled so missing config never zeroes the denominator). With no `rangos_horario`
 * rows the PO-confirmed fallback is 14 h/day (08–22). Zero capacity → 0, never NaN.
 */
export function calcularOcupacion(
  periodo: PeriodoEstadisticas,
  horasOcupadas: number,
  canchas: { estado_actual: string }[],
  dias: { dia_semana: number; habilitado: boolean }[],
  rangos: { hora_inicio: Date | string; hora_fin: Date | string }[],
): number {
  const canchasDisponibles = canchas.filter(
    (cancha) => cancha.estado_actual === 'disponible',
  ).length;
  const diasHabilitados = contarDiasHabilitados(periodo, dias);
  const horasDiarias =
    rangos.length === 0
      ? HORAS_DIARIAS_POR_DEFECTO
      : rangos.reduce(
          (total, rango) => total + (minutosDeHora(rango.hora_fin) - minutosDeHora(rango.hora_inicio)) / 60,
          0,
        );
  const capacidad = canchasDisponibles * diasHabilitados * horasDiarias;
  if (capacidad <= 0) {
    return 0;
  }
  return redondear2(horasOcupadas / capacidad);
}

/** Calendar days in [desde, hasta] whose ISO weekday is enabled in config. */
export function contarDiasHabilitados(
  periodo: PeriodoEstadisticas,
  dias: { dia_semana: number; habilitado: boolean }[],
): number {
  const habilitadoPorDia = new Map(dias.map((dia) => [dia.dia_semana, dia.habilitado]));
  let diasHabilitados = 0;
  for (
    let actual = inicioDiaUTC(periodo.desde);
    actual <= inicioDiaUTC(periodo.hasta);
    actual = new Date(actual.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const iso = actual.getUTCDay() === 0 ? 7 : actual.getUTCDay();
    if (habilitadoPorDia.get(iso) ?? true) {
      diasHabilitados += 1;
    }
  }
  return diasHabilitados;
}

/**
 * Prisma `Decimal` (Decimal.js, exposes `toNumber()`) or plain
 * number/string stub value → number. Keeps the stub-Prisma specs free of
 * driver types while matching the real shapes.
 */
export function aNumero(valor: { toNumber(): number } | number | string): number {
  if (typeof valor === 'number') {
    return valor;
  }
  if (typeof valor === 'string') {
    return Number(valor);
  }
  return valor.toNumber();
}

/** F7: money and ratio boundary — 2-decimal rounding absorbing float dust. */
export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * `YYYY-MM-DD` → start of that UTC day. Timestamptz columns (`fecha_pago`)
 * need full-day coverage `[desde 00:00, hasta+1 00:00)`, unlike the `@db.Date`
 * columns served by `fechaParaPrisma`: a noon-to-noon window would silently
 * drop afternoon payments on the boundary days.
 */
function inicioDiaUTC(fecha: string, diasExtra = 0): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + diasExtra, 0, 0, 0, 0));
}

/**
 * `YYYY-MM-DD` → Date for the `@db.Date` column. Noon UTC keeps the UTC date
 * part stable regardless of the server timezone (up to ±12 h).
 */
function fechaParaPrisma(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}
