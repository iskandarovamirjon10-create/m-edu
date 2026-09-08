import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { FaceController } from './face.controller';
import { FaceService } from './face.service';

@Module({
  imports: [
    PrismaModule,
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