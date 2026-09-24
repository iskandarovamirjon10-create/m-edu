import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  controllers: [PerformanceController],
  providers: [
    PerformanceService,
    MetricsInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [PerformanceService, MetricsInterceptor],
})
export class PerformanceModule {}
