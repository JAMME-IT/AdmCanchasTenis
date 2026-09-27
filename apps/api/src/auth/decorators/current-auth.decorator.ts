import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from '../auth.types';

/** Injects the AuthContext set by ClerkAuthGuard on the request. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    if (!request.auth) {
      throw new InternalServerErrorException(
        'CurrentAuth se uso en una ruta sin ClerkAuthGuard',
      );
    }
    return request.auth;
  },
);
