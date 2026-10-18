import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from '../auth/auth.types';
import type { RegistrarPagoCuotaDto } from './dto/registrar-pago-cuota.dto';
import { toMiCuotaResponse, type MiCuotaResponse } from './mi-cuota-response';

export type EstadoCuota = 'pendiente' | 'pagada' | 'parcial' | 'adeudada' | 'cancelada';

export interface LineaCuotaPagada {
  id: string;
  numeroLinea: number;
  monto: number;
  fechaPago: string;
  estado: string;
}

export interface RegistrarPagoResult {
  cuota: {
    id: string;
    socioId: string;
    montoTotal: number;
    totalPagado: number;
    saldo: number;
    estadoActual: EstadoCuota;
  };
  linea: LineaCuotaPagada;
}

export interface MonthlyFeesResult {
  periodo: string;
  fechaInicio: string;
  fechaVencimiento: string;
  tarifaId: string;
  monto: number;
  sociosVigentes: number;
  generadas: number;
  omitidas: number;
}

const DUE_DAY_DEFAULT = 10;
const DUE_DAY_MIN = 1;
const DUE_DAY_MAX = 28;

export function resolveDueDay(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return DUE_DAY_DEFAULT;
  }
  return Math.min(DUE_DAY_MAX, Math.max(DUE_DAY_MIN, parsed));
}

