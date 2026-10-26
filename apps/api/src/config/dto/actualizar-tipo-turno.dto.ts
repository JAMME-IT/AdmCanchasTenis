import { IsInt, Max, Min } from 'class-validator';

/**
 * PATCH /config/tipos-turno/:id body (ACT-32, RF-15): the new shift duration in
 * minutes. The 15..240 range is an explicit product assumption (see the feature
 * doc); adjust it here if the club defines another policy.
 */
export class ActualizarTipoTurnoDto {
  @IsInt({ message: 'duracionMinutos debe ser un entero' })
  @Min(15, { message: 'duracionMinutos debe estar entre 15 y 240' })
  @Max(240, { message: 'duracionMinutos debe estar entre 15 y 240' })
  duracionMinutos!: number;
}
