import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AllowPublic } from '../auth/public.decorator';

@ApiTags('Health')
@AllowPublic()
@Controller(['live', 'liveness'])
@SkipThrottle()
export class LivenessController {
  @Get()
  check() {
    // Liveness must not fail merely because DB/Redis is down.
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }
}
