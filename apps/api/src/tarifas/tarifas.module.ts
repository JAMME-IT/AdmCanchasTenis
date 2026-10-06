import { Module } from '@nestjs/common';
import { TarifasController } from './tarifas.controller';
import { TarifasService } from './tarifas.service';

@Module({
  controllers: [TarifasController],
  providers: [TarifasService],
})
export class TarifasModule {}