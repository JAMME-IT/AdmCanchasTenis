import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CuotasService } from './cuotas.service';
import { RegistrarPagoCuotaDto } from './dto/registrar-pago-cuota.dto';
import type { MiCuotaResponse } from './mi-cuota-response';

@ApiTags('Cuotas')
@ApiBearerAuth()
@Controller('cuotas')
export class CuotasController {
  constructor(private readonly cuotas: CuotasService) {}

  /** Socio: sus cuotas con pagos (ACT-48, RF-26/CU14). Antes de `:id` para no colisionar. */
  @Get('mias')
  @Roles('socio')
  @ApiOperation({ summary: 'Cuotas del socio autenticado con sus pagos' })
  @ApiOkResponse({ description: 'Cuotas propias con pagos y saldo calculado' })
  async mias(@CurrentAuth() auth: AuthContext): Promise<MiCuotaResponse[]> {
    return this.cuotas.obtenerMias(auth);
  }

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
