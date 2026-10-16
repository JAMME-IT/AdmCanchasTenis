import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/** GET /turnos query (API contract §5.3, ACT-37, RF-36/RF-37/RF-38). */
export class ListarTurnosAdminDto {
  @ApiPropertyOptional({
    description: 'Busca por nombre o apellido del usuario (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  busqueda?: string;

  @ApiPropertyOptional({ description: 'Dia exacto consultado (hora local del club)', example: '2026-10-15' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha?: string;

  @ApiPropertyOptional({ description: 'Desde que dia (inclusive, hora local del club)', example: '2026-10-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'desde debe tener formato YYYY-MM-DD' })
  desde?: string;

  @ApiPropertyOptional({ description: 'Hasta que dia (inclusive, hora local del club)', example: '2026-10-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'hasta debe tener formato YYYY-MM-DD' })
  hasta?: string;
}
