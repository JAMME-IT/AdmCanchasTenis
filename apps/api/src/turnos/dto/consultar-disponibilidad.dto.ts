import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** GET /turnos/disponibilidad query (API contract §5.3, ACT-33). */
export class ConsultarDisponibilidadDto {
  @ApiPropertyOptional({ description: 'Dia consultado (hora local del club)', example: '2026-09-30' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha!: string;

  @ApiPropertyOptional({
    description: 'Filtra por cancha; si se omite, todas las canchas',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'canchaId debe ser un UUID valido' })
  canchaId?: string;

  @ApiPropertyOptional({
    description:
      'Tipo de turno (define la duracion del slot); si se omite, 60 min lunes-viernes y 90 min fines de semana',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'tipoTurnoId debe ser un UUID valido' })
  tipoTurnoId?: string;
}
