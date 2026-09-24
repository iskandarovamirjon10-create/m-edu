import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';
import { MetricsMiddleware } from './metrics.middleware';

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityService, MetricsMiddleware],
  exports: [MetricsMiddleware],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
