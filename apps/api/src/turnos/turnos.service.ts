import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from '../auth/auth.types';
import type { Prisma } from '../generated/prisma/client';
import {
  construirSlots,
  diaSemanaISODeFecha,
  duracionPorDefecto,
  esFechaValida,
  formatearHora,
  haySolapamiento,
  minutosDeHora,
} from './disponibilidad-slots';
import type { DisponibilidadResponse } from './disponibilidad-response';
import type { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto';
import type { CrearTurnoDto } from './dto/crear-turno.dto';
import { toTurnoResponse, type ReservarTurnoResponse } from './turno-response';

@Injectable()
export class TurnosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Day availability (ACT-33, API contract §5.3 GET /turnos/disponibilidad):
   * free slots per court for the requested date, resolved against the
   * operating days (`dias_funcionamiento`), the opening ranges
   * (`rangos_horario`), the slot duration (`tipos_turno` or the 60/90 default)
   * and the non-cancelled bookings (`[horaInicio, horaFin)` overlap).
   *
   * Read-only over the config tables owned by ACT-30/31: it never writes them.
   * A non-enabled day returns 200 with empty slots (the contract only defines
   * 400/401 for this endpoint). Unknown `canchaId`/`tipoTurnoId` are 400 for
   * the same reason (no 404 is defined here).
   */
  async obtenerDisponibilidad(query: ConsultarDisponibilidadDto): Promise<DisponibilidadResponse> {
    if (!esFechaValida(query.fecha)) {
      throw new BadRequestException('fecha debe ser un dia calendario valido (YYYY-MM-DD)');
    }
    const diaSemanaISO = diaSemanaISODeFecha(query.fecha);

    const duracionMinutos = await this.resolverDuracion(query.tipoTurnoId, diaSemanaISO);
    const canchas = await this.resolverCanchas(query.canchaId);

    const dia = await this.prisma.dias_funcionamiento.findUnique({
      where: { dia_semana: diaSemanaISO },
    });
    if (!dia?.habilitado) {
      return { fecha: query.fecha, duracionMinutos, slots: [] };
    }

    const [rangos, luz, turnos] = await Promise.all([
      this.prisma.rangos_horario.findMany({ orderBy: { hora_inicio: 'asc' } }),
      this.prisma.luz.findFirst(),
      this.prisma.turnos.findMany({
        where: {
          fecha: fechaParaPrisma(query.fecha),
          ...(query.canchaId ? { cancha_id: query.canchaId } : {}),
          estado_actual: { not: 'cancelado' },
        },
        select: { cancha_id: true, hora_inicio: true, hora_fin: true, estado_actual: true },
      }),
    ]);

    const slots = construirSlots({
      canchas: canchas.map((cancha) => ({
        id: cancha.id,
        nroCancha: cancha.nro_cancha,
        estadoActual: cancha.estado_actual,
      })),
      rangos: rangos.map((rango) => ({
        horaInicio: formatearHora(minutosDeHora(rango.hora_inicio)),
        horaFin: formatearHora(minutosDeHora(rango.hora_fin)),
      })),
      turnos: turnos.map((turno) => ({
        canchaId: turno.cancha_id,
        horaInicio: formatearHora(minutosDeHora(turno.hora_inicio)),
        horaFin: formatearHora(minutosDeHora(turno.hora_fin)),
        estadoActual: turno.estado_actual,
      })),
      duracionMinutos,
      luz: luz
        ? {
            horaInicio: formatearHora(minutosDeHora(luz.franja_horario_inicio)),
            horaFin: formatearHora(minutosDeHora(luz.franja_horario_fin)),
          }
        : null,
    });

    return { fecha: query.fecha, duracionMinutos, slots };
  }

  /**
   * Booking creation (ACT-34, API contract §5.3 POST /turnos, RF-12/RF-13/RF-39):
   * validates the court, the day and the time range, then creates the `turnos`
   * row (frozen `valor_turno_id`, computed `costo_turno_ns`, `confirmado`) plus
   * its initial `estados_turno` row inside a single Prisma transaction
   * (DB-SCHEMA decision 1, single-transition invariant).
   *
   * Read-only over the config tables owned by Agustin (ACT-30/31): it never
   * writes them. Amounts are always computed server-side; the client sends none.
   */
  async reservar(auth: AuthContext, dto: CrearTurnoDto): Promise<ReservarTurnoResponse> {
    if (!auth.usuario || !auth.rol) {
      throw new ForbiddenException('Solo usuarios registrados pueden reservar turnos');
    }
    const usuarioId = auth.usuario.id;
    const esAdmin = auth.rol === 'admin';

    if (!esFechaValida(dto.fecha)) {
      throw new BadRequestException('fecha debe ser un dia calendario valido (YYYY-MM-DD)');
    }
    const inicioMinutos = minutosDeHora(dto.horaInicio);
    if (!Number.isFinite(inicioMinutos)) {
      throw new BadRequestException('horaInicio debe tener formato HH:MM');
    }

    const cancha = await this.prisma.canchas.findUnique({ where: { id: dto.canchaId } });
    if (!cancha) {
      throw new NotFoundException('Cancha inexistente');
    }
    if (cancha.estado_actual !== 'disponible') {
      throw new UnprocessableEntityException('La cancha no esta disponible');
    }

    const tipo = await this.prisma.tipos_turno.findUnique({ where: { id: dto.tipoTurnoId } });
    if (!tipo) {
      throw new NotFoundException('Tipo de turno inexistente');
    }
    const finMinutos = inicioMinutos + tipo.duracion_max;

    if (dto.requiereLuz && !cancha.iluminacion) {
      throw new UnprocessableEntityException('La cancha no tiene iluminacion');
    }

    const anticipacion = diferenciaEnDias(dto.fecha);
    if (anticipacion < 0) {
      throw new UnprocessableEntityException('La fecha del turno ya paso');
    }
    if (anticipacion > MAX_DIAS_ANTICIPACION) {
      throw new UnprocessableEntityException('La reserva admite como maximo 1 dia de anticipacion');
    }

    const dia = await this.prisma.dias_funcionamiento.findUnique({
      where: { dia_semana: diaSemanaISODeFecha(dto.fecha) },
    });
    if (!dia?.habilitado) {
      throw new UnprocessableEntityException('El dia no esta habilitado');
    }

    const rangos = await this.prisma.rangos_horario.findMany();
    const dentroDeFranja = rangos.some((rango) => {
      const inicio = minutosDeHora(rango.hora_inicio);
      const fin = minutosDeHora(rango.hora_fin);
      return inicio <= inicioMinutos && finMinutos <= fin;
    });
    if (!dentroDeFranja) {
      throw new UnprocessableEntityException('El horario esta fuera de la franja de funcionamiento');
    }

    const tarifa = await this.prisma.valores_turno.findFirst({
      where: { fecha_cambio: { lte: new Date() } },
      orderBy: { fecha_cambio: 'desc' },
    });
    if (!tarifa) {
      throw new BadRequestException('No hay tarifa de turno vigente');
    }

    let cargoLuz: number | null = null;
    if (dto.requiereLuz) {
      const luz = await this.prisma.luz.findFirst();
      if (!luz) {
        throw new BadRequestException('No hay configuracion de luz vigente');
      }
      cargoLuz = Number(luz.costo_x_hora);
    }

    const costoTurnoNs = calcularCostoTurnoNs(
      dto.cantidadNoSocios,
      Number(tarifa.costo_x_hora),
      tipo.duracion_max,
    );
    const fecha = fechaParaPrisma(dto.fecha);

    try {
      const creado = await this.prisma.$transaction(async (tx) => {
        if (!esAdmin) {
          const turnosDelDia = await tx.turnos.count({
            where: {
              usuario_id: usuarioId,
              fecha,
              estado_actual: { not: 'cancelado' },
            },
          });
          if (turnosDelDia >= MAX_TURNOS_POR_DIA) {
            throw new UnprocessableEntityException('Se alcanzo el maximo de 2 turnos por dia');
          }
        }
        await this.exigirCupoPorDeuda(tx, usuarioId, auth.rol);

        const ocupantes = await tx.turnos.findMany({
          where: {
            cancha_id: dto.canchaId,
            fecha,
            estado_actual: { not: 'cancelado' },
          },
          select: { hora_inicio: true, hora_fin: true },
        });
        const choca = ocupantes.some((ocupante) =>
          haySolapamiento(
            inicioMinutos,
            finMinutos,
            minutosDeHora(ocupante.hora_inicio),
            minutosDeHora(ocupante.hora_fin),
          ),
        );
        if (choca) {
          throw new ConflictException('El horario ya no esta disponible');
        }

        const turno = await tx.turnos.create({
          data: {
            usuario_id: usuarioId,
            cancha_id: dto.canchaId,
            tipo_turno_id: dto.tipoTurnoId,
            valor_turno_id: tarifa.id,
            fecha,
            hora_inicio: horaDesdeMinutos(inicioMinutos),
            hora_fin: horaDesdeMinutos(finMinutos),
            cantidad_personas: dto.cantidadPersonas,
            cantidad_no_socios: dto.cantidadNoSocios,
            costo_turno_ns: costoTurnoNs,
            requiere_luz: dto.requiereLuz,
            estado_actual: 'confirmado',
            estado_pago: 'impago',
          },
        });
        await tx.estados_turno.create({
          data: {
            turno_id: turno.id,
            valor_estado: 'confirmado',
            valor_estado_pago: 'impago',
          },
        });
        return turno;
      });

      return {
        ...toTurnoResponse(creado),
        cargoLuzCompartido: cargoLuz,
        avisos: construirAvisos(dto.cantidadNoSocios, costoTurnoNs, cargoLuz),
      };
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('El horario ya no esta disponible');
      }
      throw error;
    }
  }

  /**
   * Debt cap (RN-9): a socio with 2+ `adeudada` cuotas may hold a single
   * active booking (`confirmado`/`iniciado`) until the debt is cleared.
   * Finished history does not count: the rule limits exposure, it does not
   * ban players with past games. Only `socio` can owe cuotas, so other roles
   * (and socio users without a `socios` row yet) skip the check.
   */
  private async exigirCupoPorDeuda(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    rol: AuthContext['rol'],
  ): Promise<void> {
    if (rol !== 'socio') {
      return;
    }
    const socio = await tx.socios.findUnique({ where: { usuario_id: usuarioId } });
    if (!socio) {
      return;
    }
    const adeudadas = await tx.cuotas.count({
      where: { socio_id: socio.id, estado_actual: 'adeudada' },
    });
    if (adeudadas < MIN_CUOTAS_ADEUDADAS_RN9) {
      return;
    }
    const vigentes = await tx.turnos.count({
      where: { usuario_id: usuarioId, estado_actual: { in: ['confirmado', 'iniciado'] } },
    });
    if (vigentes >= MAX_TURNOS_VIGENTES_CON_DEUDA) {
      throw new UnprocessableEntityException(
        'El socio con 2 o mas cuotas adeudadas solo puede registrar 1 turno hasta regularizar',
      );
    }
  }

  /** Explicit `tipoTurnoId` wins; otherwise 60 min on weekdays, 90 on weekends. */
  private async resolverDuracion(tipoTurnoId: string | undefined, diaSemanaISO: number): Promise<number> {    if (!tipoTurnoId) {
      return duracionPorDefecto(diaSemanaISO);
    }
    const tipo = await this.prisma.tipos_turno.findUnique({ where: { id: tipoTurnoId } });
    if (!tipo) {
      throw new BadRequestException('Tipo de turno inexistente');
    }
    return tipo.duracion_max;
  }

  private async resolverCanchas(canchaId: string | undefined) {
    if (canchaId) {
      const cancha = await this.prisma.canchas.findUnique({ where: { id: canchaId } });
      if (!cancha) {
        throw new BadRequestException('Cancha inexistente');
      }
      return [cancha];
    }
    return this.prisma.canchas.findMany({ orderBy: { nro_cancha: 'asc' } });
  }
}

