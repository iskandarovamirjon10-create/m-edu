import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReportBuilderService } from './report-builder.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [ReportsController],
  providers: [ReportBuilderService],
  exports: [ReportBuilderService],
})
export class ReportsModule {}
