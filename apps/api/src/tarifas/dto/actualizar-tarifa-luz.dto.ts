import { IsNumber, IsOptional, Matches, Min } from 'class-validator';
import { HORA_REGEX } from '../../config/hora';

/**
 * PUT /tarifas/luz body (ACT-43, RF-16/RF-28).
 * `costoXHora` is required. The lighting window is optional, but when present
 * both ends must be sent and `franjaHorarioFin > franjaHorarioInicio`; the
 * cross-field rule is enforced in the service (a single field cannot see its
 * sibling), matching the `rangos-horario` convention.
 */
export class ActualizarTarifaLuzDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'costoXHora debe ser un numero con hasta 2 decimales' })
  @Min(0, { message: 'costoXHora no puede ser negativo' })
  costoXHora!: number;

  @IsOptional()
  @Matches(HORA_REGEX, { message: 'franjaHorarioInicio debe tener formato HH:MM' })
  franjaHorarioInicio?: string;

  @IsOptional()
  @Matches(HORA_REGEX, { message: 'franjaHorarioFin debe tener formato HH:MM' })
  franjaHorarioFin?: string;
}