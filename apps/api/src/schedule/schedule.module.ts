import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { LessonGeneratorService } from './lesson-generator.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, LessonGeneratorService],
  exports: [ScheduleService, LessonGeneratorService],
})
export class ScheduleModule {}
