import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { toCanchaResponse, type CanchaResponse } from './cancha-response';
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
}
