import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

/**
 * GET /pagos-luz query (ACT-43, RF-44).
 * All filters are optional. `usuarioId` filters through the turno relation;
 * `desde`/`hasta` bound `fecha_pago`. Date validity is re-checked in the
 * service so the domain error is a 400 even for values that bypass the pipe.
 */
export class ConsultarPagosLuzDto {
  @IsOptional()
  @IsUUID()
  turnoId?: string;

  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;
}