import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ActualizarTipoTurnoDto } from './dto/actualizar-tipo-turno.dto';
import { toTipoTurnoResponse, type TipoTurnoResponse } from './tipos-turno-response';

/**
 * Shift type business logic (ACT-32, RF-15): the admin can change a shift
 * type's duration. Availability slot generation and new bookings read
 * `duracion_max`, so the change applies immediately; existing bookings keep
 * their stored `hora_fin`.
 */
@Injectable()
export class TiposTurnoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PATCH /config/tipos-turno/:id (RF-15): updates `duracion_max` from
   * `duracionMinutos`. Unknown id is a 404. A duration already used by another
   * type violates `uq_tipos_turno_duracion_max` and maps to a 409. Sending the
   * current duration is a normal 200. The model has no `@updatedAt`, so
   * `updated_at` is set explicitly.
   */
  async actualizar(id: string, dto: ActualizarTipoTurnoDto): Promise<TipoTurnoResponse> {
    const existente = await this.prisma.tipos_turno.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException('Tipo de turno inexistente');
    }

    try {
      const actualizado = await this.prisma.tipos_turno.update({
        where: { id },
        data: { duracion_max: dto.duracionMinutos, updated_at: new Date() },
      });
      return toTipoTurnoResponse(actualizado);
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya existe un tipo de turno con esa duracion');
      }
      throw error;
    }
  }
}

/** Prisma unique-violation (`uq_tipos_turno_duracion_max` race → 409). */
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
