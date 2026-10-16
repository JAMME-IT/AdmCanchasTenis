import { IsEnum } from 'class-validator';

export class ActualizarEstadoPagoTurnoDto {
  @IsEnum(['impago', 'pago'], {
    message: 'estadoPago debe ser "impago" o "pago"',
  })
  estadoPago!: 'impago' | 'pago';
}
