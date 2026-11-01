import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { HremployeeService } from './hr.service';
import { HremployeeController } from './hr.controller';
import { PayrollService } from './payroll.service';
import { PayrollRunController } from './payroll-run.controller';
import { PayrollPeriodController } from './payroll-period.controller';
import { TeacherKpiPayrollController } from './teacher-kpi-payroll.controller';
import { TeacherKpiPayrollService } from './teacher-kpi-payroll.service';

@Module({
  imports: [PrismaModule, AuditModule, AnalyticsModule],
  controllers: [
    HremployeeController,
    PayrollRunController,
    PayrollPeriodController,
    TeacherKpiPayrollController,
  ],
  providers: [HremployeeService, PayrollService, TeacherKpiPayrollService],
  exports: [HremployeeService, PayrollService, TeacherKpiPayrollService],
})
export class HrModule {}
