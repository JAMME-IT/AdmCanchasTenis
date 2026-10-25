import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { DiasFuncionamientoService } from './dias-funcionamiento.service';
import { RangosHorarioService } from './rangos-horario.service';

@Module({
  controllers: [ConfigController],
  providers: [DiasFuncionamientoService, RangosHorarioService],
})
export class ConfigModule {}
