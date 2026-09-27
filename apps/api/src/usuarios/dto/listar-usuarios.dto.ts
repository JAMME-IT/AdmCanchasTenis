import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { estado_usuario, rol_nombre } from '../../generated/prisma/client';

/** GET /usuarios query filters (API contract §5.2, RF-9, RF-10, RF-11). */
export class ListarUsuariosDto {
  @ApiPropertyOptional({ description: 'ILIKE sobre apellido y nombre', example: 'perez' })
  @IsOptional()
  @IsString()
  busqueda?: string;

  @ApiPropertyOptional({
    enum: Object.values(estado_usuario),
    description: 'Filtra por estado vigente',
  })
  @IsOptional()
  @IsEnum(estado_usuario)
  estado?: estado_usuario;

  @ApiPropertyOptional({
    enum: Object.values(rol_nombre),
    description: 'Filtra por el rol vigente en usuarios_roles',
  })
  @IsOptional()
  @IsEnum(rol_nombre)
  rol?: rol_nombre;
}
