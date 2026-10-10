import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { estado_cancha } from '../../generated/prisma/client';

/**
 * PATCH /canchas/:id/estado body (API contract §5.5, ACT-28, RF-17).
 * `motivo` es obligatorio cuando `estado != disponible` (verificado en el servicio);
 * siempre entre 1 y 500 caracteres.
 */
export class CambiarEstadoCanchaDto {
  @ApiProperty({
    enum: Object.values(estado_cancha),
    description: 'Estado operativo nuevo',
    example: 'en_mantenimiento',
  })
  @IsEnum(estado_cancha, { message: 'estado invalido' })
  estado!: estado_cancha;

  @ApiPropertyOptional({
    description: 'Motivo del cambio; obligatorio si estado != disponible',
    maxLength: 500,
    example: 'Riego programado',
  })
  @IsOptional()
  @IsString({ message: 'motivo debe ser un texto' })
  @MaxLength(500, { message: 'motivo no puede superar 500 caracteres' })
  motivo?: string;
}
