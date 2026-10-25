import { ApiProperty } from '@nestjs/swagger';

/**
 * OpenAPI schema for `RangoHorarioResponse` (API contract §5.6, RF-34).
 * The response type is an interface, so Swagger cannot introspect it; keep both
 * in sync.
 */
export class RangoHorarioSchema {
  @ApiProperty({ format: 'uuid', example: '3f2b7c1e-5a4d-4c8e-9f6a-1b2c3d4e5f60' })
  id!: string;

  @ApiProperty({ maxLength: 50, example: 'apertura' })
  nombre!: string;

  @ApiProperty({ example: '08:00', description: 'Hora de inicio HH:MM' })
  horaInicio!: string;

  @ApiProperty({ example: '22:00', description: 'Hora de fin HH:MM (exclusiva)' })
  horaFin!: string;
}
