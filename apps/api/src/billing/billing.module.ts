import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PaymeAdapter } from './adapters/payme.adapter';
import { ClickAdapter } from './adapters/click.adapter';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, PaymeAdapter, ClickAdapter],
  exports: [BillingService, PaymeAdapter, ClickAdapter],
})
export class BillingModule {}
