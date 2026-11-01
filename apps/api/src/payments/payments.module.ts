import { FinancialPeriodService } from '../analytics/financial-period.service';
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { FinancialCronService } from './financial-cron.service';
import { SmartDiscountController } from './discounts/smart-discount.controller';
import { SmartDiscountService } from './discounts/smart-discount.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationEventsModule } from '../notifications/events/notification-events.module';

@Module({
  imports: [PrismaModule, AuditModule, NotificationEventsModule],
  controllers: [
    PaymentsController,
    InvoicesController,
    SmartDiscountController,
  ],
  providers: [
    PaymentsService,
    InvoicesService,
    FinancialCronService,
    FinancialPeriodService,
    SmartDiscountService,
  ],
  exports: [
    PaymentsService,
    InvoicesService,
    FinancialCronService,
    SmartDiscountService,
  ],
})
export class PaymentsModule {}
