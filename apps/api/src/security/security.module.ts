import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { CsrfController } from './csrf.controller';
import { SecurityService } from './security.service';

@Module({
  controllers: [SecurityController, CsrfController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
