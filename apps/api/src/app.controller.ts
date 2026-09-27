import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@adm/shared';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Get('health')
  @Public()
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
