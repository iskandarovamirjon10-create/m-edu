import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { CsrfController } from './csrf.controller';
import { SecurityService } from './security.service';
import { SecurityEventService } from '../common/security/security-event.service';

@Module({
  controllers: [SecurityController, CsrfController],
  providers: [SecurityService, SecurityEventService],
  exports: [SecurityService, SecurityEventService],
})
export class SecurityModule {}

