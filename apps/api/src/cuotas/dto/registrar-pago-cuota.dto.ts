import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * POST /cuotas/:id/pagos body (API contract §5.7, ACT-40, RF-21/RF-42, RN-3).
 * Monto siempre > 0 y <= saldo pendiente (verificado en el servicio).
 * fechaPago por defecto now(); nunca futura (verificado en el servicio).
 */
export class RegistrarPagoCuotaDto {
  @ApiProperty({ description: 'Monto del pago, debe ser > 0 y <= saldo pendiente', example: 5000 })
  @Type(() => Number)
  @IsNumber({}, { message: 'monto debe ser un numero' })
  @Min(0.01, { message: 'monto debe ser mayor a 0' })
  monto!: number;

  @ApiProperty({ description: 'Fecha del pago, por defecto now()', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'fechaPago debe ser un timestamp valido' })
  fechaPago?: string;
}
