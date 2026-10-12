import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * GET /canchas query (API contract §5.5, ACT-29).
 * `conEstados` (default false, admin only) adds the `estados` history.
 */
export class ListarCanchasDto {
  @ApiPropertyOptional({
    description: 'Agrega el historial de estados (solo admin)',
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsBoolean({ message: 'conEstados debe ser un booleano' })
  conEstados?: boolean;
}
