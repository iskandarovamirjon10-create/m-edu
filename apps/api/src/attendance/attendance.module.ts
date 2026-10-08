import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AttendanceGateway } from './attendance.gateway';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisPubSubModule } from '../common/redis/redis-pubsub.module';

@Module({
  imports: [PrismaModule, AuthModule, RedisPubSubModule, ConfigModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceGateway],
  exports: [AttendanceService],
})
export class AttendanceModule {}
