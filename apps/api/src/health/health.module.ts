import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { LivenessController } from './liveness.controller';
import { ReadinessController } from './readiness.controller';
import { RootController } from '../common/root.controller';

@Module({
  controllers: [HealthController, LivenessController, ReadinessController, RootController],
})
export class HealthModule {}
