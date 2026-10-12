import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { superficie_cancha } from '../../generated/prisma/client';

/**
 * PATCH /canchas/:id body (API contract §5.5, ACT-28).
 * Al menos un campo; nunca toca el estado operativo (eso es PATCH /canchas/:id/estado).
 */
export class ActualizarCanchaDto {
  @ApiPropertyOptional({ description: 'Numero de cancha, unico', example: 3, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'nroCancha debe ser un entero' })
  @Min(1, { message: 'nroCancha debe ser mayor o igual a 1' })
  nroCancha?: number;

  @ApiPropertyOptional({
    enum: Object.values(superficie_cancha),
    description: 'Superficie de la cancha',
    example: 'cesped',
  })
  @IsOptional()
  @IsEnum(superficie_cancha, { message: 'superficie invalida' })
  superficie?: superficie_cancha;

  @ApiPropertyOptional({ description: 'Tiene iluminacion', example: false })
  @IsOptional()
  @IsBoolean({ message: 'iluminacion debe ser un booleano' })
  iluminacion?: boolean;
}