export function resolvePeriodo(input?: string, now: Date = new Date()): string {
  if (input !== undefined) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input)) {
      throw new Error('periodo must use YYYY-MM format');
    }
    return input;
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function periodoToFechas(periodo: string, dueDay: number): { fechaInicio: Date; fechaVencimiento: Date } {
  const [year, month] = periodo.split('-').map(Number);
  return {
    fechaInicio: new Date(Date.UTC(year, month - 1, 1)),
    fechaVencimiento: new Date(Date.UTC(year, month - 1, dueDay)),
  };
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class CuotasService {
  private readonly logger = new Logger(CuotasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scheduled entry point (RF-20): runs on the 1st of each month.
   * Re-runs are idempotent thanks to uq_cuotas_socio_periodo.
   */
  @Cron('0 5 1 * *', { timeZone: 'America/Argentina/Buenos_Aires' })
  async handleMonthlyGeneration(): Promise<MonthlyFeesResult> {
    const result = await this.generateMonthlyFees();
    this.logger.log(
      `cuotas ${result.periodo}: generadas=${result.generadas} omitidas=${result.omitidas} socios=${result.sociosVigentes}`,
    );
    return result;
  }

  /**
   * Generates the monthly fee for every active socio using the current tariff.
   * Idempotent: re-running for the same periodo never duplicates fees.
   */
  async generateMonthlyFees(periodoInput?: string, now: Date = new Date()): Promise<MonthlyFeesResult> {
    const periodo = resolvePeriodo(periodoInput, now);
    const dueDay = resolveDueDay(process.env.CUOTAS_DUE_DAY);
    const { fechaInicio, fechaVencimiento } = periodoToFechas(periodo, dueDay);

    const tarifa = await this.prisma.valores_cuota.findFirst({
      where: { fecha_cambio: { lte: now } },
      orderBy: { fecha_cambio: 'desc' },
    });
    if (!tarifa) {
      throw new InternalServerErrorException('Falta la tarifa vigente de cuota (valores_cuota)');
    }

    const socios = await this.prisma.socios.findMany({
      where: { usuarios: { estado_actual: { in: ['activo', 'moroso'] } } },
      select: { id: true },
    });

    let generadas = 0;
    let omitidas = 0;
    for (const socio of socios) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const cuota = await tx.cuotas.create({
            data: {
              socio_id: socio.id,
              fecha_inicio: fechaInicio,
              fecha_vencimiento: fechaVencimiento,
              monto_total: tarifa.precio,
            },
          });
          await tx.estados_cuota.create({
            data: { cuota_id: cuota.id, valor_estado: 'pendiente' },
          });
        });
        generadas += 1;
      } catch (error) {
        if (isUniqueViolation(error)) {
          omitidas += 1;
          continue;
        }
        throw error;
      }
    }

    return {
      periodo,
      fechaInicio: fechaInicio.toISOString().slice(0, 10),
      fechaVencimiento: fechaVencimiento.toISOString().slice(0, 10),
      tarifaId: tarifa.id,
      monto: Number(tarifa.precio),
      sociosVigentes: socios.length,
      generadas,
      omitidas,
    };
  }

  /**
   * Cuotas del socio autenticado (ACT-48, API contract §5.7 GET /cuotas/mias,
   * RF-26/CU14): cuotas propias con sus pagos registrados, orden descendente
   * por inicio de periodo. Exclusivo de socio: sin usuario o sin fila en
   * `socios` responde 403 (el guard de rol ya filtra por rol vigente).
   */
  async obtenerMias(auth: AuthContext): Promise<MiCuotaResponse[]> {
    if (!auth.usuario) {
      throw new ForbiddenException('Se requiere un usuario registrado');
    }
    const socio = await this.prisma.socios.findUnique({
      where: { usuario_id: auth.usuario.id },
      select: { id: true },
    });
    if (!socio) {
      throw new ForbiddenException('El usuario no es socio');
    }
    const cuotas = await this.prisma.cuotas.findMany({
      where: { socio_id: socio.id },
      include: { lineas_cuota: true },
      orderBy: [{ fecha_inicio: 'desc' }],
    });
    return cuotas.map((cuota) => toMiCuotaResponse(cuota));
  }

  /**
   * Payment registration (ACT-40, API contract §5.7 POST /cuotas/:id/pagos):
   * inserts a partial/total payment as a `lineas_cuota` row, recalculates
   * `totalPagado`, updates `cuotas.estado_actual` and appends to
   * `estados_cuota` — all atomically in one transaction (RF-21, RN-3).
   */
  async registrarPago(
    cuotaId: string,
    dto: RegistrarPagoCuotaDto,
    now: Date = new Date(),
  ): Promise<RegistrarPagoResult> {
    const monto = Number(dto.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('monto debe ser mayor a 0');
    }
    let fechaPago = now;
    if (dto.fechaPago !== undefined) {
      const parsed = new Date(dto.fechaPago);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('fechaPago debe ser un timestamp valido');
      }
      if (parsed.getTime() > now.getTime()) {
        throw new BadRequestException('fechaPago no puede ser futura');
      }
      fechaPago = parsed;
    }

    return this.prisma.$transaction(async (tx) => {
      const cuota = await tx.cuotas.findUnique({
        where: { id: cuotaId },
        include: { lineas_cuota: true },
      });
      if (!cuota) {
        throw new NotFoundException('Cuota inexistente');
      }
      if (cuota.estado_actual === 'cancelada') {
        throw new ConflictException('La cuota esta cancelada');
      }

      const registradas = cuota.lineas_cuota.filter((l) => l.estado === 'registrada');
      const totalPagado = registradas.reduce((acc, l) => acc + Number(l.monto), 0);
      const montoTotal = Number(cuota.monto_total);
      const saldo = Math.round((montoTotal - totalPagado) * 100) / 100;
      if (monto - saldo > 1e-9) {
        throw new UnprocessableEntityException('monto mayor al saldo pendiente');
      }

      const maxLinea = registradas.reduce((max, l) => Math.max(max, l.numero_linea), 0);
      const linea = await tx.lineas_cuota.create({
        data: {
          cuota_id: cuota.id,
          numero_linea: maxLinea + 1,
          fecha_pago: fechaPago,
          monto,
          estado: 'registrada',
        },
      });

      const nuevoTotal = Math.round((totalPagado + monto) * 100) / 100;
      const nuevoSaldo = Math.round((montoTotal - nuevoTotal) * 100) / 100;
      let nuevoEstado: EstadoCuota;
      if (nuevoSaldo <= 1e-9) {
        nuevoEstado = 'pagada';
      } else if (nuevoTotal > 1e-9) {
        nuevoEstado = 'parcial';
      } else {
        const vencimiento = new Date(cuota.fecha_vencimiento);
        vencimiento.setHours(0, 0, 0, 0);
        const hoy = new Date(now);
        hoy.setHours(0, 0, 0, 0);
        nuevoEstado = vencimiento.getTime() < hoy.getTime() ? 'adeudada' : 'pendiente';
      }

      await tx.cuotas.update({
        where: { id: cuota.id },
        data: { estado_actual: nuevoEstado },
      });
      await tx.estados_cuota.create({
        data: { cuota_id: cuota.id, valor_estado: nuevoEstado },
      });

      return {
        cuota: {
          id: cuota.id,
          socioId: cuota.socio_id,
          montoTotal,
          totalPagado: nuevoTotal,
          saldo: Math.max(0, nuevoSaldo),
          estadoActual: nuevoEstado,
        },
        linea: {
          id: linea.id,
          numeroLinea: linea.numero_linea,
          monto: Number(linea.monto),
          fechaPago: new Date(linea.fecha_pago ?? fechaPago).toISOString(),
          estado: linea.estado,
        },
      };
    });
  }
}
