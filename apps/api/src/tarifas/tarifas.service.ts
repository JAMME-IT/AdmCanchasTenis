import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { horaDesdeTexto, minutosDeHoraTexto } from '../config/hora';
import type { ActualizarTarifaCuotaDto } from './dto/actualizar-tarifa-cuota.dto';
import type { ActualizarTarifaLuzDto } from './dto/actualizar-tarifa-luz.dto';
import type { ActualizarTarifaTurnoDto } from './dto/actualizar-tarifa-turno.dto';
import {
  toTarifaCuotaResponse,
  toTarifaLuzResponse,
  toTarifaTurnoResponse,
  type TarifaCuotaResponse,
  type TarifaLuzResponse,
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

  /**
   * PUT /tarifas/luz (RF-16/RF-28): upserts the single operative `luz` row.
   * The lighting cost is versioned in `estados_luz` only when it changes; the
   * window is not versioned. Creating the row uses the club defaults 18:30-22:00.
   */
  async actualizarTarifaLuz(dto: ActualizarTarifaLuzDto): Promise<TarifaLuzResponse> {
    const tieneInicio = dto.franjaHorarioInicio !== undefined;
    const tieneFin = dto.franjaHorarioFin !== undefined;

    if (tieneInicio !== tieneFin) {
      throw new BadRequestException(
        'franjaHorarioInicio y franjaHorarioFin deben enviarse juntos',
      );
    }
    if (tieneInicio && tieneFin) {
      const inicio = minutosDeHoraTexto(dto.franjaHorarioInicio as string);
      const fin = minutosDeHoraTexto(dto.franjaHorarioFin as string);
      if (fin <= inicio) {
        throw new BadRequestException(
          'franjaHorarioFin debe ser posterior a franjaHorarioInicio',
        );
      }
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.luz.findFirst({ orderBy: { created_at: 'desc' } });

      const franja = tieneInicio && tieneFin
        ? {
            franja_horario_inicio: horaDesdeTexto(dto.franjaHorarioInicio as string),
            franja_horario_fin: horaDesdeTexto(dto.franjaHorarioFin as string),
          }
        : {};

      if (!actual) {
        const luz = await tx.luz.create({
          data: {
            costo_x_hora: dto.costoXHora,
            franja_horario_inicio: horaDesdeTexto(dto.franjaHorarioInicio ?? '18:30'),
            franja_horario_fin: horaDesdeTexto(dto.franjaHorarioFin ?? '22:00'),
          },
        });
        const historial = await tx.estados_luz.create({
          data: { luz_id: luz.id, costo_x_hora: dto.costoXHora },
        });
        return { luz, fechaCambio: historial.fecha };
      }

      const costoCambio = Number(actual.costo_x_hora) !== dto.costoXHora;
      const luz = await tx.luz.update({
        where: { id: actual.id },
        data: { costo_x_hora: dto.costoXHora, ...franja, updated_at: new Date() },
      });

      let fechaCambio: Date;
      if (costoCambio) {
        const historial = await tx.estados_luz.create({
          data: { luz_id: actual.id, costo_x_hora: dto.costoXHora },
        });
        fechaCambio = historial.fecha;
      } else {
        const historial = await tx.estados_luz.findFirst({
          where: { luz_id: actual.id },
          orderBy: { fecha: 'desc' },
        });
        fechaCambio = historial?.fecha ?? actual.created_at;
      }

      return { luz, fechaCambio };
    });

    return toTarifaLuzResponse(resultado.luz, resultado.fechaCambio);
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