import { Module } from '@nestjs/common';
import { CuotasService } from './cuotas.service';

@Module({
  providers: [CuotasService],
  exports: [CuotasService],
})
export class CuotasModule {}
