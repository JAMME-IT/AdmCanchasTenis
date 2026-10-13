import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

/** GET /turnos/mios query (API contract §5.3, ACT-38, RF-36/CU24). */
export class ConsultarMisTurnosDto {
  @ApiPropertyOptional({ description: 'Dia consultado (hora local del club)', example: '2026-09-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha?: string;

  @ApiPropertyOptional({
    description: 'Filtra por estado vigente; si se omite, confirmado e iniciado',
    enum: ['confirmado', 'iniciado'],
  })
  @IsOptional()
  @IsIn(['confirmado', 'iniciado'], { message: 'estadoActual debe ser confirmado o iniciado' })
  estadoActual?: 'confirmado' | 'iniciado';
}
