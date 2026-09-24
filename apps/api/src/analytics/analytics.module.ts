import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { FinancialBrainService } from './financial-brain.service';
import { FinancialPeriodService } from './financial-period.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { CrmAnalyticsService } from './crm-analytics.service';
import { ExecutiveSummaryService } from './executive-summary.service';
import { PayrollAnalyticsService } from './payroll-analytics.service';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    FinancialBrainService,
    FinancialPeriodService,
    AnomalyDetectionService,
    CrmAnalyticsService,
    ExecutiveSummaryService,
    PayrollAnalyticsService,
    ReconciliationService,
  ],
  exports: [
    AnalyticsService,
    FinancialBrainService,
    FinancialPeriodService,
    AnomalyDetectionService,
    CrmAnalyticsService,
    ExecutiveSummaryService,
    PayrollAnalyticsService,
    ReconciliationService,
  ],
})
export class AnalyticsModule {}

