import { Module, Global } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { QuotaGuard } from './guards/quota.guard';
import { EntitlementGuard } from './guards/entitlement.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, QuotaGuard, EntitlementGuard],
  exports: [SubscriptionsService, QuotaGuard, EntitlementGuard],
})
export class SubscriptionsModule {}
