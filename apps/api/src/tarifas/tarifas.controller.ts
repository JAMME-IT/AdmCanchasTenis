import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ActualizarTarifaCuotaDto } from './dto/actualizar-tarifa-cuota.dto';
import type { ActualizarTarifaTurnoDto } from './dto/actualizar-tarifa-turno.dto';
import type {
  TarifaCuotaResponse,
  TarifaTurnoResponse,
  TarifasResponse,
} from './tarifa-response';
import { TarifasService } from './tarifas.service';

/**
 * Tarifas endpoints (API contract §5.8). PUT is admin-only; GET is open to any
 * authenticated role (RF-43). Global prefix /api applies (main.ts).
 */
@Controller('tarifas')
export class TarifasController {
  constructor(private readonly tarifas: TarifasService) {}

  @Get()
  obtenerVigentes(): Promise<TarifasResponse> {
    return this.tarifas.obtenerVigentes();
  }

  @Put('turno')
  @Roles('admin')
  actualizarTarifaTurno(@Body() dto: ActualizarTarifaTurnoDto): Promise<TarifaTurnoResponse> {
    return this.tarifas.actualizarTarifaTurno(dto);
  }

  @Put('cuota')
  @Roles('admin')
  actualizarTarifaCuota(@Body() dto: ActualizarTarifaCuotaDto): Promise<TarifaCuotaResponse> {
    return this.tarifas.actualizarTarifaCuota(dto);
  }
}