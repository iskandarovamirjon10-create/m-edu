import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HremployeeService } from './hr.service';
import { HremployeeController } from './hr.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HremployeeController],
  providers: [HremployeeService],
  exports: [HremployeeService],
})
export class HrModule {}