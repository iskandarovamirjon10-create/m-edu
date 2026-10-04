import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { register } from 'prom-client';

import { AllowPublic } from '../auth/public.decorator';

/**
 * Prometheus scrape endpoint — replaces the controller shipped with
 * `@willsoto/nestjs-prometheus`.
 *
 * Why a local controller: the upstream `PrometheusController` cannot carry
 * `@AllowPublic()`, so once `GlobalAuthGuard` went global the default one
 * would have started returning 401 to every scraper. Defining our own keeps
 * the route on the reviewed public allow-list (see `public.decorator.ts`)
 * while still emitting the exact same registry payload.
 *
 * EXPOSURE
 * --------
 * Reachable at `GET /api/metrics`. It is public *inside* the deployment
 * network only: `apps/web/nginx.conf` denies `/api/metrics` at the edge, so
 * an internet-facing request never reaches this handler. Scrapers must target
 * the API container directly (`http://api:3000/api/metrics`).
 *
 * The payload contains counters and latency histograms — no tenant data, no
 * credentials, no request/response bodies. `ObservabilityController`
 * (`/api/observability/*`, `SUPER_ADMIN`) exposes the richer, authenticated
 * view.
 */
@AllowPublic()
@Controller('metrics')
export class PublicMetricsController {
  @Get()
  async scrape(@Res({ passthrough: true }) response: Response): Promise<string> {
    response.header('Content-Type', register.contentType);
    return register.metrics();
  }
}
