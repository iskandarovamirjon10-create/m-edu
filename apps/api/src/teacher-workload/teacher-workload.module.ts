import { Module } from '@nestjs/common';
import { TeacherWorkloadController } from './teacher-workload.controller';
import { TeacherWorkloadService } from './teacher-workload.service';

@Module({
  controllers: [TeacherWorkloadController],
  providers: [TeacherWorkloadService],
  exports: [TeacherWorkloadService],
})
export class TeacherWorkloadModule {}
