import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { superficie_cancha } from '../../generated/prisma/client';

/**
 * POST /canchas body (API contract §5.5, ACT-28).
 * Crea la cancha en `disponible` con su fila inicial de historial.
 */
export class CrearCanchaDto {
  @ApiProperty({ description: 'Numero de cancha, unico', example: 3, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'nroCancha debe ser un entero' })
  @Min(1, { message: 'nroCancha debe ser mayor o igual a 1' })
  nroCancha!: number;

  @ApiProperty({
    enum: Object.values(superficie_cancha),
    description: 'Superficie de la cancha',
    example: 'polvo_de_ladrillo',
  })
  @IsEnum(superficie_cancha, { message: 'superficie invalida' })
  superficie!: superficie_cancha;

  @ApiPropertyOptional({ description: 'Tiene iluminacion', default: true, example: true })
  @IsOptional()
  @IsBoolean({ message: 'iluminacion debe ser un booleano' })
  iluminacion?: boolean;
}
