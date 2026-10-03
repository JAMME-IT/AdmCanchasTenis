import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { ConsultarEstadisticasDto } from './dto/consultar-estadisticas.dto';
import type { EstadisticasResponse } from './estadisticas-response';
import type { FinancieroResponse } from './financiero-response';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  /** General club metrics for the admin panel (ACT-45, RF-32, contract §5.10). */
  @Get('estadisticas')
  @Roles('admin')
  @ApiOperation({ summary: 'Estadisticas generales del club (admin)' })
  @ApiQuery({ name: 'desde', required: false, description: 'Periodo desde, inclusive', example: '2026-09-01' })
  @ApiQuery({ name: 'hasta', required: false, description: 'Periodo hasta, inclusive', example: '2026-09-30' })
  @ApiOkResponse({ description: 'Estadisticas del periodo con forma §5.10' })
  async estadisticas(@Query() query: ConsultarEstadisticasDto): Promise<EstadisticasResponse> {
    return this.reportes.obtenerEstadisticas(query);
  }

  /** Financial metrics for the admin panel (ACT-46, RF-45, contract §5.10). */
  @Get('financiero')
  @Roles('admin')
  @ApiOperation({ summary: 'Metricas financieras del club (admin)' })
  @ApiQuery({ name: 'desde', required: false, description: 'Periodo desde, inclusive', example: '2026-09-01' })
  @ApiQuery({ name: 'hasta', required: false, description: 'Periodo hasta, inclusive', example: '2026-09-30' })
  @ApiOkResponse({ description: 'Metricas financieras del periodo con forma §5.10' })
  async financiero(@Query() query: ConsultarEstadisticasDto): Promise<FinancieroResponse> {
    return this.reportes.obtenerFinanciero(query);
  }
}
