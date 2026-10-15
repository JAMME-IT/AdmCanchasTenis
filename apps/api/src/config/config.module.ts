import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { DiasFuncionamientoService } from './dias-funcionamiento.service';

@Module({
  controllers: [ConfigController],
  providers: [DiasFuncionamientoService],
})
export class ConfigModule {}
