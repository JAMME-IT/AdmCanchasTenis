import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/** Domain sign-up after the Clerk sign-up (RF-1, API contract §5.2). */
export class CompletarPerfilDto {
  @ApiProperty({
    description: 'Minusculas, sin espacios',
    example: 'jperez',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username solo admite letras, numeros, punto, guion y guion bajo',
  })
  username!: string;

  @ApiProperty({ example: 'Juan', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  nombre!: string;

  @ApiProperty({ example: 'Perez', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  apellido!: string;

  @ApiPropertyOptional({ example: '3454123456', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiProperty({ example: '30123456', maxLength: 15 })
  @IsString()
  @Length(1, 15)
  dni!: string;
}
