import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CrearPagoTurnoDto } from './dto/crear-pago-turno.dto';
import { ConsultarPagosTurnoDto } from './dto/consultar-pagos-turno.dto';
import type { PagoTurnoResponse } from './pago-turno-response';
import { PagosTurnoService } from './pagos-turno.service';

@ApiTags('Pagos de turno')
@ApiBearerAuth()
@Controller('pagos-turno')
export class PagosTurnoController {
  constructor(private readonly pagosTurno: PagosTurnoService) {}

  /** Registro de pago verificado de turno de no socio (ACT-54, RF-19/RF-42). */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Registrar el pago verificado de un turno' })
  @ApiCreatedResponse({ description: 'Pago registrado con expansión de turno y usuario' })
  async registrar(@Body() dto: CrearPagoTurnoDto): Promise<PagoTurnoResponse> {
    return this.pagosTurno.registrarPago(dto);
  }

  /** Listado de pagos de turno con filtros (ACT-54, RF-19). */
  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listar pagos de turno con filtros opcionales' })
  @ApiOkResponse({ description: 'Array de pagos con expansión de turno y usuario' })
  async listar(@Query() dto: ConsultarPagosTurnoDto): Promise<PagoTurnoResponse[]> {
    return this.pagosTurno.listar(dto);
  }
}
