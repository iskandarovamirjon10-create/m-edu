import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceGateway } from './attendance.gateway';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceGateway],
  exports: [AttendanceService],
})
export class AttendanceModule {}
