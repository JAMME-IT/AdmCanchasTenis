import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getClerkClient } from '../auth/clerk-client';
import type { RolNombre } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CompletarPerfilDto } from './dto/completar-perfil.dto';
import {
  toUsuarioResponse,
  type UsuarioConSocio,
  type UsuarioResponse,
} from './usuario-response';

interface PerfilExistente {
  usuario: UsuarioConSocio;
  rol: RolNombre | null;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Domain sign-up (RF-1): creates usuarios + estados_usuario + usuarios_roles
   * (no_socio) in a single transaction. Idempotent: if the user already has a
   * row, returns it without creating anything.
   */
  async completarPerfil(
    clerkUserId: string,
    dto: CompletarPerfilDto,
  ): Promise<{ usuario: UsuarioResponse; creado: boolean }> {
    const existente = await this.buscarPorClerkId(clerkUserId);
    if (existente) {
      return { usuario: toUsuarioResponse(existente.usuario, existente.rol), creado: false };
    }

    const email = await this.emailDeClerk(clerkUserId);
    const rolNoSocio = await this.prisma.roles.findUnique({ where: { nombre: 'no_socio' } });
    if (!rolNoSocio) {
      throw new InternalServerErrorException('Falta el seed de roles (no_socio)');
    }

    try {
      const usuario = await this.prisma.$transaction(async (tx) => {
        const creado = await tx.usuarios.create({
          data: {
            clerk_user_id: clerkUserId,
            username: dto.username.trim().toLowerCase(),
            email,
            nombre: dto.nombre.trim(),
            apellido: dto.apellido.trim(),
            telefono: dto.telefono?.trim() || null,
            dni: dto.dni.trim(),
          },
        });
        await tx.estados_usuario.create({ data: { usuario_id: creado.id, valor: 'activo' } });
        await tx.usuarios_roles.create({
          data: { usuario_id: creado.id, rol_id: rolNoSocio.id },
        });
        return tx.usuarios.findUniqueOrThrow({
          where: { id: creado.id },
          include: { socios: true },
        });
      });
      return { usuario: toUsuarioResponse(usuario, 'no_socio'), creado: true };
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        const carrera = await this.buscarPorClerkId(clerkUserId);
        if (carrera) {
          return { usuario: toUsuarioResponse(carrera.usuario, carrera.rol), creado: false };
        }
        throw new ConflictException('username, email o dni duplicado');
      }
      throw error;
    }
  }

  private async buscarPorClerkId(clerkUserId: string): Promise<PerfilExistente | null> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { clerk_user_id: clerkUserId },
      include: { socios: true },
    });
    if (!usuario) {
      return null;
    }
    const rolVigente = await this.prisma.usuarios_roles.findFirst({
      where: { usuario_id: usuario.id, fecha_fin: null },
      include: { roles: true },
    });
    return {
      usuario,
      rol: (rolVigente?.roles.nombre as RolNombre | undefined) ?? null,
    };
  }

  private async emailDeClerk(clerkUserId: string): Promise<string> {
    const clerkUser = await getClerkClient().users.getUser(clerkUserId);
    const primario = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    );
    const email = primario?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new UnprocessableEntityException('El usuario de Clerk no tiene email');
    }
    return email.trim().toLowerCase();
  }
}

function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
