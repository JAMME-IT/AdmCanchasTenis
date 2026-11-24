import { Module } from '@nestjs/common';
import { PagosLuzController } from './pagos-luz.controller';
import { PagosLuzService } from './pagos-luz.service';

@Module({
  controllers: [PagosLuzController],
  providers: [PagosLuzService],
})
export class PagosLuzModule {}