import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@adm/shared';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'API operativa',
    schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } },
  })
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
