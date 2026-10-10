import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { toCanchaResponse, type CanchaResponse } from './cancha-response';
import type { ActualizarCanchaDto } from './dto/actualizar-cancha.dto';
import type { CrearCanchaDto } from './dto/crear-cancha.dto';
import type { ListarCanchasDto } from './dto/listar-canchas.dto';

@Injectable()
export class CanchasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Court catalog (ACT-29, API contract §5.5 GET /canchas): all courts ordered
   * by `nro_cancha`. `conEstados=true` (admin only) also returns each court's
   * `estados_cancha` history; a non-admin requesting it gets 403.
   */
  async listar(auth: AuthContext, query: ListarCanchasDto): Promise<CanchaResponse[]> {
    const conEstados = query.conEstados === true;
    if (conEstados && auth.rol !== 'admin') {
      throw new ForbiddenException('Solo un admin puede consultar el historial de estados');
    }
    const canchas = await this.prisma.canchas.findMany({
      orderBy: { nro_cancha: 'asc' },
      ...(conEstados ? { include: { estados_cancha: { orderBy: { fecha_cambio: 'desc' } } } } : {}),
    });
    return canchas.map(toCanchaResponse);
  }

  /**
   * Court creation (ACT-28, API contract §5.5 POST /canchas): creates the
   * `canchas` row in `disponible` plus its initial `estados_cancha` row in the
   * same transaction (historial + cache, ADR-0004). A duplicated `nro_cancha`
   * surfaces as 409 via the `uq_canchas_nro` unique violation.
   */
  async crear(dto: CrearCanchaDto): Promise<CanchaResponse> {
    const iluminacion = dto.iluminacion ?? true;
    try {
      const creada = await this.prisma.$transaction(async (tx) => {
        const cancha = await tx.canchas.create({
          data: {
            nro_cancha: dto.nroCancha,
            superficie: dto.superficie,
            iluminacion,
            estado_actual: 'disponible',
          },
        });
        await tx.estados_cancha.create({
          data: { cancha_id: cancha.id, valor_state: 'disponible' },
        });
        return cancha;
      });
      return toCanchaResponse(creada);
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya existe una cancha con ese numero');
      }
      throw error;
    }
  }

  /**
   * Court edit (ACT-28, API contract §5.5 PATCH /canchas/:id): updates only the
   * provided fields and never touches the state (that is PATCH /canchas/:id/estado).
   * An empty body is a 400; a duplicated `nro_cancha` is a 409.
   */
  async actualizar(id: string, dto: ActualizarCanchaDto): Promise<CanchaResponse> {
    const data = {
      ...(dto.nroCancha !== undefined ? { nro_cancha: dto.nroCancha } : {}),
      ...(dto.superficie !== undefined ? { superficie: dto.superficie } : {}),
      ...(dto.iluminacion !== undefined ? { iluminacion: dto.iluminacion } : {}),
    };
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Debe enviar al menos un campo para actualizar');
    }

    const existente = await this.prisma.canchas.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException('Cancha inexistente');
    }

    try {
      const actualizada = await this.prisma.canchas.update({ where: { id }, data });
      return toCanchaResponse(actualizada);
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya existe una cancha con ese numero');
      }
      throw error;
    }
  }
}

/** Prisma unique-violation (`uq_canchas_nro` race → 409). */
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
