import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DisponibilidadSchema } from './disponibilidad-response.schema';
import type { DisponibilidadResponse } from './disponibilidad-response';
import { ActualizarEstadoTurnoDto } from './dto/actualizar-estado-turno.dto';
import { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto';
import { ConsultarHistorialDto } from './dto/consultar-historial.dto';
import { ConsultarMisTurnosDto } from './dto/consultar-mis-turnos.dto';
import { CrearTurnoDto } from './dto/crear-turno.dto';
import type { MiTurnoResponse, TurnoConCanchaResponse } from './mis-turno-response';
import type { ReservarTurnoResponse, TurnoResponse } from './turno-response';
import { TurnosService } from './turnos.service';

@ApiTags('Turnos')
@ApiBearerAuth()
@Controller('turnos')
export class TurnosController {
  constructor(private readonly turnos: TurnosService) {}

  /** Day availability grid, the basis of the booking screen (ACT-33, RF-12/CU04). */
  @Get('disponibilidad')
  @Roles('admin', 'socio', 'no_socio')
  @ApiOperation({ summary: 'Slots del dia por cancha con disponibilidad resuelta' })
  @ApiOkResponse({ type: DisponibilidadSchema })
  async disponibilidad(
    @Query() query: ConsultarDisponibilidadDto,
  ): Promise<DisponibilidadResponse> {
    return this.turnos.obtenerDisponibilidad(query);
  }

  /**
   * Current bookings of the authenticated user with the RN-1 cancel flag
   * (ACT-38, RF-36/CU24). Declared before any future `:id` route so `mios`
   * is not swallowed as an id.
   */
  @Get('mios')
  @Roles('admin', 'socio', 'no_socio')
  @ApiOperation({ summary: 'Turnos vigentes del usuario autenticado' })
  @ApiOkResponse({ description: 'Turnos confirmado/iniciado con cancha y puedeCancelar' })
  async mios(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ConsultarMisTurnosDto,
  ): Promise<MiTurnoResponse[]> {
    return this.turnos.obtenerMios(auth, query);
  }

  /** Descending booking history of the authenticated user (ACT-38, RF-18/CU5). */
  @Get('mios/historial')
  @Roles('admin', 'socio', 'no_socio')
  @ApiOperation({ summary: 'Historial cronologico descendente del usuario autenticado' })
  @ApiOkResponse({ description: 'Turnos finalizado/no_asistio/cancelado con cancha' })
  async historial(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ConsultarHistorialDto,
  ): Promise<TurnoConCanchaResponse[]> {
    return this.turnos.obtenerHistorial(auth, query);
  }

  /** Court booking with frozen rate and shared lighting charge (ACT-34, RF-12/RF-13/RF-39). */
  @Post()
  @Roles('admin', 'socio', 'no_socio')
  @ApiOperation({ summary: 'Reservar un turno con o sin luz' })
  @ApiCreatedResponse({ description: 'Turno confirmado con cargo de luz y avisos' })
  async reservar(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CrearTurnoDto,
  ): Promise<ReservarTurnoResponse> {
    return this.turnos.reservar(auth, dto);
  }

  /** Lifecycle transition of a booking (ACT-36, CU22; `cancelado` only via POST /turnos/:id/cancelar). */
  @Patch(':id/estado')
  @Roles('admin')
  @ApiOperation({ summary: 'Aplica una transicion del ciclo de vida del turno (admin)' })
  @ApiOkResponse({ description: 'Turno con el estado del ciclo de vida actualizado' })
  async cambiarEstado(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarEstadoTurnoDto,
  ): Promise<TurnoResponse> {
    return this.turnos.cambiarEstado(id, dto);
  }
}
