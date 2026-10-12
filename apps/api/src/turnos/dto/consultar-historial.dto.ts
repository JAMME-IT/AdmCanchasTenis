import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

/** GET /turnos/mios/historial query (API contract §5.3, ACT-38, RF-18/CU5). */
export class ConsultarHistorialDto {
  @ApiPropertyOptional({ description: 'Desde que dia (inclusive, hora local del club)', example: '2026-09-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'desde debe tener formato YYYY-MM-DD' })
  desde?: string;

  @ApiPropertyOptional({ description: 'Hasta que dia (inclusive, hora local del club)', example: '2026-09-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'hasta debe tener formato YYYY-MM-DD' })
  hasta?: string;

  @ApiPropertyOptional({
    description: 'Filtra por estado del historial; si se omite, finalizado',
    enum: ['finalizado', 'no_asistio', 'cancelado'],
  })
  @IsOptional()
  @IsIn(['finalizado', 'no_asistio', 'cancelado'], {
    message: 'estadoActual debe ser finalizado, no_asistio o cancelado',
  })
  estadoActual?: 'finalizado' | 'no_asistio' | 'cancelado';
}
