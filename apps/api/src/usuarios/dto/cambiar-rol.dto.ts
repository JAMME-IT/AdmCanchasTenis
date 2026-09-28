import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { rol_nombre } from '../../generated/prisma/client';

/** PATCH /usuarios/:id/rol body (API contract §5.2, RF-3). */
export class CambiarRolDto {
  @ApiProperty({
    enum: Object.values(rol_nombre),
    description: 'Rol vigente nuevo; debe ser distinto del actual',
    example: 'socio',
  })
  @IsEnum(rol_nombre)
  rol!: rol_nombre;

  @ApiPropertyOptional({
    description: 'Solo con rol socio: numero existente; omitido, la API genera el correlativo',
    example: 'S-0007',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroSocio?: string;
}
