import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsUUID,
  Matches,
  Min,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Cross-field rule: no-socios are a subset of the players
 * (`ck_turnos_no_socios`). Property-level so it runs on the plain
 * `validate()` path and through the global ValidationPipe alike.
 */
function NoSuperaPersonas(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'noSuperaPersonas',
      target: (object as object).constructor,
      propertyName,
      options: {
        message: 'cantidadNoSocios no puede superar cantidadPersonas',
        ...validationOptions,
      },
      validator: {
        validate(_valor: unknown, args: ValidationArguments): boolean {
          const dto = args.object as CrearTurnoDto;
          return dto.cantidadNoSocios <= dto.cantidadPersonas;
        },
      },
    });
  };
}

/**
 * POST /turnos body (API contract §5.3, ACT-34, RF-12/RF-13/RF-39).
 * The client never sends amounts: `horaFin`, `costoTurnoNs` and
 * `cargoLuzCompartido` are computed by the server.
 */
export class CrearTurnoDto {
  @ApiProperty({ description: 'Cancha existente y disponible', format: 'uuid' })
  @IsUUID('all', { message: 'canchaId debe ser un UUID valido' })
  canchaId!: string;

  @ApiProperty({ description: 'Dia reservado (hora local del club)', example: '2026-09-30' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha!: string;

  @ApiProperty({ description: 'Inicio del turno (hora local del club)', example: '19:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'horaInicio debe tener formato HH:MM' })
  horaInicio!: string;

  @ApiProperty({ description: 'Tipo de turno existente (60/90); define horaFin', format: 'uuid' })
  @IsUUID('all', { message: 'tipoTurnoId debe ser un UUID valido' })
  tipoTurnoId!: string;

  @ApiProperty({ example: 4, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'cantidadPersonas debe ser un entero' })
  @Min(1, { message: 'cantidadPersonas debe ser mayor o igual a 1' })
  cantidadPersonas!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  @Type(() => Number)
  @IsInt({ message: 'cantidadNoSocios debe ser un entero' })
  @Min(0, { message: 'cantidadNoSocios debe ser mayor o igual a 0' })
  @NoSuperaPersonas()
  cantidadNoSocios!: number;

  @ApiProperty({ description: 'Si es true, la cancha debe tener iluminacion', example: false })
  @IsBoolean({ message: 'requiereLuz debe ser un booleano' })
  requiereLuz!: boolean;
}
