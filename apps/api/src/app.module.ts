import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { ReportesModule } from './reportes/reportes.module';
import { TurnosModule } from './turnos/turnos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [PrismaModule, AuthModule, TurnosModule, UsuariosModule, WebhooksModule, ReportesModule],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
