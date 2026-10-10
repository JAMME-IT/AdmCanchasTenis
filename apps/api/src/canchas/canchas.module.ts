import { Module } from '@nestjs/common';
import { CanchasController } from './canchas.controller';
import { CanchasService } from './canchas.service';

@Module({
  controllers: [CanchasController],
  providers: [CanchasService],
})
export class CanchasModule {}
