import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CrearPagoLuzDto } from './dto/crear-pago-luz.dto';
import { toPagoLuzResponse, type PagoLuzResponse } from './pago-luz-response';

/**
 * Payments of the lighting charge (ACT-43, API contract §5.9 POST /pagos-luz).
 * The admin registers a payment that was already verified (receipts arrive via
 * WhatsApp). One payment per turno: the service checks it inside a transaction.
 * `pagos_luz` has no unique index on `turno_id`, so the check is the guard; the
 * catch also translates a future unique violation if the constraint is added.
 */
@Injectable()
export class PagosLuzService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarPago(dto: CrearPagoLuzDto): Promise<PagoLuzResponse> {
    const monto = Number(dto.montoTotalLuz);
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('montoTotalLuz debe ser mayor a 0');
    }

    let fechaPago = new Date();
    if (dto.fechaPago) {
      const parsed = new Date(dto.fechaPago);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('fechaPago debe ser un timestamp valido');
      }
      if (parsed.getTime() > Date.now()) {
        throw new BadRequestException('fechaPago no puede ser futura');
      }
      fechaPago = parsed;
    }

    try {
      const creado = await this.prisma.$transaction(async (tx) => {
        const turno = await tx.turnos.findUnique({
          where: { id: dto.turnoId },
          include: { pagos_luz: { select: { id_pago_luz: true } } },
        });

        if (!turno) {
          throw new NotFoundException('Turno inexistente');
        }
        if (!turno.requiere_luz) {
          throw new UnprocessableEntityException('El turno no requiere luz');
        }
        if (turno.estado_actual === 'cancelado') {
          throw new UnprocessableEntityException('El turno esta cancelado');
        }
        if (turno.pagos_luz.length > 0) {
          throw new ConflictException('Ya existe un pago de luz para este turno');
        }

        return tx.pagos_luz.create({
          data: {
            turno_id: dto.turnoId,
            monto_total_luz: dto.montoTotalLuz,
            fecha_pago: fechaPago,
          },
        });
      });

      return toPagoLuzResponse(creado);
    } catch (error) {
      // Preserve the domain exceptions thrown inside the transaction.
      if (error instanceof HttpException) {
        throw error;
      }
      const code = (error as { code?: string })?.code;
      const pgCode = (error as { meta?: { code?: string } })?.meta?.code;
      if (code === 'P2002' || code === '23505' || pgCode === '23505') {
        throw new ConflictException('Ya existe un pago de luz para este turno');
      }
      throw error;
    }
  }
}