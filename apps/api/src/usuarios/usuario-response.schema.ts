import { ApiProperty } from '@nestjs/swagger';
import { estado_usuario, rol_nombre } from '../generated/prisma/client';

/**
 * OpenAPI schema for UsuarioResponse (API contract §5.0). The response type is
 * an interface, so Swagger cannot introspect it; keep both in sync.
 */
export class UsuarioSchema {
  @ApiProperty({ format: 'uuid', example: '8f14e45f-ea2b-4c3d-9a1b-2c3d4e5f6a7b' })
  id!: string;

  @ApiProperty({ example: 'jperez' })
  username!: string;

  @ApiProperty({ example: 'jperez@example.com' })
  email!: string;

  @ApiProperty({ example: 'Juan' })
  nombre!: string;

  @ApiProperty({ example: 'Perez' })
  apellido!: string;

  @ApiProperty({ nullable: true, example: '3454123456' })
  telefono!: string | null;

  @ApiProperty({ example: '30123456' })
  dni!: string;

  @ApiProperty({ enum: Object.values(estado_usuario), example: 'activo' })
  estadoActual!: string;

  @ApiProperty({ enum: Object.values(rol_nombre), nullable: true, example: 'socio' })
  rol!: string | null;

  @ApiProperty({ nullable: true, example: 'S-0001' })
  numeroSocio!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
