import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthContext } from '../auth/auth.types';
import { AllowIncompleteProfile } from '../auth/decorators/allow-incomplete-profile.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { estado_usuario, rol_nombre } from '../generated/prisma/client';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto';
import type { UsuarioResponse } from './usuario-response';
import { UsuarioSchema } from './usuario-response.schema';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /** Admin listing (RF-4, RF-9, RF-10, RF-11). */
  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Listado de usuarios con rol y estado vigentes (admin)' })
  @ApiQuery({
    name: 'busqueda',
    required: false,
    description: 'ILIKE sobre apellido y nombre',
    example: 'perez',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: Object.values(estado_usuario),
    description: 'Filtra por estado vigente',
  })
  @ApiQuery({
    name: 'rol',
    required: false,
    enum: Object.values(rol_nombre),
    description: 'Filtra por el rol vigente en usuarios_roles',
  })
  @ApiOkResponse({ type: [UsuarioSchema] })
  async listar(@Query() query: ListarUsuariosDto): Promise<UsuarioResponse[]> {
    return this.usuarios.listar(query);
  }

  /** Admin detail (RF-4). */
  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Detalle de un usuario (admin)' })
  @ApiOkResponse({ type: UsuarioSchema })
  async obtener(@Param('id', new ParseUUIDPipe()) id: string): Promise<UsuarioResponse> {
    return this.usuarios.obtener(id);
  }

  /** Own-profile edit (RF-6). Declared before ':id' so 'me' is not read as an id. */
  @Patch('me')
  @ApiOperation({ summary: 'Editar el perfil propio (sin email, dni, estado ni rol)' })
  @ApiOkResponse({ type: UsuarioSchema })
  async actualizarPerfil(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ActualizarPerfilDto,
  ): Promise<UsuarioResponse> {
    if (!auth.usuario) {
      throw new ForbiddenException('Perfil incompleto: falta completar el alta del usuario');
    }
    return this.usuarios.actualizarPerfil(auth.usuario.id, dto);
  }

  /** Admin edit (RF-5, RN-4). */
  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Edicion administrativa de datos y estado (admin)' })
  @ApiOkResponse({ type: UsuarioSchema })
  async actualizar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarUsuarioDto,
  ): Promise<UsuarioResponse> {
    return this.usuarios.actualizar(id, dto);
  }

  /** Admin logical deactivation (RF-7). */
  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Baja logica: estado inactivo + historial (admin, idempotente)' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        estadoActual: { type: 'string', example: 'inactivo' },
      },
    },
  })
  async darDeBaja(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ id: string; estadoActual: string }> {
    return this.usuarios.darDeBaja(id);
  }

  @Post('completar-perfil')
  @AllowIncompleteProfile()
  @ApiOperation({ summary: 'Alta del usuario de dominio tras el sign-up en Clerk (RF-1)' })
  @ApiCreatedResponse({ type: UsuarioSchema, description: 'Perfil creado' })
  @ApiOkResponse({ type: UsuarioSchema, description: 'Perfil ya existente (idempotente)' })
  async completarPerfil(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CompletarPerfilDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UsuarioResponse> {
    const { usuario, creado } = await this.usuarios.completarPerfil(auth.clerkUserId, dto);
    res.status(creado ? 201 : 200);
    return usuario;
  }
}
