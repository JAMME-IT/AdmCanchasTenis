import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

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
}
