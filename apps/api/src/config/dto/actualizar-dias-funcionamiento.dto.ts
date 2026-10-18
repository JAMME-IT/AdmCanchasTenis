import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsBoolean, IsInt, Max, Min, ValidateNested } from 'class-validator';

/**
 * One operating-day toggle (RF-35, API contract §5.6 PUT /config/dias-funcionamiento).
 * `diaSemana` is ISO-8601: 1 = Monday, ..., 7 = Sunday.
 */
export class DiaFuncionamientoDto {
  @IsInt({ message: 'diaSemana debe ser un entero' })
  @Min(1, { message: 'diaSemana debe estar entre 1 y 7' })
  @Max(7, { message: 'diaSemana debe estar entre 1 y 7' })
  diaSemana!: number;

  @IsBoolean({ message: 'habilitado debe ser booleano' })
  habilitado!: boolean;
}

/**
 * PUT /config/dias-funcionamiento body (RF-35): the days to upsert in one
 * transaction. Duplicates are rejected in the service (class-validator cannot
 * express cross-item uniqueness cleanly).
 */
export class ActualizarDiasFuncionamientoDto {
  @ArrayNotEmpty({ message: 'dias no puede estar vacio' })
  @ValidateNested({ each: true })
  @Type(() => DiaFuncionamientoDto)
  dias!: DiaFuncionamientoDto[];
}
