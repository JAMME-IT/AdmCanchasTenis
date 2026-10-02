import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DisponibilidadSchema } from './disponibilidad-response.schema';
import type { DisponibilidadResponse } from './disponibilidad-response';
import { ConsultarDisponibilidadDto } from './dto/consultar-disponibilidad.dto';
import { CrearTurnoDto } from './dto/crear-turno.dto';
import type { ReservarTurnoResponse } from './turno-response';
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
}
