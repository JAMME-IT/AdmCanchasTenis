import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { HORA_REGEX } from '../hora';

/**
 * One opening time range (RF-34, API contract §5.6 PUT /config/rangos-horario).
 * `id` is optional: without it the upsert resolves the stored row by `nombre`.
 * `horaFin` must be later than `horaInicio`; that ordering is checked in the
 * service (a single field cannot see its sibling).
 */
export class RangoHorarioDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'id debe ser un UUID valido' })
  id?: string;

  @IsString({ message: 'nombre debe ser un string' })
  @IsNotEmpty({ message: 'nombre no puede estar vacio' })
  @MaxLength(50, { message: 'nombre no puede superar los 50 caracteres' })
  nombre!: string;

  @Matches(HORA_REGEX, { message: 'horaInicio debe tener formato HH:MM' })
  horaInicio!: string;

  @Matches(HORA_REGEX, { message: 'horaFin debe tener formato HH:MM' })
  horaFin!: string;
}

/**
 * PUT /config/rangos-horario body (RF-34): the ranges that replace the stored
 * set in one transaction. Duplicate names and overlapping ranges are rejected
 * in the service (class-validator cannot express cross-item rules cleanly).
 */
export class ActualizarRangosHorarioDto {
  @ArrayNotEmpty({ message: 'rangos no puede estar vacio' })
  @ValidateNested({ each: true })
  @Type(() => RangoHorarioDto)
  rangos!: RangoHorarioDto[];
}
