import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthContext } from '../auth/auth.types';
import { AllowIncompleteProfile } from '../auth/decorators/allow-incomplete-profile.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';
import type { UsuarioResponse } from './usuario-response';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Post('completar-perfil')
  @AllowIncompleteProfile()
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
