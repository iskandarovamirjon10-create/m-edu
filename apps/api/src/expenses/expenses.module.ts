import { Module } from '@nestjs/common';
import { FinancialPeriodService } from '../analytics/financial-period.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, FinancialPeriodService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
