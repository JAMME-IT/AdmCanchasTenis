import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { CuotasModule } from './cuotas/cuotas.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AuthModule, UsuariosModule, WebhooksModule, CuotasModule],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
