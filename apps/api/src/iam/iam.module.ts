import { Module } from '@nestjs/common';
import { IAMController } from './iam.controller';
import { IAMService } from './iam.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, SecurityModule, AuthModule],
  controllers: [IAMController],
  providers: [IAMService],
  exports: [IAMService],
})
export class IAMModule {}
