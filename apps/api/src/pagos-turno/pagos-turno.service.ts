import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CrearPagoTurnoDto } from './dto/crear-pago-turno.dto';
import type { ConsultarPagosTurnoDto } from './dto/consultar-pagos-turno.dto';
import { toPagoTurnoResponse, type PagoTurnoResponse } from './pago-turno-response';
import type { pagos_turno, Prisma } from '../generated/prisma/client';

@Injectable()
export class PagosTurnoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra el pago verificado de un turno (ACT-54, API contract §5.4 POST /pagos-turno).
   * Valida turno existente y no cancelado, monto > 0, sin pago previo (409).
   * Si vienen líneas, valida que la suma iguale el monto total.
   * En una transacción: crea pagos_turno + lineas_pago_turno, actualiza estado_pago del turno
   * a 'pago', e inserta transición en estados_turno.
   */
  async registrarPago(dto: CrearPagoTurnoDto): Promise<PagoTurnoResponse> {
    const montoTotal = Number(dto.montoTotalTurno);
    if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
      throw new BadRequestException('montoTotalTurno debe ser mayor a 0');
    }

    // Validar líneas si vienen
    if (dto.lineas && dto.lineas.length > 0) {
      const sumaLineas = dto.lineas.reduce((acc, l) => {
        const monto = Number(l.montoTurnoPago);
        if (!Number.isFinite(monto) || monto <= 0) {
          throw new BadRequestException('Cada línea debe tener montoTurnoPago > 0');
        }
        return acc + monto;
      }, 0);
      if (Math.abs(sumaLineas - montoTotal) > 0.001) {
        throw new BadRequestException('La suma de líneas debe igualar el montoTotalTurno');
      }
    }

    // Validar fechaPago si viene
    let fechaPago = new Date();
    if (dto.fechaPago) {
      const parsed = new Date(dto.fechaPago);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('fechaPago debe ser un timestamp válido');
      }
      if (parsed.getTime() > Date.now()) {
        throw new BadRequestException('fechaPago no puede ser futura');
      }
      fechaPago = parsed;
    }

    // Verificar turno existente y no cancelado
    const turno = await this.prisma.turnos.findUnique({
      where: { id: dto.turnoId },
      include: {
        pagos_turno: { select: { id: true } },
      },
    });

    if (!turno) {
      throw new NotFoundException('Turno inexistente');
    }

    if (turno.estado_actual === 'cancelado') {
      throw new UnprocessableEntityException('El turno está cancelado');
    }

    // Verificar que no exista pago previo (409)
    if (turno.pagos_turno.length > 0) {
      throw new ConflictException('Ya existe un pago registrado para este turno');
    }

    // Transacción: crear pago + líneas + actualizar estado_pago + historial
    const creado = await this.prisma.$transaction(async (tx) => {
      const pagoTurno = await tx.pagos_turno.create({
        data: {
          turno_id: dto.turnoId,
          monto_total_turno: dto.montoTotalTurno,
          fecha_pago: fechaPago,
        },
      });

      // Crear líneas si vienen
      if (dto.lineas && dto.lineas.length > 0) {
        await tx.lineas_pago_turno.createMany({
          data: dto.lineas.map((l) => ({
            pago_turno_id: pagoTurno.id,
            monto_turno_pago: l.montoTurnoPago,
          })),
        });
      }

      // Actualizar estado_pago del turno a 'pago'
      const turnoActualizado = await tx.turnos.update({
        where: { id: dto.turnoId },
        data: {
          estado_pago: 'pago',
          updated_at: new Date(),
        },
      });

      // Insertar transición en estados_turno (snapshot combinado)
      await tx.estados_turno.create({
        data: {
          turno_id: dto.turnoId,
          valor_estado: turnoActualizado.estado_actual,
          valor_estado_pago: 'pago',
        },
      });

      return pagoTurno.id;
    });

    // Retornar el pago creado con expansiones
    const pagoCompleto = await this.prisma.pagos_turno.findUnique({
      where: { id: creado },
      include: {
        turnos: {
          include: {
            usuarios: {
              include: {
                socios: true,
              },
            },
          },
        },
        lineas_pago_turno: true,
      },
    });

    if (!pagoCompleto) {
      throw new NotFoundException('Pago inexistente');
    }

    return toPagoTurnoResponse(pagoCompleto);
  }

  /**
   * Listado de pagos de turno con filtros (ACT-54, API contract §5.4 GET /pagos-turno).
   * Filtros opcionales: turnoId, usuarioId, desde/hasta (rango de fecha_pago).
   * Solo admin. Devuelve array con expansión de turno y usuario.
   */
  async listar(dto: ConsultarPagosTurnoDto): Promise<PagoTurnoResponse[]> {
    const where: Prisma.pagos_turnoWhereInput = {};

    if (dto.turnoId) {
      where.turno_id = dto.turnoId;
    }

    if (dto.usuarioId) {
      where.turnos = {
        usuario_id: dto.usuarioId,
      };
    }

    if (dto.desde || dto.hasta) {
      where.fecha_pago = {};
      if (dto.desde) {
        const parsed = new Date(dto.desde);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('desde debe ser una fecha válida');
        }
        where.fecha_pago.gte = parsed;
      }
      if (dto.hasta) {
        const parsed = new Date(dto.hasta);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('hasta debe ser una fecha válida');
        }
        where.fecha_pago.lte = parsed;
      }
    }

    const pagos = await this.prisma.pagos_turno.findMany({
      where,
      include: {
        turnos: {
          include: {
            usuarios: {
              include: {
                socios: true,
              },
            },
          },
        },
        lineas_pago_turno: true,
      },
      orderBy: [{ fecha_pago: 'desc' }],
    });

    return pagos.map(toPagoTurnoResponse);
  }
}
