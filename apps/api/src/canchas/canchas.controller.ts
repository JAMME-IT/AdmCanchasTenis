import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { CanchaResponse } from './cancha-response';
import { CanchaSchema } from './cancha-response.schema';
import { CanchasService } from './canchas.service';
import { ActualizarCanchaDto } from './dto/actualizar-cancha.dto';
import { CambiarEstadoCanchaDto } from './dto/cambiar-estado-cancha.dto';
import { CrearCanchaDto } from './dto/crear-cancha.dto';
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

  /** Court creation (ACT-28, RF-12). */
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Alta de cancha con su estado inicial disponible (admin)' })
  @ApiCreatedResponse({ type: CanchaSchema, description: 'Cancha creada' })
  async crear(@Body() dto: CrearCanchaDto): Promise<CanchaResponse> {
    return this.canchas.crear(dto);
  }

  /** Court edit without touching the state (ACT-28, RF-12). */
  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Edicion de datos de cancha sin cambiar el estado (admin)' })
  @ApiOkResponse({ type: CanchaSchema })
  async actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarCanchaDto,
  ): Promise<CanchaResponse> {
    return this.canchas.actualizar(id, dto);
  }

  /** Operational state change with history and motivo (ACT-28, RF-17). */
  @Patch(':id/estado')
  @Roles('admin')
  @ApiOperation({ summary: 'Cambia el estado operativo de la cancha con motivo (admin)' })
  @ApiOkResponse({ type: CanchaSchema })
  async cambiarEstado(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CambiarEstadoCanchaDto,
  ): Promise<CanchaResponse> {
    return this.canchas.cambiarEstado(id, dto);
  }
}
