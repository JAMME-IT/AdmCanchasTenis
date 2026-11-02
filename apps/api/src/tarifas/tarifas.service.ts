import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ActualizarTarifaCuotaDto } from './dto/actualizar-tarifa-cuota.dto';
import type { ActualizarTarifaTurnoDto } from './dto/actualizar-tarifa-turno.dto';
import type {
  ConsultarHistorialTarifasDto,
  TipoTarifaHistorial,
} from './dto/consultar-historial-tarifas.dto';
import {
  toTarifaCuotaResponse,
  toTarifaHistorialItemResponse,
  toTarifaLuzResponse,
  toTarifaTurnoResponse,
  type TarifaCuotaResponse,
  type TarifaHistorialItemResponse,
  type TarifaTurnoResponse,
  type TarifasResponse,
} from './tarifa-response';

/**
 * Tarifas business logic (API contract §5.8).
 * Append-only versioning: every PUT inserts a new row; the vigente tariff is the
 * one with the highest `fecha_cambio <= now()`. GET /tarifas returns each type's
 * vigente, or null when the type has no history yet.
 */
@Injectable()
export class TarifasService {
  constructor(private readonly prisma: PrismaService) {}

  /** PUT /tarifas/turno (RF-27): new hourly court tariff; the inserted row is the vigente. */
  async actualizarTarifaTurno(dto: ActualizarTarifaTurnoDto): Promise<TarifaTurnoResponse> {
    const fila = await this.prisma.valores_turno.create({
      data: { costo_x_hora: dto.costoXHora },
    });
    return toTarifaTurnoResponse(fila);
  }

  /** PUT /tarifas/cuota (RF-29): new monthly membership tariff; the inserted row is the vigente. */
  async actualizarTarifaCuota(dto: ActualizarTarifaCuotaDto): Promise<TarifaCuotaResponse> {
    const fila = await this.prisma.valores_cuota.create({
      data: { precio: dto.precio },
    });
    return toTarifaCuotaResponse(fila);
  }

  /** GET /tarifas (RF-43): vigente de turno, luz y cuota; null cuando el tipo no tiene historial. */
  async obtenerVigentes(): Promise<TarifasResponse> {
    const turno = await this.prisma.valores_turno.findFirst({
      where: { fecha_cambio: { lte: new Date() } },
      orderBy: { fecha_cambio: 'desc' },
    });
    const cuota = await this.prisma.valores_cuota.findFirst({
      where: { fecha_cambio: { lte: new Date() } },
      orderBy: { fecha_cambio: 'desc' },
    });
    const luz = await this.prisma.luz.findFirst({
      orderBy: { created_at: 'desc' },
    });

    let luzResponse = null;
    if (luz) {
      const historial = await this.prisma.estados_luz.findFirst({
        where: { luz_id: luz.id },
        orderBy: { fecha: 'desc' },
      });
      luzResponse = toTarifaLuzResponse(luz, historial?.fecha ?? luz.created_at);
    }

    return {
      turno: turno ? toTarifaTurnoResponse(turno) : null,
      luz: luzResponse,
      cuota: cuota ? toTarifaCuotaResponse(cuota) : null,
    };
  }

  /**
   * GET /tarifas/historial (RF-30/RF-31): unified history of the versioned
   * tariffs. `tipo` narrows the source; date and amount ranges apply to each
   * source's own columns. The result is newest first.
   */
  async obtenerHistorial(
    dto: ConsultarHistorialTarifasDto,
  ): Promise<TarifaHistorialItemResponse[]> {
    const desde = this.parseFechaHistorial(dto.desde, 'desde');
    const hasta = this.parseFechaHistorial(dto.hasta, 'hasta');
    const pedirTurno = !dto.tipo || dto.tipo === 'turno';
    const pedirCuota = !dto.tipo || dto.tipo === 'cuota';
    const pedirLuz = !dto.tipo || dto.tipo === 'luz';

    const whereTurno: Prisma.valores_turnoWhereInput = {};
    const whereCuota: Prisma.valores_cuotaWhereInput = {};
    const whereLuz: Prisma.estados_luzWhereInput = {};

    if (desde || hasta) {
      whereTurno.fecha_cambio = rangoFecha(desde, hasta);
      whereCuota.fecha_cambio = rangoFecha(desde, hasta);
      whereLuz.fecha = rangoFecha(desde, hasta);
    }
    if (dto.montoMin !== undefined || dto.montoMax !== undefined) {
      whereTurno.costo_x_hora = rangoMonto(dto.montoMin, dto.montoMax);
      whereCuota.precio = rangoMonto(dto.montoMin, dto.montoMax);
      whereLuz.costo_x_hora = rangoMonto(dto.montoMin, dto.montoMax);
    }

    const [turnos, cuotas, luces] = await Promise.all([
      pedirTurno
        ? this.prisma.valores_turno.findMany({
            where: whereTurno,
            orderBy: { fecha_cambio: 'desc' },
          })
        : Promise.resolve([]),
      pedirCuota
        ? this.prisma.valores_cuota.findMany({
            where: whereCuota,
            orderBy: { fecha_cambio: 'desc' },
          })
        : Promise.resolve([]),
      pedirLuz
        ? this.prisma.estados_luz.findMany({
            where: whereLuz,
            orderBy: { fecha: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const items: Array<{ tipo: TipoTarifaHistorial; monto: unknown; fecha: Date }> = [];
    for (const fila of turnos) {
      items.push({ tipo: 'turno', monto: fila.costo_x_hora, fecha: fila.fecha_cambio });
    }
    for (const fila of cuotas) {
      items.push({ tipo: 'cuota', monto: fila.precio, fecha: fila.fecha_cambio });
    }
    for (const fila of luces) {
      items.push({ tipo: 'luz', monto: fila.costo_x_hora, fecha: fila.fecha });
    }

    items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

    return items.map((item) =>
      toTarifaHistorialItemResponse(item.tipo, item.monto, item.fecha),
    );
  }

  private parseFechaHistorial(valor: string | undefined, campo: string): Date | undefined {
    if (!valor) {
      return undefined;
    }
    const parsed = new Date(valor);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${campo} debe ser una fecha valida`);
    }
    return parsed;
  }
}

function rangoFecha(
  desde: Date | undefined,
  hasta: Date | undefined,
): { gte?: Date; lte?: Date } {
  return {
    ...(desde ? { gte: desde } : {}),
    ...(hasta ? { lte: hasta } : {}),
  };
}

function rangoMonto(
  minimo: number | undefined,
  maximo: number | undefined,
): { gte?: number; lte?: number } {
  return {
    ...(minimo !== undefined ? { gte: minimo } : {}),
    ...(maximo !== undefined ? { lte: maximo } : {}),
  };
}