/**
 * Non-socio cost frozen at booking time (API contract §5.3):
 * `cantidadNoSocios × tarifaVigente.costoXHora × (duracionMax / 60)`.
 */
export function calcularCostoTurnoNs(
  cantidadNoSocios: number,
  costoXHora: number,
  duracionMinutos: number,
): number {
  return Math.round(cantidadNoSocios * costoXHora * (duracionMinutos / 60) * 100) / 100;
}

/**
 * `YYYY-MM-DD` → Date for the `@db.Date` column. Noon UTC keeps the UTC date
 * part stable regardless of the server timezone (up to ±12 h).
 */
function fechaParaPrisma(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}

/** Whole days from the local today to a valid `YYYY-MM-DD` date (RN-11). */
function diferenciaEnDias(fecha: string, hoy = new Date()): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const ms = Date.UTC(anio, mes - 1, dia) - Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round(ms / 86400000);
}

/** Minutes since midnight → `Date` for a `@db.Time` column (midnight-based, UTC). */
function horaDesdeMinutos(minutos: number): Date {
  return new Date(Date.UTC(1970, 0, 1, Math.floor(minutos / 60), minutos % 60));
}

/**
 * Booking notices (RF-13, CU04): non-socio payment reminder when it applies
 * and shared lighting-charge notice when it applies. Copy in Spanish without
 * accents, consistent with the availability `motivo` strings.
 */
function construirAvisos(
  cantidadNoSocios: number,
  costoTurnoNs: number,
  cargoLuz: number | null,
): string[] {
  const avisos: string[] = [];
  if (cantidadNoSocios > 0) {
    avisos.push(
      `Recordatorio: ${cantidadNoSocios} no socio(s) con un costo de $${costoTurnoNs.toFixed(2)} a abonar`,
    );
  }
  if (cargoLuz !== null) {
    avisos.push(`Aviso: el turno requiere luz con un cargo compartido de $${cargoLuz.toFixed(2)}`);
  }
  return avisos;
}

/** Prisma unique-violation (`uq_turnos_cancha_fecha_hora` race → 409). */
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** RN-2: at most 2 non-cancelled bookings per user and day. */
const MAX_TURNOS_POR_DIA = 2;

/** RN-11: at most 1 day ahead (`fecha <= hoy + 1`). */
const MAX_DIAS_ANTICIPACION = 1;

/** RN-9: debt cap kicks in at 2+ `adeudada` cuotas, capped at 1 active booking. */
const MIN_CUOTAS_ADEUDADAS_RN9 = 2;
const MAX_TURNOS_VIGENTES_CON_DEUDA = 1;
