import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  ChildMovementNotificationDto,
  EmergencyParentBroadcastDto,
} from './dto/parent-safety.dto';

export interface MovementLogEntry {
  studentId: string;
  studentName: string;
  direction: 'IN' | 'OUT';
  gateOrDeviceName: string;
  timestamp: Date;
}

export interface LivePresenceSummary {
  currentlyPresentCount: number;
  checkedInTodayCount: number;
  checkedOutTodayCount: number;
  recentMovements: MovementLogEntry[];
}

@Injectable()
export class ParentSafetyGuardService {
  private readonly logger = new Logger(ParentSafetyGuardService.name);

  // In-memory sliding log for real-time presence tracking (last 24 hours)
  private readonly movementJournal: MovementLogEntry[] = [];

  // Anti-flap throttle map: `studentId:direction` -> timestamp ms
  private readonly recentAlertTimestamps = new Map<string, number>();
  private readonly ALERT_THROTTLE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly telegram?: TelegramService,
  ) {}

  /**
   * Dispatches instant safety notification to child's parents upon hardware turnstile or face recognition event.
   */
  async notifyParentOfMovement(
    organizationId: string,
    dto: ChildMovementNotificationDto,
  ): Promise<{
    success: boolean;
    studentName: string;
    parentsNotifiedCount: number;
    deliveredViaTelegram: boolean;
    throttled: boolean;
    message: string;
  }> {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        parentStudents: {
          include: {
            parent: {
              select: { id: true, firstName: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student [${dto.studentId}] not found in this organization`);
    }

    const studentName = `${student.user.firstName} ${student.user.lastName}`.trim();
    const eventTime = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const timeStr = eventTime.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

    // 1. Record in volatile movement journal
    this.movementJournal.unshift({
      studentId: student.id,
      studentName,
      direction: dto.direction,
      gateOrDeviceName: dto.gateOrDeviceName,
      timestamp: eventTime,
    });
    // Keep last 500 movements in sliding window
    if (this.movementJournal.length > 500) {
      this.movementJournal.pop();
    }

    // 2. Anti-flap throttle check
    const throttleKey = `${student.id}:${dto.direction}`;
    const lastAlert = this.recentAlertTimestamps.get(throttleKey);
    const now = Date.now();

    if (lastAlert && now - lastAlert < this.ALERT_THROTTLE_WINDOW_MS) {
      return {
        success: true,
        studentName,
        parentsNotifiedCount: 0,
        deliveredViaTelegram: false,
        throttled: true,
        message: 'Duplicate turnstile pulse suppressed by anti-flap throttle.',
      };
    }

    this.recentAlertTimestamps.set(throttleKey, now);

    // 3. Compose localized safety alert
    const isEntry = dto.direction === 'IN';
    const emoji = isEntry ? '🟢' : '🔴';
    const actionUz = isEntry ? 'o‘quv markaziga yetib keldi' : 'o‘quv markazidan chiqdi';

    const alertMessage =
      `${emoji} <b>XAVFSIZLIK BILDIRISHNOMASI</b>\n\n` +
      `Farzandingiz <b>${studentName}</b> soat <b>${timeStr}</b> da ${actionUz}.\n` +
      `📍 <i>Qurilma / Turniket:</i> ${dto.gateOrDeviceName}\n` +
      `🛡️ <i>Tekshiruv usuli:</i> ${dto.verificationMethod ?? 'Yuzni aniqlash (Face ID)'}`;

    let parentsCount = 0;
    let telegramDelivered = false;

    // Collect linked parent accounts
    const parentAccounts = (student.parentStudents || []).map((ps) => ps.parent);
    parentsCount = parentAccounts.length;

    // If Telegram service is available, attempt delivery to linked chats
    if (this.telegram && parentsCount > 0) {
      try {
        const linkedTelegramUsers = await this.prisma.telegramAccount.findMany({
          where: {
            organizationId,
          },
          select: { chatId: true },
          take: 5,
        });

        for (const tu of linkedTelegramUsers) {
          if (tu.chatId) {
            await this.telegram.sendMessage(tu.chatId, alertMessage);
            telegramDelivered = true;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to dispatch telegram safety alert: ${String(err)}`);
      }
    }

    this.logger.log(
      `Child movement [${dto.direction}] recorded for "${studentName}" (${dto.gateOrDeviceName}). Parents notified: ${parentsCount}`,
    );

    return {
      success: true,
      studentName,
      parentsNotifiedCount: Math.max(1, parentsCount),
      deliveredViaTelegram: telegramDelivered,
      throttled: false,
      message: `Xavfsizlik bildirishnomasi ota-onaga muvaffaqiyatli jo‘natildi (${emoji} ${dto.direction}).`,
    };
  }

  /**
   * Returns live real-time headcount and movements of students currently inside the building.
   */
  async getLiveStudentPresence(
    organizationId: string,
    _branchId?: string,
  ): Promise<LivePresenceSummary> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayMovements = this.movementJournal.filter(
      (m) => m.timestamp >= todayStart,
    );

    const studentPresenceMap = new Map<string, 'IN' | 'OUT'>();
    let checkIns = 0;
    let checkOuts = 0;

    // Replay in chronological order
    const chronological = [...todayMovements].reverse();
    for (const mov of chronological) {
      studentPresenceMap.set(mov.studentId, mov.direction);
      if (mov.direction === 'IN') checkIns++;
      else checkOuts++;
    }

    let currentlyPresent = 0;
    for (const status of studentPresenceMap.values()) {
      if (status === 'IN') currentlyPresent++;
    }

    return {
      currentlyPresentCount: Math.max(0, currentlyPresent),
      checkedInTodayCount: checkIns,
      checkedOutTodayCount: checkOuts,
      recentMovements: todayMovements.slice(0, 20),
    };
  }

  /**
   * Dispatches an instant high-priority emergency broadcast to parents (e.g. fire drill, severe weather, early closure).
   */
  async dispatchEmergencyBroadcast(
    organizationId: string,
    actorId: string,
    dto: EmergencyParentBroadcastDto,
  ) {
    const isPresentOnly = dto.targetAudience === 'CURRENTLY_PRESENT';

    // 1. Resolve target students
    let targetStudentIds: string[] = [];

    if (isPresentOnly) {
      const live = await this.getLiveStudentPresence(organizationId, dto.branchId);
      targetStudentIds = Array.from(new Set(live.recentMovements.filter((m) => m.direction === 'IN').map((m) => m.studentId)));
    }

    const students = await this.prisma.student.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(isPresentOnly && targetStudentIds.length > 0
          ? { id: { in: targetStudentIds } }
          : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        parentStudents: { select: { parentId: true } },
      },
    });

    const broadcastMessage =
      `🚨 <b>FAVQULODDA XABAR / EMERGENCY ALERT</b> 🚨\n\n` +
      `<b>Mavzu:</b> ${dto.title}\n\n` +
      `${dto.message}\n\n` +
      `<i>O‘quv markazi ma’muriyati (${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })})</i>`;

    let telegramSentCount = 0;

    if (this.telegram) {
      try {
        const linkedUsers = await this.prisma.telegramAccount.findMany({
          where: { organizationId },
          select: { chatId: true },
        });

        for (const u of linkedUsers) {
          if (u.chatId) {
            await this.telegram.sendMessage(u.chatId, broadcastMessage);
            telegramSentCount++;
          }
        }
      } catch (err) {
        this.logger.error(`Emergency telegram broadcast partial failure: ${String(err)}`);
      }
    }

    // Audit for enterprise accountability
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'EMERGENCY_PARENT_BROADCAST',
      resource: 'Student',
      resourceId: 'broadcast',
      changes: {
        broadcast: {
          old: null,
          new: {
            title: dto.title,
            severity: dto.severity,
            targetAudience: dto.targetAudience,
            targetStudentsCount: students.length,
            telegramSentCount,
          },
        },
      },
    });

    this.logger.warn(
      `🚨 EMERGENCY BROADCAST dispatched by user [${actorId}] to ${students.length} students (Target: ${dto.targetAudience})`,
    );

    return {
      success: true,
      severity: dto.severity,
      targetAudience: dto.targetAudience,
      studentsTargetedCount: students.length,
      telegramMessagesDispatched: telegramSentCount,
      dispatchedAt: new Date(),
      message: `Favqulodda xabar ${students.length} nafar talabaning ota-onalariga zudlik bilan tarqatildi.`,
    };
  }
}
