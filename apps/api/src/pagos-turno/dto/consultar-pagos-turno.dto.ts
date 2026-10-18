import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ConsultarPagosTurnoDto {
  @IsUUID()
  @IsOptional()
  turnoId?: string;

  @IsUUID()
  @IsOptional()
  usuarioId?: string;

  @IsDateString()
  @IsOptional()
  desde?: string;

  @IsDateString()
  @IsOptional()
  hasta?: string;
}
