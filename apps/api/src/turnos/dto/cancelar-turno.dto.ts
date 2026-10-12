import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/**
 * POST /turnos/:id/cancelar body (API contract §5.3, ACT-35, RF-14/RF-40):
 * el motivo se persiste en `estados_turno.motivo` dentro de la misma
 * transaccion que actualiza el cache `turnos.estado_actual` a `cancelado`.
 */
export class CancelarTurnoDto {
  @ApiProperty({ description: 'Motivo de la cancelacion (RN-1)', example: 'Lesion' })
  @IsString({ message: 'motivo debe ser un texto' })
  @Length(1, 500, { message: 'motivo debe tener entre 1 y 500 caracteres' })
  motivo!: string;
}