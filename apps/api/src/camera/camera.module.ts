import { Module } from '@nestjs/common';

import { CameraController } from './camera.controller';
import { TerminalWebhookController } from './terminal-webhook.controller';
import { TerminalAuthGuard } from './terminal-auth.guard';
import { CameraService } from './camera.service';
import { CameraWorkerManagerService } from './camera-worker-manager.service';
import { CameraAlertingService } from './camera-alerting.service';
import { AttendanceDecisionEngine } from './attendance-decision.engine';

import { ApiKeysModule } from '../api-keys/api-keys.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisPubSubModule } from '../common/redis/redis-pubsub.module';

@Module({
  imports: [
    // Supplies ApiKeyGuard, which TerminalAuthGuard delegates to — the terminal
    // webhook authenticates with a scoped API key rather than a user session.
    ApiKeysModule,
    PrismaModule,
    RedisPubSubModule,
  ],

  controllers: [
    CameraController,
    TerminalWebhookController,
  ],

  providers: [
    CameraService,
    TerminalAuthGuard,
    AttendanceDecisionEngine,
    CameraWorkerManagerService,
    CameraAlertingService,
  ],

  exports: [
    CameraService,
    CameraWorkerManagerService,
    AttendanceDecisionEngine,
  ],
})
export class CameraModule {}