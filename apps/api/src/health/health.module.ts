import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReadinessController } from './readiness.controller';
import { RootController } from '../common/root.controller';

@Module({
  controllers: [HealthController, ReadinessController, RootController],
})
export class HealthModule {}
