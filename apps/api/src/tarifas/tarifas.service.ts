import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { ActualizarTarifaCuotaDto } from './dto/actualizar-tarifa-cuota.dto';
import type { ActualizarTarifaTurnoDto } from './dto/actualizar-tarifa-turno.dto';
import {
  toTarifaCuotaResponse,
  toTarifaLuzResponse,
  toTarifaTurnoResponse,
  type TarifaCuotaResponse,
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
}