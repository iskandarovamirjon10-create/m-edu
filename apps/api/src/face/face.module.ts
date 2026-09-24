import { Module, forwardRef } from '@nestjs/common';
import { CameraModule } from '../camera/camera.module';

import { PrismaModule } from '../prisma/prisma.module';

import { FaceController } from './face.controller';
import { FaceService } from './face.service';

@Module({
  imports: [
    PrismaModule,
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
