import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { estado_turno } from '../../generated/prisma/client';

/**
 * PATCH /turnos/:id/estado body (API contract §5.3, ACT-36, CU22).
 *
 * `estado` accepts the FULL `estado_turno` domain
 * (`confirmado|cancelado|iniciado|finalizado|no_asistio`): a syntactically
 * valid token the lifecycle cannot reach (e.g. `cancelado`, or `confirmado`
 * from a terminal state) is rejected by the service with 422, not by the
 * validation pipe, so every rejected attempt gets a transition-specific
 * message. Only tokens outside the domain are a 400.
 * `motivo` is optional and nullable (default null), 1-500 characters.
 */
export class ActualizarEstadoTurnoDto {
  @ApiProperty({
    enum: Object.values(estado_turno),
    description: 'Estado destino del ciclo de vida del turno',
    example: 'iniciado',
  })
  @IsEnum(estado_turno, { message: 'estado invalido' })
  estado!: estado_turno;

  @ApiPropertyOptional({
    description: 'Motivo de la transicion (opcional, nullable)',
    maxLength: 500,
    example: null,
  })
  @IsOptional()
  @IsString({ message: 'motivo debe ser un texto' })
  @MinLength(1, { message: 'motivo no puede estar vacio' })
  @MaxLength(500, { message: 'motivo no puede superar 500 caracteres' })
  motivo?: string | null;
}