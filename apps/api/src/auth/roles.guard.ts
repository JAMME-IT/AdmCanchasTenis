import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthContext, RolNombre } from './auth.types';
import { ROLES_KEY } from './decorators/roles.decorator';

/**
 * Global guard: requires the current role (re-read by ClerkAuthGuard on every
 * request) to be among the roles declared with @Roles(). A role change in
 * usuarios_roles takes effect immediately.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolNombre[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const rol = request.auth?.rol ?? null;
    if (!rol || !rolesRequeridos.includes(rol)) {
      throw new ForbiddenException('Rol insuficiente');
    }
    return true;
  }
}
