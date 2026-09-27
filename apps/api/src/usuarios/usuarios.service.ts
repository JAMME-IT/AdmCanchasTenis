import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getClerkClient } from '../auth/clerk-client';
import type { RolNombre } from '../auth/auth.types';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import type { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import type { CompletarPerfilDto } from './dto/completar-perfil.dto';
import type { ListarUsuariosDto } from './dto/listar-usuarios.dto';
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

  /**
   * Admin listing (RF-4, RF-9, RF-10, RF-11): current role and state, ILIKE
   * search on apellido/nombre and filter by the vigente role. No pagination in
   * v1 (API contract §7.12). Current roles are resolved in a single query to
   * avoid per-user N+1 (usuarios_roles is a to-one relation by its partial
   * unique index, so it cannot include the whole role history).
   */
  async listar(filtros: ListarUsuariosDto): Promise<UsuarioResponse[]> {
    const where: Prisma.usuariosWhereInput = {};

    if (filtros.estado) {
      where.estado_actual = filtros.estado;
    }

    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
      where.OR = [
        { apellido: { contains: busqueda, mode: 'insensitive' } },
        { nombre: { contains: busqueda, mode: 'insensitive' } },
      ];
    }

    if (filtros.rol) {
      const conRolVigente = await this.prisma.usuarios_roles.findMany({
        where: { fecha_fin: null, roles: { nombre: filtros.rol } },
        select: { usuario_id: true },
      });
      where.id = { in: conRolVigente.map((fila) => fila.usuario_id) };
    }

    const usuarios = await this.prisma.usuarios.findMany({
      where,
      include: { socios: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
    if (usuarios.length === 0) {
      return [];
    }

    const rolesVigentes = await this.prisma.usuarios_roles.findMany({
      where: { usuario_id: { in: usuarios.map((usuario) => usuario.id) }, fecha_fin: null },
      include: { roles: true },
    });
    const rolPorUsuario = new Map<string, RolNombre>(
      rolesVigentes.map((fila) => [fila.usuario_id, fila.roles.nombre]),
    );

    return usuarios.map((usuario) =>
      toUsuarioResponse(usuario, rolPorUsuario.get(usuario.id) ?? null),
    );
  }

  /** Admin detail (RF-4, API contract §5.2 GET /usuarios/:id). */
  async obtener(id: string): Promise<UsuarioResponse> {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id },
      include: { socios: true },
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return toUsuarioResponse(usuario, await this.rolVigenteDe(usuario.id));
  }

  /**
   * Admin edit (RF-5, RN-4): partial data update plus the current state. A
   * state change inserts its estados_usuario row and updates the cache in the
   * same transaction; an unchanged state writes nothing (no duplicate history).
   */
  async actualizar(id: string, dto: ActualizarUsuarioDto): Promise<UsuarioResponse> {
    this.exigirAlMenosUnCampo(dto);

    const usuario = await this.prisma.usuarios.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const cambiaEstado =
      dto.estadoActual !== undefined && dto.estadoActual !== usuario.estado_actual;
    const data: Prisma.usuariosUpdateInput = {};
    if (dto.nombre !== undefined) {
      data.nombre = dto.nombre.trim();
    }
    if (dto.apellido !== undefined) {
      data.apellido = dto.apellido.trim();
    }
    if (dto.telefono !== undefined) {
      data.telefono = dto.telefono?.trim() || null;
    }
    if (dto.dni !== undefined) {
      data.dni = dto.dni.trim();
    }
    if (cambiaEstado) {
      data.estado_actual = dto.estadoActual;
    }

    if (Object.keys(data).length > 0) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.usuarios.update({
            where: { id },
            data: { ...data, updated_at: new Date() },
          });
          if (cambiaEstado && dto.estadoActual !== undefined) {
            await tx.estados_usuario.create({
              data: { usuario_id: id, valor: dto.estadoActual },
            });
          }
        });
      } catch (error) {
        if (esViolacionDeUnicidad(error)) {
          throw new ConflictException('dni duplicado');
        }
        throw error;
      }
    }

    return this.obtener(id);
  }

  /** Own-profile edit (RF-6): nombre/apellido/telefono/username only. */
  async actualizarPerfil(usuarioId: string, dto: ActualizarPerfilDto): Promise<UsuarioResponse> {
    this.exigirAlMenosUnCampo(dto);

    const data: Prisma.usuariosUpdateInput = {};
    if (dto.nombre !== undefined) {
      data.nombre = dto.nombre.trim();
    }
    if (dto.apellido !== undefined) {
      data.apellido = dto.apellido.trim();
    }
    if (dto.telefono !== undefined) {
      data.telefono = dto.telefono?.trim() || null;
    }
    if (dto.username !== undefined) {
      data.username = dto.username.trim().toLowerCase();
    }

    try {
      await this.prisma.usuarios.update({
        where: { id: usuarioId },
        data: { ...data, updated_at: new Date() },
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException('username duplicado');
      }
      throw error;
    }

    return this.obtener(usuarioId);
  }

  /**
   * Logical deactivation (RF-7): estado_actual = inactivo plus its
   * estados_usuario row in the same transaction; no row is deleted (FKs are
   * on delete restrict). Idempotent by design: an already inactive user gets
   * 200 again without duplicating history (the decision is documented here).
   */
  async darDeBaja(id: string): Promise<{ id: string; estadoActual: 'inactivo' }> {
    const usuario = await this.prisma.usuarios.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (usuario.estado_actual === 'inactivo') {
      return { id, estadoActual: 'inactivo' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.usuarios.update({
        where: { id },
        data: { estado_actual: 'inactivo', updated_at: new Date() },
      });
      await tx.estados_usuario.create({ data: { usuario_id: id, valor: 'inactivo' } });
    });

    return { id, estadoActual: 'inactivo' };
  }

  /** Contract §5.2: PATCH bodies must carry at least one editable field. */
  private exigirAlMenosUnCampo(dto: object): void {
    if (Object.values(dto).every((valor) => valor === undefined)) {
      throw new BadRequestException('Debe enviar al menos un campo');
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
    return { usuario, rol: await this.rolVigenteDe(usuario.id) };
  }

  /** Current usuarios_roles row (fecha_fin null, enforced by the partial unique index). */
  private async rolVigenteDe(usuarioId: string): Promise<RolNombre | null> {
    const rolVigente = await this.prisma.usuarios_roles.findFirst({
      where: { usuario_id: usuarioId, fecha_fin: null },
      include: { roles: true },
    });
    return rolVigente?.roles.nombre ?? null;
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
