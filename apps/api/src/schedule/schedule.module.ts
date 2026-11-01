import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { LessonGeneratorService } from './lesson-generator.service';
import { ScheduleOptimizerController } from './schedule-optimizer.controller';
import { ScheduleOptimizerService } from './schedule-optimizer.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ScheduleController, ScheduleOptimizerController],
  providers: [ScheduleService, LessonGeneratorService, ScheduleOptimizerService],
  exports: [ScheduleService, LessonGeneratorService, ScheduleOptimizerService],
})
export class ScheduleModule {}
