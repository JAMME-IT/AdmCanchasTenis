import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { DiasFuncionamientoService } from './dias-funcionamiento.service';
import { TiposTurnoService } from './tipos-turno.service';

@Module({
  controllers: [ConfigController],
  providers: [DiasFuncionamientoService, TiposTurnoService],
})
export class ConfigModule {}
