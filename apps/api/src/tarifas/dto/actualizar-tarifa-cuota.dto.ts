import { IsNumber, Min } from 'class-validator';

/**
 * New monthly membership tariff (RF-29, API contract §5.8 PUT /tarifas/cuota).
 * Append-only: inserts a new row in valores_cuota; historic tariffs are untouched.
 */
export class ActualizarTarifaCuotaDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'precio debe ser un numero con hasta 2 decimales' })
  @Min(0, { message: 'precio no puede ser negativo' })
  precio!: number;
}