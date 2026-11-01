import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CrearPagoLuzDto } from './dto/crear-pago-luz.dto';
import type { PagoLuzResponse } from './pago-luz-response';
import { PagosLuzService } from './pagos-luz.service';

/**
 * Luz payments (ACT-43, API contract §5.9). POST is admin-only.
 * GET /pagos-luz is implemented by TAR-6.
 */
@ApiTags('Pagos de luz')
@ApiBearerAuth()
@Controller('pagos-luz')
export class PagosLuzController {
  constructor(private readonly pagosLuz: PagosLuzService) {}

  /** Registro del pago verificado del cargo de luz de un turno nocturno (RF-33). */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Registrar el pago verificado del cargo de luz de un turno' })
  @ApiCreatedResponse({ description: 'Pago de luz registrado' })
  async registrar(@Body() dto: CrearPagoLuzDto): Promise<PagoLuzResponse> {
    return this.pagosLuz.registrarPago(dto);
  }
}