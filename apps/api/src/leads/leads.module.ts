import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { FollowUpAutomationService } from './follow-up-automation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationEventsModule } from '../notifications/events/notification-events.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    NotificationEventsModule,
    AuditModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService, FollowUpAutomationService],
  exports: [LeadsService, FollowUpAutomationService],
})
export class LeadsModule {}
