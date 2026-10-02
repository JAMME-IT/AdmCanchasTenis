import { Controller, ForbiddenException, Get, HttpCode, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toUsuarioResponse, type UsuarioResponse } from '../usuarios/usuario-response';
import type { AuthContext } from './auth.types';
import { getClerkClient } from './clerk-client';
import { CurrentAuth } from './decorators/current-auth.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
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
  async logout(@CurrentAuth() auth: AuthContext): Promise<{ message: string }> {
    if (auth.sessionId) {
      await getClerkClient().sessions.revokeSession(auth.sessionId);
    }
    return { message: 'Sesion cerrada' };
  }
}
