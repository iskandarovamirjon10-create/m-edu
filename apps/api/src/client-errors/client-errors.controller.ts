import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AllowPublic } from '../auth/public.decorator';
import { JsonLogger } from '../common/json-logger';
import { ClientErrorDto } from './dto/client-error.dto';

/**
 * Anonymous sink for browser runtime errors.
 *
 * This is the project's lightweight Sentry-analog: the SPA posts captured
 * production errors here (credentials omitted, body-validated, throttled),
 * the API emits ONE structured log line, and any log shipper (Loki/ELK/
 * CloudWatch) picks them up. No third-party dependency, no cookies, no PII
 * beyond the error text itself.
 */
@ApiTags('Client Errors')
@AllowPublic()
@Controller('client-errors')
export class ClientErrorsController {
  private readonly logger = new JsonLogger('ClientErrors');

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  // A crash-looping client must not become a log-flood vector.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ingest a frontend runtime error (production telemetry)' })
  report(@Body() dto: ClientErrorDto, @Req() req: Request): { accepted: true } {
    this.logger.warn('client_error', JSON.stringify({
      source: dto.source ?? 'window',
      route: dto.route,
      release: dto.release,
      message: dto.message,
      stack: dto.stack,
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
    }));
    return { accepted: true };
  }
}
