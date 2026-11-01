import { IsIn, IsISO8601, IsNumber, IsOptional, Min } from 'class-validator';

export type TipoTarifaHistorial = 'turno' | 'luz' | 'cuota';

/**
 * GET /tarifas/historial query (ACT-44, RF-30/RF-31).
 * `tipo` narrows the source (default: all three). `desde`/`hasta` bound the
 * change date and `montoMin`/`montoMax` bound the amount. Date validity is
 * re-checked in the service so the domain error is a 400.
 */
export class ConsultarHistorialTarifasDto {
  @IsOptional()
  @IsIn(['turno', 'luz', 'cuota'], { message: 'tipo debe ser turno, luz o cuota' })
  tipo?: TipoTarifaHistorial;

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'montoMin no puede ser negativo' })
  montoMin?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'montoMax no puede ser negativo' })
  montoMax?: number;
}