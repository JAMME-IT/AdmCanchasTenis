import { ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/**
 * Own-profile edit (RF-6; API contract §5.2 PATCH /usuarios/me).
 * email/dni/estadoActual/rol are not editable here: sending any of them is 400.
 * They carry no ApiProperty on purpose, so they do not show up as valid fields.
 */
export class ActualizarPerfilDto {
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

  @ApiPropertyOptional({
    description: 'Minusculas, sin espacios',
    example: 'jperez',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username solo admite letras, numeros, punto, guion y guion bajo',
  })
  username?: string;

  @Equals(undefined, { message: 'email no se edita por API: su fuente es Clerk' })
  email?: never;

  @Equals(undefined, { message: 'dni no se edita en el perfil propio' })
  dni?: never;

  @Equals(undefined, { message: 'estadoActual solo lo cambia un administrador' })
  estadoActual?: never;

  @Equals(undefined, { message: 'rol no se edita por API en este endpoint' })
  rol?: never;
}
