import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationEventService } from '../notifications/events/notification-event.service';

/**
 * Daily financial maintenance:
 *  - marks ISSUED / PARTIALLY_PAID invoices past their due date as OVERDUE
 *    (linked unpaid Payment rows follow to OVERDUE as well).
 *
 * Idempotent: only rows not already OVERDUE are updated, so re-runs and
 * multi-instance deployments converge without double effects. PAID and
 * CANCELLED invoices are never touched.
 */
@Injectable()
export class FinancialCronService {
  private readonly logger = new Logger(FinancialCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEvents: NotificationEventService,
  ) {}

  async markOverdueInvoices() {
    const now = new Date();
    try {
      // Read the about-to-become-overdue invoices first so we can emit one
      // notification event per affected student (before the bulk update).
      const dueInvoices = await this.prisma.invoice.findMany({
        where: {
          dueDate: { lt: now },
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        },
        select: {
          id: true,
          organizationId: true,
          studentId: true,
          total: true,
          paidAmount: true,
          refundedAmount: true,
          dueDate: true,
          student: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      });

      const invoices = await this.prisma.invoice.updateMany({
        where: {
          dueDate: { lt: now },
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        },
        data: { status: 'OVERDUE' },
      });

      const payments = await this.prisma.payment.updateMany({
        where: {
          dueDate: { lt: now },
          status: 'PENDING',
        },
        data: { status: 'OVERDUE' },
      });

      // Emit independently (one failing notification must not block the rest)
      // and concurrently rather than N serial round-trips.
      await Promise.allSettled(
        dueInvoices.map(invoice => {
          const remaining =
            Number(invoice.total) -
            Number(invoice.paidAmount ?? 0) +
            Number(invoice.refundedAmount ?? 0);
          return this.notificationEvents.emit({
            organizationId: invoice.organizationId,
            type: 'PAYMENT_OVERDUE',
            occurredAt: now.toISOString(),
            entityType: 'Invoice',
            entityId: invoice.id,
            data: {
              studentId: invoice.studentId,
              studentName:
                `${invoice.student.user.firstName} ${invoice.student.user.lastName}`.trim(),
              amount: Math.max(0, remaining),
              date: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : undefined,
            },
          });
        }),
      );

      if (invoices.count > 0 || payments.count > 0) {
        this.logger.log(
          `overdue_marked invoices=${invoices.count} payments=${payments.count} events=${dueInvoices.length}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to mark overdue invoices', error);
    }
  }

  /**
   * Upcoming Payment Reminders
   * Runs daily at 10:00 AM.
   * Finds invoices due in exactly 3 days and sends a reminder.
   */
  async remindUpcomingPayments() {
    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(Date.UTC(inThreeDays.getUTCFullYear(), inThreeDays.getUTCMonth(), inThreeDays.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(inThreeDays.getUTCFullYear(), inThreeDays.getUTCMonth(), inThreeDays.getUTCDate(), 23, 59, 59, 999));

    try {
      const upcomingInvoices = await this.prisma.invoice.findMany({
        where: {
          dueDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        },
        select: {
          id: true,
          organizationId: true,
          studentId: true,
          total: true,
          paidAmount: true,
          refundedAmount: true,
          dueDate: true,
          student: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      });

      if (upcomingInvoices.length === 0) return;

      await Promise.allSettled(
        upcomingInvoices.map(invoice => {
          const remaining =
            Number(invoice.total) -
            Number(invoice.paidAmount ?? 0) +
            Number(invoice.refundedAmount ?? 0);
          return this.notificationEvents.emit({
            organizationId: invoice.organizationId,
            type: 'PAYMENT_REMINDER',
            occurredAt: now.toISOString(),
            entityType: 'Invoice',
            entityId: invoice.id,
            data: {
              studentId: invoice.studentId,
              studentName: `${invoice.student.user.firstName} ${invoice.student.user.lastName}`.trim(),
              amount: Math.max(0, remaining),
              date: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : undefined,
              daysLeft: 3,
            },
          });
        }),
      );

      this.logger.log(`upcoming_payment_reminders_sent count=${upcomingInvoices.length}`);
    } catch (error) {
      this.logger.error('Failed to send upcoming payment reminders', error);
    }
  }
}

