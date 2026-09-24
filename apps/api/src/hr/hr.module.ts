import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { HremployeeService } from './hr.service';
import { HremployeeController } from './hr.controller';
import { PayrollService } from './payroll.service';
import { PayrollRunController } from './payroll-run.controller';
import { PayrollPeriodController } from './payroll-period.controller';

@Module({
  imports: [PrismaModule, AuditModule, AnalyticsModule],
  controllers: [HremployeeController, PayrollRunController, PayrollPeriodController],
  providers: [HremployeeService, PayrollService],
  exports: [HremployeeService, PayrollService],
})
export class HrModule {}