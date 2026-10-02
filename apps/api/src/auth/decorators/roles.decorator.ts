import { SetMetadata } from '@nestjs/common';
import type { RolNombre } from '../auth.types';

export const ROLES_KEY = 'roles';

/** Requires the user's current role to be one of the listed roles. */
export const Roles = (...roles: RolNombre[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
