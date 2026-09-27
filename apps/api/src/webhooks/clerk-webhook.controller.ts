import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id?: string;
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
  };
}

/**
 * Clerk webhook (svix signature): syncs the email (user.updated) and applies
 * the logical deactivation (user.deleted, RF-7). The initial sign-up row is
 * created by completar-perfil.
 */
@ApiTags('Interno')
@Controller('webhooks')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post('clerk')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Webhook de Clerk (firma svix): sincroniza email y aplica la baja logica',
    description: 'Uso interno: lo invoca Clerk, no el frontend.',
  })
  @ApiOkResponse({
    schema: { type: 'object', properties: { received: { type: 'boolean', example: true } } },
  })
  async recibir(@Req() req: RawBodyRequest<Request>): Promise<{ received: boolean }> {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('CLERK_WEBHOOK_SECRET no esta configurada');
    }
    if (!req.rawBody) {
      throw new BadRequestException('Sin cuerpo raw para verificar la firma');
    }

    let event: ClerkWebhookEvent;
    try {
      const webhook = new Webhook(secret);
      event = webhook.verify(req.rawBody, {
        'svix-id': String(req.headers['svix-id'] ?? ''),
        'svix-timestamp': String(req.headers['svix-timestamp'] ?? ''),
        'svix-signature': String(req.headers['svix-signature'] ?? ''),
      }) as unknown as ClerkWebhookEvent;
    } catch {
      throw new BadRequestException('Firma de webhook invalida');
    }

    switch (event.type) {
      case 'user.updated':
        await this.sincronizarEmail(event);
        break;
      case 'user.deleted':
        await this.aplicarBaja(event);
        break;
      default:
        this.logger.log(`Webhook de Clerk ignorado: ${event.type}`);
    }

    return { received: true };
  }

  private async sincronizarEmail(event: ClerkWebhookEvent): Promise<void> {
    const clerkUserId = event.data.id;
    const email = this.emailPrincipal(event);
    if (!clerkUserId || !email) {
      return;
    }

    const usuario = await this.prisma.usuarios.findUnique({
      where: { clerk_user_id: clerkUserId },
    });
    if (!usuario || usuario.email === email) {
      return;
    }

    try {
      await this.prisma.usuarios.update({
        where: { id: usuario.id },
        data: { email, updated_at: new Date() },
      });
      this.logger.log(`Email sincronizado para usuarios.id=${usuario.id}`);
    } catch {
      this.logger.warn(`No se pudo sincronizar el email de usuarios.id=${usuario.id}`);
    }
  }

  private async aplicarBaja(event: ClerkWebhookEvent): Promise<void> {
    const clerkUserId = event.data.id;
    if (!clerkUserId) {
      return;
    }

    const usuario = await this.prisma.usuarios.findUnique({
      where: { clerk_user_id: clerkUserId },
    });
    if (!usuario || usuario.estado_actual === 'inactivo') {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.usuarios.update({
        where: { id: usuario.id },
        data: { estado_actual: 'inactivo', updated_at: new Date() },
      });
      await tx.estados_usuario.create({
        data: { usuario_id: usuario.id, valor: 'inactivo' },
      });
    });
    this.logger.log(`Baja logica aplicada a usuarios.id=${usuario.id} (user.deleted de Clerk)`);
  }

  private emailPrincipal(event: ClerkWebhookEvent): string | null {
    const primario = event.data.email_addresses?.find(
      (email) => email.id === event.data.primary_email_address_id,
    );
    const email = primario?.email_address ?? event.data.email_addresses?.[0]?.email_address;
    return email?.trim().toLowerCase() || null;
  }
}
