import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  toDiasFuncionamientoResponse,
  type DiaFuncionamientoResponse,
} from './dias-funcionamiento-response';
import type { ActualizarDiasFuncionamientoDto } from './dto/actualizar-dias-funcionamiento.dto';

/**
 * Operating days business logic (API contract §5.6, RF-35).
 * The club's operating week is a set of per-weekday toggles keyed by ISO-8601
 * weekday (1 = Monday ... 7 = Sunday).
 */
@Injectable()
export class DiasFuncionamientoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /config/dias-funcionamiento (RF-35): always the full 7-day ISO view.
   * A day without a stored row is reported as `habilitado: false`.
   */
  async listar(): Promise<DiaFuncionamientoResponse[]> {
    const filas = await this.prisma.dias_funcionamiento.findMany({
      orderBy: { dia_semana: 'asc' },
    });
    return toDiasFuncionamientoResponse(filas);
  }

  /**
   * PUT /config/dias-funcionamiento (RF-35): upserts only the days provided, in
   * one transaction, then returns the full 7-day view. A duplicate `diaSemana`
   * in the body is a 400. The model has no `@updatedAt`, so `updated_at` is set
   * explicitly on update (as the seed does).
   */
  async actualizar(dto: ActualizarDiasFuncionamientoDto): Promise<DiaFuncionamientoResponse[]> {
    const diasVistos = new Set<number>();
    for (const dia of dto.dias) {
      if (diasVistos.has(dia.diaSemana)) {
        throw new BadRequestException('No se admiten dias duplicados en el body');
      }
      diasVistos.add(dia.diaSemana);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const dia of dto.dias) {
        await tx.dias_funcionamiento.upsert({
          where: { dia_semana: dia.diaSemana },
          update: { habilitado: dia.habilitado, updated_at: new Date() },
          create: { dia_semana: dia.diaSemana, habilitado: dia.habilitado },
        });
      }
    });

    return this.listar();
  }
}
