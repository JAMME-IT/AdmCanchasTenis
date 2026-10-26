import { ApiProperty } from '@nestjs/swagger';

/**
 * OpenAPI schema for `TipoTurnoResponse` (ACT-32, RF-15). The response type is
 * an interface, so Swagger cannot introspect it; keep both in sync.
 */
export class TipoTurnoSchema {
  @ApiProperty({ format: 'uuid', example: '0a1b2c3d-4444-5555-6666-777788889999' })
  id!: string;

  @ApiProperty({ example: 75, minimum: 15, maximum: 240 })
  duracionMinutos!: number;
}
