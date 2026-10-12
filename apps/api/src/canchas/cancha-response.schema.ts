import { ApiProperty } from '@nestjs/swagger';
import { estado_cancha, superficie_cancha } from '../generated/prisma/client';

/**
 * OpenAPI schema for one `estados_cancha` history row (API contract §5.5).
 * Mirrors `EstadoCanchaResponse`; keep both in sync.
 */
export class CanchaEstadoSchema {
  @ApiProperty({ enum: Object.values(estado_cancha), example: 'disponible' })
  valorState!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  fechaCambio!: string;

  @ApiProperty({ nullable: true, example: 'Riego programado' })
  motivo!: string | null;
}

/**
 * OpenAPI schema for `CanchaResponse` (API contract §5.0/§5.5). The response
 * type is an interface, so Swagger cannot introspect it; keep both in sync.
 * `estados` is only returned by GET /canchas?conEstados=true (admin).
 */
export class CanchaSchema {
  @ApiProperty({ format: 'uuid', example: '0a1b2c3d-4444-5555-6666-777788889999' })
  id!: string;

  @ApiProperty({ example: 1 })
  nroCancha!: number;

  @ApiProperty({ enum: Object.values(superficie_cancha), example: 'polvo_de_ladrillo' })
  superficie!: string;

  @ApiProperty({ example: true })
  iluminacion!: boolean;

  @ApiProperty({ enum: Object.values(estado_cancha), example: 'disponible' })
  estadoActual!: string;

  @ApiProperty({ type: [CanchaEstadoSchema], required: false })
  estados?: CanchaEstadoSchema[];
}
