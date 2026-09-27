import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { estado_usuario } from '../../generated/prisma/client';

/** Admin edit of a user (RF-5, RN-4; API contract §5.2 PATCH /usuarios/:id). */
export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Juan', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Perez', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  apellido?: string;

  @ApiPropertyOptional({ example: '3454123456', maxLength: 30, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string | null;

  @ApiPropertyOptional({ example: '30123456', maxLength: 15 })
  @IsOptional()
  @IsString()
  @Length(1, 15)
  dni?: string;

  @ApiPropertyOptional({
    enum: Object.values(estado_usuario),
    description: 'Estado del usuario (RN-4: solo admin); si cambia, deja historial',
  })
  @IsOptional()
  @IsEnum(estado_usuario)
  estadoActual?: estado_usuario;
}
