import { Module } from '@nestjs/common';

import { CameraController } from './camera.controller';
import { CameraService } from './camera.service';
import { CameraWorkerManagerService } from './camera-worker-manager.service';
import { CameraAlertingService } from './camera-alerting.service';
import { AttendanceDecisionEngine } from './attendance-decision.engine';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    CameraController,
  ],

  providers: [
    CameraService,
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