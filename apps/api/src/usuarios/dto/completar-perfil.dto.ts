import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/** Domain sign-up after the Clerk sign-up (RF-1, API contract §5.2). */
export class CompletarPerfilDto {
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username solo admite letras, numeros, punto, guion y guion bajo',
  })
  username!: string;

  @IsString()
  @Length(1, 100)
  nombre!: string;

  @IsString()
  @Length(1, 100)
  apellido!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsString()
  @Length(1, 15)
  dni!: string;
}
