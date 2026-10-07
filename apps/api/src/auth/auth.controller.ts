import { Controller, ForbiddenException, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { toUsuarioResponse, type UsuarioResponse } from '../usuarios/usuario-response';
import { UsuarioSchema } from '../usuarios/usuario-response.schema';
import type { AuthContext } from './auth.types';
import { getClerkClient } from './clerk-client';
import { CurrentAuth } from './decorators/current-auth.decorator';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado (rol vigente y numero de socio)' })
  @ApiOkResponse({ type: UsuarioSchema })
  async me(@CurrentAuth() auth: AuthContext): Promise<UsuarioResponse> {
    if (!auth.usuario) {
      throw new ForbiddenException('Perfil incompleto: falta completar el alta del usuario');
    }
    const usuario = await this.prisma.usuarios.findUniqueOrThrow({
      where: { id: auth.usuario.id },
      include: { socios: true },
    });
    return toUsuarioResponse(usuario, auth.rol);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar sesion: revoca la sesion de Clerk (claim sid)' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { message: { type: 'string', example: 'Sesion cerrada' } } },
  })
  async logout(@CurrentAuth() auth: AuthContext): Promise<{ message: string }> {
    if (auth.sessionId) {
      await getClerkClient().sessions.revokeSession(auth.sessionId);
    }
    return { message: 'Sesion cerrada' };
  }
}
