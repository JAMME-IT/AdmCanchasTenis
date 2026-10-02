import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext, RolNombre } from './auth.types';
import { getAuthorizedParties } from './clerk-client';
import { ALLOW_INCOMPLETE_PROFILE_KEY } from './decorators/allow-incomplete-profile.decorator';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

const ESTADOS_HABILITADOS: readonly string[] = ['activo', 'moroso'];

/**
 * Global guard: verifies the Clerk session token (networkless verifyToken),
 * maps `sub` -> usuarios.clerk_user_id, re-reads the current role from
 * usuarios_roles and sets the AuthContext on `request.auth`.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    const claims = await this.verifySessionToken(token);
    const clerkUserId = typeof claims.sub === 'string' ? claims.sub : null;
    if (!clerkUserId) {
      throw new UnauthorizedException('Token sin usuario');
    }
    const sessionId = typeof claims.sid === 'string' ? claims.sid : null;

    const usuario = await this.prisma.usuarios.findUnique({
      where: { clerk_user_id: clerkUserId },
    });

    if (!usuario) {
      if (this.allowsIncompleteProfile(context)) {
        request.auth = { clerkUserId, sessionId, usuario: null, rol: null };
        return true;
      }
      throw new ForbiddenException('Perfil incompleto: falta completar el alta del usuario');
    }

    if (!ESTADOS_HABILITADOS.includes(usuario.estado_actual)) {
      throw new ForbiddenException(`Usuario ${usuario.estado_actual}`);
    }

    const rolVigente = await this.prisma.usuarios_roles.findFirst({
      where: { usuario_id: usuario.id, fecha_fin: null },
      include: { roles: true },
    });

    request.auth = {
      clerkUserId,
      sessionId,
      usuario,
      rol: (rolVigente?.roles.nombre as RolNombre | undefined) ?? null,
    };
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private allowsIncompleteProfile(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(ALLOW_INCOMPLETE_PROFILE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length).trim() || null;
  }

  private async verifySessionToken(token: string): Promise<{ sub?: string; sid?: string }> {
    try {
      const claims = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        jwtKey: process.env.CLERK_JWT_KEY || undefined,
        authorizedParties: getAuthorizedParties(),
      });
      return claims as { sub?: string; sid?: string };
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}
