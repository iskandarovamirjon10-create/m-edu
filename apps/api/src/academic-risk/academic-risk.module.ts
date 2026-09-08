import { Module } from '@nestjs/common';
import { AcademicRiskController } from './academic-risk.controller';
import { AcademicRiskService } from './academic-risk.service';

@Module({
  controllers: [AcademicRiskController],
  providers: [AcademicRiskService],
  exports: [AcademicRiskService],
})
export class AcademicRiskModule {}
