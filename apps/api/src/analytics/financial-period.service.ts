import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodStatus, type Prisma } from '@prisma/client';
import { withPrismaRetry } from '../lib/prisma-retry.util';

export type TxLike = Pick<Prisma.TransactionClient, 'financialPeriod' | 'auditLog' | '$queryRaw'>;

@Injectable()
export class FinancialPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  async getPeriod(organizationId: string, year: number, month: number) {
    return withPrismaRetry(async () => {
      let period = await this.prisma.financialPeriod.findUnique({
        where: {
          organizationId_periodYear_periodMonth: {
            organizationId,
            periodYear: year,
            periodMonth: month,
          },
        },
      });

      if (!period) {
        period = await this.prisma.financialPeriod.create({
          data: {
            organizationId,
            periodYear: year,
            periodMonth: month,
            status: PeriodStatus.OPEN,
          },
        });
      }

      return period;
    });
  }

  async getPeriodWithLock(
    tx: TxLike,
    organizationId: string,
    year: number,
    month: number,
  ) {
    const period: Array<{
      id: string;
      status: string;
      periodYear: number;
      periodMonth: number;
    }> = await tx.$queryRaw`
      SELECT id, status, "periodYear", "periodMonth" FROM "FinancialPeriod"
      WHERE "organizationId" = ${organizationId}::uuid AND "periodYear" = ${year} AND "periodMonth" = ${month}
      FOR UPDATE
    `;

    return period[0] ?? null;
  }

  async transitionState(
    organizationId: string,
    year: number,
    month: number,
    newState: PeriodStatus,
    userId: string
  ) {
    const period = await this.getPeriod(organizationId, year, month);

    // Strict transitions
    const validTransitions: Record<PeriodStatus, PeriodStatus[]> = {
      [PeriodStatus.OPEN]: [PeriodStatus.REVIEW],
      [PeriodStatus.REVIEW]: [PeriodStatus.RECONCILED, PeriodStatus.OPEN], // Can go back to OPEN if needed
      [PeriodStatus.RECONCILED]: [PeriodStatus.CLOSED, PeriodStatus.REVIEW], // Can go back to REVIEW
      [PeriodStatus.CLOSED]: [PeriodStatus.OPEN], // Reopening a closed period requires returning to OPEN
    };

    if (!validTransitions[period.status].includes(newState)) {
      throw new BadRequestException(
        `Invalid transition from ${period.status} to ${newState}`
      );
    }

    await withPrismaRetry(async () => {
      await this.prisma.$transaction(async (tx) => {
        const locked = await this.getPeriodWithLock(tx, organizationId, year, month);
        if (!locked) {
          throw new BadRequestException('Financial period not found');
        }

        const updated = await tx.financialPeriod.update({
          where: { id: period.id },
          data: {
            status: newState,
            closedBy: newState === PeriodStatus.CLOSED ? userId : null,
            closedAt: newState === PeriodStatus.CLOSED ? new Date() : null,
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'UPDATE',
            resource: 'FinancialPeriod',
            resourceId: period.id,
            changes: {
              status: { old: period.status, new: newState },
              periodYear: { old: null, new: year },
              periodMonth: { old: null, new: month },
            },
          },
        });

        return updated;
      });
    });
  }

  async checkIsClosed(organizationId: string, date: Date): Promise<boolean> {
    const period = await this.getPeriodForDate(organizationId, date);
    return period?.status === 'CLOSED';
  }

  private async getPeriodForDate(organizationId: string, date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return this.prisma.financialPeriod.findUnique({
      where: {
        organizationId_periodYear_periodMonth: {
          organizationId,
          periodYear: year,
          periodMonth: month,
        },
      },
      select: { status: true },
    });
  }

  async ensureNotClosedTx(
    tx: TxLike,
    organizationId: string,
    date: Date,
  ): Promise<void> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const period = await this.getPeriodWithLock(tx, organizationId, year, month);

    if (!period) {
      return;
    }

    if (period.status === 'CLOSED') {
      throw new ForbiddenException('FINANCIAL_PERIOD_CLOSED');
    }
  }

  async ensureNotClosed(organizationId: string, date: Date) {
    const isClosed = await this.checkIsClosed(organizationId, date);
    if (isClosed) {
      throw new ForbiddenException('FINANCIAL_PERIOD_CLOSED');
    }
  }
}
