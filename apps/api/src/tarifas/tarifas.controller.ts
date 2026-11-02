import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActualizarTarifaCuotaDto } from './dto/actualizar-tarifa-cuota.dto';
import { ActualizarTarifaTurnoDto } from './dto/actualizar-tarifa-turno.dto';
import { ConsultarHistorialTarifasDto } from './dto/consultar-historial-tarifas.dto';
import type {
  TarifaCuotaResponse,
  TarifaHistorialItemResponse,
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

  @Get('historial')
  @Roles('admin')
  obtenerHistorial(
    @Query() dto: ConsultarHistorialTarifasDto,
  ): Promise<TarifaHistorialItemResponse[]> {
    return this.tarifas.obtenerHistorial(dto);
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