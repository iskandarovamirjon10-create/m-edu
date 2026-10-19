import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AllowPublic } from '../auth/public.decorator';

@ApiTags('Root')
// Excluded from Swagger UI — the root endpoint is a navigation hint, not an
// API surface. main.ts also excludes this route from the /api global prefix
// so GET / and GET /api return a friendly banner instead of a 404.
@ApiExcludeController()
@AllowPublic()
@Controller()
@SkipThrottle()
export class RootController {
  @Get()
  @ApiOperation({ summary: 'API welcome and health check' })
  getRoot() {
    return {
      name: 'M-EDU API',
      version: '2.0.0',
      docs: '/api/docs',
      health: '/api/health',
      readiness: '/api/readiness',
      timestamp: new Date().toISOString(),
    };
  }
}
