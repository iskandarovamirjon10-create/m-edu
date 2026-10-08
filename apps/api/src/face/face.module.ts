import { Module, forwardRef } from '@nestjs/common';
import { CameraModule } from '../camera/camera.module';

import { PrismaModule } from '../prisma/prisma.module';
import { NotificationEventsModule } from '../notifications/events/notification-events.module';
import { RedisPubSubModule } from '../common/redis/redis-pubsub.module';

import { FaceController } from './face.controller';
import { FaceService } from './face.service';

@Module({
  imports: [
    PrismaModule,
    NotificationEventsModule,
    RedisPubSubModule,
    forwardRef(() => CameraModule),
  ],

  controllers: [
    FaceController,
  ],

  providers: [
    FaceService,
  ],

  exports: [
    FaceService,
  ],
})
export class FaceModule {}
