import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PagosTurnoController } from './pagos-turno.controller';
import { PagosTurnoService } from './pagos-turno.service';

@Module({
  imports: [PrismaModule],
  controllers: [PagosTurnoController],
  providers: [PagosTurnoService],
  exports: [PagosTurnoService],
})
export class PagosTurnoModule {}
