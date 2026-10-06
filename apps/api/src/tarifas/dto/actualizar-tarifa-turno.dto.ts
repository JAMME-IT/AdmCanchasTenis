import { IsNumber, Min } from 'class-validator';

/**
 * New hourly court tariff (RF-27, API contract §5.8 PUT /tarifas/turno).
 * Append-only: inserts a new row in valores_turno; historic tariffs are untouched.
 */
export class ActualizarTarifaTurnoDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'costoXHora debe ser un numero con hasta 2 decimales' })
  @Min(0, { message: 'costoXHora no puede ser negativo' })
  costoXHora!: number;
}