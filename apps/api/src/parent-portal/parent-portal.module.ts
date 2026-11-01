import { Module } from '@nestjs/common';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';
import { ParentSafetyGuardController } from './parent-safety-guard.controller';
import { ParentSafetyGuardService } from './parent-safety-guard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { TelegramCoreModule } from '../telegram/telegram-core.module';

@Module({
  imports: [PrismaModule, AuditModule, TelegramCoreModule],
  controllers: [ParentPortalController, ParentSafetyGuardController],
  providers: [ParentPortalService, ParentSafetyGuardService],
  exports: [ParentPortalService, ParentSafetyGuardService],
})
export class ParentPortalModule {}
