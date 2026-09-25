import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@adm/shared';

@Controller()
export class AppController {
  @Get('health')
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
