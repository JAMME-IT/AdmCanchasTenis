import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { CanchasModule } from './canchas/canchas.module';
import { CuotasModule } from './cuotas/cuotas.module';
import { PagosTurnoModule } from './pagos-turno/pagos-turno.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportesModule } from './reportes/reportes.module';
import { TarifasModule } from './tarifas/tarifas.module';
import { TurnosModule } from './turnos/turnos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AuthModule, TurnosModule, UsuariosModule, WebhooksModule, CuotasModule, ReportesModule, CanchasModule, TarifasModule, PagosTurnoModule],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
