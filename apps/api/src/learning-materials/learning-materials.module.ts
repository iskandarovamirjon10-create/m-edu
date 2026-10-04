import { Module } from '@nestjs/common';
import { LearningMaterialsController } from './learning-materials.controller';
import { LearningMaterialsService } from './learning-materials.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LearningMaterialsController],
  providers: [LearningMaterialsService],
  exports: [LearningMaterialsService],
})
export class LearningMaterialsModule {}
