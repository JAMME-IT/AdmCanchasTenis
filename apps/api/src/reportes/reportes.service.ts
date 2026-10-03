import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { esFechaValida, formatearHora, minutosDeHora } from '../turnos/disponibilidad-slots';
import type { ConsultarEstadisticasDto } from './dto/consultar-estadisticas.dto';
import type {
  EstadisticasResponse,
  PeriodoEstadisticas,
  PorEstadoTurnos,
} from './estadisticas-response';

/** Club timezone for the default period (UTC-3 year-round, no DST). */
const ZONA_CLUB = 'America/Argentina/Buenos_Aires';

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
 * `YYYY-MM-DD` → Date for the `@db.Date` column. Noon UTC keeps the UTC date
 * part stable regardless of the server timezone (up to ±12 h).
 */
function fechaParaPrisma(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}
