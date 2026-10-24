import { Injectable, Logger } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { TelegramDeliveryService } from './telegram-delivery.service';
import { escapeHtml } from './ui/format';

const DOW_MAP: Record<number, DayOfWeek> = {
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
  0: DayOfWeek.SUNDAY,
  7: DayOfWeek.SUNDAY,
};

@Injectable()
export class TelegramExecutiveBriefingService {
  private readonly logger = new Logger(TelegramExecutiveBriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly delivery: TelegramDeliveryService,
  ) {}

  /**
   * Generates and dispatches executive morning briefing to all linked administrators
   * of the specified organization (or all organizations if none specified).
   */
  async dispatchDailyBriefing(organizationId?: string): Promise<{ sent: number; failed: number }> {
    const orgs = await this.prisma.organization.findMany({
      where: organizationId ? { id: organizationId } : {},
      select: { id: true, name: true, timezone: true },
    });

    let sent = 0;
    let failed = 0;

    for (const org of orgs) {
      try {
        const briefingText = await this.generateBriefingText(org.id, org.name, org.timezone);

        // Find all active admin users of this organization
        const admins = await this.prisma.user.findMany({
          where: {
            organizationId: org.id,
            role: { in: ['ORG_ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'MANAGER'] },
            isActive: true,
          },
          select: { id: true },
        });

        if (admins.length === 0) continue;

        // Resolve active Telegram delivery targets
        const targets = await this.delivery.resolveActiveTargetsForPrincipals(
          org.id,
          admins.map((a) => ({ type: 'USER', userId: a.id })),
        );

        const targetList = Array.from(targets.values());
        // LOGIC-05: Non-blocking bounded batch dispatch with Promise.allSettled
        const BATCH_SIZE = 5;
        for (let i = 0; i < targetList.length; i += BATCH_SIZE) {
          const batch = targetList.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map((target) =>
              this.telegram.sendMessageDetailed(String(target.chatId), briefingText),
            ),
          );
          for (const res of results) {
            if (res.status === 'fulfilled' && res.value.ok) {
              sent++;
            } else {
              failed++;
            }
          }
        }
      } catch (err: unknown) {
        this.logger.error(
          `Failed to dispatch executive briefing for org ${org.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Generates briefing text for an organization.
   */
  async generateBriefingText(
    organizationId: string,
    orgName: string,
    timezone?: string | null,
  ): Promise<string> {
    const tz = timezone || 'Asia/Tashkent';
    const today = new Date();
    const now = today;

    let dayOfWeek: DayOfWeek = DayOfWeek.MONDAY;
    try {
      const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'long',
      });
      const weekdayName = weekdayFormatter.format(now).toUpperCase();
      const weekdayToDow: Record<string, DayOfWeek> = {
        MONDAY: DayOfWeek.MONDAY,
        TUESDAY: DayOfWeek.TUESDAY,
        WEDNESDAY: DayOfWeek.WEDNESDAY,
        THURSDAY: DayOfWeek.THURSDAY,
        FRIDAY: DayOfWeek.FRIDAY,
        SATURDAY: DayOfWeek.SATURDAY,
        SUNDAY: DayOfWeek.SUNDAY,
      };
      dayOfWeek = weekdayToDow[weekdayName] || DayOfWeek.MONDAY;
    } catch {
      dayOfWeek = DOW_MAP[now.getDay()] || DayOfWeek.MONDAY;
    }

    let dateStr = '';
    try {
      dateStr = now.toLocaleDateString('uz-UZ', {
        timeZone: tz,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      dateStr = now.toLocaleDateString('uz-UZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    // 1-4. Parallel database profiling and querying (all independent aggregations)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    yesterday.setHours(0, 0, 0, 0);

    const [
      schedulesToday,
      paymentsYesterday,
      overdueInvoices,
      cameras,
      recentAbsences,
    ] = await Promise.all([
      this.prisma.schedule.findMany({
        where: {
          isActive: true,
          group: { organizationId, isActive: true },
          dayOfWeek,
        },
        include: {
          group: {
            include: {
              _count: { select: { enrollments: true } },
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId,
          createdAt: { gte: yesterday, lt: today },
          status: 'PAID',
        },
        select: { amount: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          status: 'OVERDUE',
        },
        select: { total: true },
      }),
      this.prisma.camera.findMany({
        where: { organizationId },
        select: { id: true, enabled: true, status: true },
      }),
      this.prisma.attendance.groupBy({
        by: ['studentId'],
        where: {
          organizationId,
          status: 'ABSENT',
          date: { gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
        _count: { studentId: true },
        having: {
          studentId: { _count: { gte: 2 } },
        },
      }),
    ]);

    const totalGroups = schedulesToday.length;
    const totalExpectedStudents = schedulesToday.reduce(
      (sum, s) => sum + (s.group._count?.enrollments || 0),
      0,
    );

    const yesterdayRevenue = paymentsYesterday.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const overdueCount = overdueInvoices.length;
    const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

    const onlineCameras = cameras.filter((c) => c.enabled && c.status === 'ONLINE').length;
    const totalCameras = cameras.length;
    const riskStudentCount = recentAbsences.length;

    const fmt = (num: number) =>
      new Intl.NumberFormat('uz-UZ').format(Math.round(num)).replace(/\u00A0/g, ' ') + ' UZS';

    return (
      `🏛 <b>M-EDU Boshqaruv Brifingi · ${dateStr}</b>\n` +
      `🏢 <i>${escapeHtml(orgName)}</i>\n\n` +
      `📚 <b>Bugungi Reja va Darslar:</b>\n` +
      `• Rejalashtirilgan guruhlar: <b>${totalGroups} ta</b>\n` +
      `• Kutilayotgan talabalar: <b>${totalExpectedStudents} nafar</b>\n` +
      `• Kameralar / Turniket holati: <b>${onlineCameras}/${totalCameras} faol</b>\n\n` +
      `💰 <b>Kassa & Moliya (24 soat):</b>\n` +
      `• Kechagi tushum: <b>${fmt(yesterdayRevenue)}</b>\n` +
      `• Muddati o'tgan qarzlar: <b>${fmt(overdueTotal)} (${overdueCount} ta)</b>\n\n` +
      `⚠️ <b>E'tibor talab holatlar (Risks):</b>\n` +
      (riskStudentCount > 0
        ? `• <b>${riskStudentCount} nafar o'quvchi</b> oxirgi haftada 2+ marta dars qoldirdi.\n`
        : `• Davomat bo'yicha xavfli anomaliyalar yo'q. Hammasi joyida.\n`) +
      `\n<i>Tizim 24/7 rejimida xavfsiz faoliyat yuritmoqda.</i>`
    );
  }
}
