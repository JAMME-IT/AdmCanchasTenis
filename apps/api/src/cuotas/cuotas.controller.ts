import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CuotasService } from './cuotas.service';
import { RegistrarPagoCuotaDto } from './dto/registrar-pago-cuota.dto';

@ApiTags('Cuotas')
@ApiBearerAuth()
@Controller('cuotas')
export class CuotasController {
  constructor(private readonly cuotas: CuotasService) {}

  /** Payment registration with partial support (ACT-40, RF-21/RF-42, RN-3). */
  @Post(':id/pagos')
  @Roles('admin')
  @ApiOperation({ summary: 'Registrar un pago total o parcial de la cuota' })
  @ApiCreatedResponse({ description: 'Pago registrado con estado recalculado' })
  async registrarPago(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RegistrarPagoCuotaDto,
  ) {
    return this.cuotas.registrarPago(id, dto);
  }
}
