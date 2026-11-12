import { IsISO8601, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * POST /pagos-luz body (ACT-43, RF-33).
 * The payment is already verified by the admin; `fechaPago` is optional and the
 * service rejects a future timestamp (a field-level rule cannot compare to now()).
 */
export class CrearPagoLuzDto {
  @IsUUID()
  turnoId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'montoTotalLuz debe ser mayor a 0' })
  montoTotalLuz!: number;

  @IsISO8601()
  @IsOptional()
  fechaPago?: string;
}