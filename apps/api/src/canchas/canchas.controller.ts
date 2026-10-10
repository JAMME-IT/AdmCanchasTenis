import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { CanchaResponse } from './cancha-response';
import { CanchaSchema } from './cancha-response.schema';
import { CanchasService } from './canchas.service';
import { ListarCanchasDto } from './dto/listar-canchas.dto';

@ApiTags('Canchas')
@ApiBearerAuth()
@Controller('canchas')
export class CanchasController {
  constructor(private readonly canchas: CanchasService) {}

  /** Court catalog for booking screens and the admin state viewer (ACT-29, RF-12/RF-17). */
  @Get()
  @Roles('admin', 'socio', 'no_socio')
  @ApiOperation({ summary: 'Catalogo de canchas con su estado operativo vigente' })
  @ApiQuery({
    name: 'conEstados',
    required: false,
    type: Boolean,
    description: 'Agrega el historial de estados de cada cancha (solo admin)',
  })
  @ApiOkResponse({ type: [CanchaSchema] })
  async listar(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListarCanchasDto,
  ): Promise<CanchaResponse[]> {
    return this.canchas.listar(auth, query);
  }
}
