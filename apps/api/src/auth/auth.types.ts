import type { usuarios } from '../generated/prisma/client';

/** Club business roles (current usuarios_roles row). Clerk session tokens do not carry them. */
export type RolNombre = 'admin' | 'socio' | 'no_socio';

/**
 * Authentication context set on `request.auth` by ClerkAuthGuard.
 * `usuario` is null only on routes marked with @AllowIncompleteProfile.
 */
export interface AuthContext {
  clerkUserId: string;
  sessionId: string | null;
  usuario: usuarios | null;
  rol: RolNombre | null;
}
