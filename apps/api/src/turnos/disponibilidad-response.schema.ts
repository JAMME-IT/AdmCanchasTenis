import { ApiProperty } from '@nestjs/swagger';

/**
 * OpenAPI schema for a single availability slot (API contract §5.3
 * GET /turnos/disponibilidad). Mirrors `SlotDisponibilidad`; keep both in sync.
 */
export class SlotDisponibilidadSchema {
  @ApiProperty({ format: 'uuid', example: '0a1b2c3d-4444-5555-6666-777788889999' })
  canchaId!: string;

  @ApiProperty({ example: 1 })
  nroCancha!: number;

  @ApiProperty({ example: '19:00' })
  horaInicio!: string;

  @ApiProperty({ example: '20:00' })
  horaFin!: string;

  @ApiProperty({ example: false })
  disponible!: boolean;

  @ApiProperty({ example: true })
  requiereLuz!: boolean;

  @ApiProperty({ nullable: true, example: 'Turno confirmado' })
  motivo!: string | null;
}

/**
 * OpenAPI schema for GET /turnos/disponibilidad (API contract §5.3).
 * The response type is an interface, so Swagger cannot introspect it.
 */
export class DisponibilidadSchema {
  @ApiProperty({ example: '2026-09-30' })
  fecha!: string;

  @ApiProperty({ example: 60 })
  duracionMinutos!: number;

  @ApiProperty({ type: [SlotDisponibilidadSchema] })
  slots!: SlotDisponibilidadSchema[];
}
