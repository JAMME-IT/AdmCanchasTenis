import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import type { DiaFuncionamientoResponse } from './dias-funcionamiento-response';
import { DiaFuncionamientoSchema } from './dias-funcionamiento-response.schema';
import { DiasFuncionamientoService } from './dias-funcionamiento.service';
import { ActualizarDiasFuncionamientoDto } from './dto/actualizar-dias-funcionamiento.dto';
import { ActualizarRangosHorarioDto } from './dto/actualizar-rangos-horario.dto';
import { ActualizarTipoTurnoDto } from './dto/actualizar-tipo-turno.dto';
import type { RangoHorarioResponse } from './rangos-horario-response';
import { RangoHorarioSchema } from './rangos-horario-response.schema';
import { RangosHorarioService } from './rangos-horario.service';
import type { TipoTurnoResponse } from './tipos-turno-response';
import { TipoTurnoSchema } from './tipos-turno-response.schema';
import { TiposTurnoService } from './tipos-turno.service';

/**
 * Config endpoints (API contract §5.6). GET is open to any authenticated role;
 * PUT and PATCH are admin-only (RF-34, RF-35, RF-15). Global prefix /api applies
 * (main.ts).
 */
@ApiTags('Configuracion')
@ApiBearerAuth()
@Controller('config')
export class ConfigController {
  constructor(
    private readonly diasFuncionamiento: DiasFuncionamientoService,
    private readonly rangosHorario: RangosHorarioService,
    private readonly tiposTurno: TiposTurnoService,
  ) {}

  /** Operating days for booking screens and the admin config viewer (ACT-30, RF-35). */
  @Get('dias-funcionamiento')
  @ApiOperation({ summary: 'Dias de funcionamiento del club (1 = lunes ... 7 = domingo)' })
  @ApiOkResponse({ type: [DiaFuncionamientoSchema] })
  listarDiasFuncionamiento(): Promise<DiaFuncionamientoResponse[]> {
    return this.diasFuncionamiento.listar();
  }

  /** Registers and modifies the club's operating days (ACT-30, RF-35). */
  @Put('dias-funcionamiento')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualiza los dias de funcionamiento (admin)' })
  @ApiOkResponse({ type: [DiaFuncionamientoSchema] })
  actualizarDiasFuncionamiento(
    @Body() dto: ActualizarDiasFuncionamientoDto,
  ): Promise<DiaFuncionamientoResponse[]> {
    return this.diasFuncionamiento.actualizar(dto);
  }

  /** Opening time ranges used by booking availability (ACT-31, RF-34). */
  @Get('rangos-horario')
  @ApiOperation({ summary: 'Rangos horarios de apertura del club' })
  @ApiOkResponse({ type: [RangoHorarioSchema] })
  listarRangosHorario(): Promise<RangoHorarioResponse[]> {
    return this.rangosHorario.listar();
  }

  /** Replaces the club's opening time ranges (ACT-31, RF-34). */
  @Put('rangos-horario')
  @Roles('admin')
  @ApiOperation({ summary: 'Reemplaza los rangos horarios de apertura (admin)' })
  @ApiOkResponse({ type: [RangoHorarioSchema] })
  actualizarRangosHorario(@Body() dto: ActualizarRangosHorarioDto): Promise<RangoHorarioResponse[]> {
    return this.rangosHorario.actualizar(dto);
  }

  /** Modifies a shift type duration, affecting availability and new bookings (ACT-32, RF-15). */
  @Patch('tipos-turno/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualiza la duracion de un tipo de turno (admin)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TipoTurnoSchema })
  actualizarTipoTurno(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarTipoTurnoDto,
  ): Promise<TipoTurnoResponse> {
    return this.tiposTurno.actualizar(id, dto);
  }
}
