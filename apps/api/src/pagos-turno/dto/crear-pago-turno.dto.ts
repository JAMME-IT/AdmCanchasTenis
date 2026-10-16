import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class LineaPagoTurnoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  montoTurnoPago!: number;
}

export class CrearPagoTurnoDto {
  @IsUUID()
  turnoId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  montoTotalTurno!: number;

  @IsISO8601()
  @IsOptional()
  fechaPago?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineaPagoTurnoDto)
  @IsOptional()
  lineas?: LineaPagoTurnoDto[];
}
