import { ApiProperty } from '@nestjs/swagger';

/**
 * OpenAPI schema for `DiaFuncionamientoResponse` (API contract §5.6, RF-35).
 * The response type is an interface, so Swagger cannot introspect it; keep both
 * in sync.
 */
export class DiaFuncionamientoSchema {
  @ApiProperty({ minimum: 1, maximum: 7, example: 1, description: 'Dia ISO-8601 (1 = lunes ... 7 = domingo)' })
  diaSemana!: number;

  @ApiProperty({ example: true })
  habilitado!: boolean;
}
