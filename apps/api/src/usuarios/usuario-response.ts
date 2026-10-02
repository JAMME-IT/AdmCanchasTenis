import type { socios, usuarios } from '../generated/prisma/client';
import type { RolNombre } from '../auth/auth.types';

/** Usuario model from the API contract (§5.0). clerk_user_id is never exposed. */
export interface UsuarioResponse {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  dni: string;
  estadoActual: string;
  rol: RolNombre | null;
  numeroSocio: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UsuarioConSocio = usuarios & { socios: socios | null };

export function toUsuarioResponse(usuario: UsuarioConSocio, rol: RolNombre | null): UsuarioResponse {
  return {
    id: usuario.id,
    username: usuario.username,
    email: usuario.email,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    telefono: usuario.telefono,
    dni: usuario.dni,
    estadoActual: usuario.estado_actual,
    rol,
    numeroSocio: usuario.socios?.numero_socio ?? null,
    createdAt: usuario.created_at,
    updatedAt: usuario.updated_at,
  };
}
