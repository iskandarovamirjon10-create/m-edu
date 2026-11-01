import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParentSafetyGuardService } from '../parent-safety-guard.service';

describe('ParentSafetyGuardService', () => {
  let service: ParentSafetyGuardService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockTelegram: any;

  beforeEach(() => {
    mockPrisma = {
      student: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      telegramAccount: {
        findMany: vi.fn().mockResolvedValue([{ chatId: 'chat-parent-1' }]),
      },
    };
    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };
    mockTelegram = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    service = new ParentSafetyGuardService(mockPrisma, mockAudit, mockTelegram);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('notifies parent of child entry movement and records in live presence journal', async () => {
    const mockStudent = {
      id: 'student-safe-1',
      organizationId: 'org-1',
      parentPhone: '+998901112233',
      user: { firstName: 'Davron', lastName: 'Xolmatov' },
      parentStudents: [
        {
          parent: {
            id: 'parent-1',
            firstName: 'Bahodir',
            phone: '+998901112233',
          },
        },
      ],
    };

    mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
    mockPrisma.telegramAccount.findMany.mockResolvedValue([{ chatId: 'chat-parent-1' }]);

    const result = await service.notifyParentOfMovement('org-1', {
      studentId: 'student-safe-1',
      direction: 'IN',
      gateOrDeviceName: 'Turniket #1 (Asosiy)',
      verificationMethod: 'FACE_RECOGNITION',
    });

    expect(result.success).toBe(true);
    expect(result.studentName).toBe('Davron Xolmatov');
    expect(result.parentsNotifiedCount).toBe(1);
    expect(result.deliveredViaTelegram).toBe(true);
    expect(mockTelegram.sendMessage).toHaveBeenCalledWith(
      'chat-parent-1',
      expect.stringContaining('XAVFSIZLIK BILDIRISHNOMASI'),
    );

    // Verify live presence journal
    const presence = await service.getLiveStudentPresence('org-1');
    expect(presence.currentlyPresentCount).toBe(1);
    expect(presence.checkedInTodayCount).toBe(1);
  });

  it('suppresses duplicate turnstile pulses within anti-flap window', async () => {
    const mockStudent = {
      id: 'student-safe-flap',
      organizationId: 'org-1',
      user: { firstName: 'Davron', lastName: 'Xolmatov' },
      parentStudents: [],
    };
    mockPrisma.student.findFirst.mockResolvedValue(mockStudent);

    // First pulse
    await service.notifyParentOfMovement('org-1', {
      studentId: 'student-safe-flap',
      direction: 'IN',
      gateOrDeviceName: 'Turniket #1',
    });

    // Immediate second pulse (flap)
    const secondResult = await service.notifyParentOfMovement('org-1', {
      studentId: 'student-safe-flap',
      direction: 'IN',
      gateOrDeviceName: 'Turniket #1',
    });

    expect(secondResult.throttled).toBe(true);
    expect(secondResult.parentsNotifiedCount).toBe(0);
  });

  it('dispatches emergency broadcast to parents with audit trail', async () => {
    mockPrisma.student.findMany.mockResolvedValue([
      {
        id: 'st-1',
        user: { firstName: 'Ali', lastName: 'Valiyev' },
        parentStudents: [{ parentId: 'p-1' }],
      },
    ]);
    mockPrisma.telegramAccount.findMany.mockResolvedValue([{ chatId: 'chat-p-1' }]);

    const broadcastResult = await service.dispatchEmergencyBroadcast('org-1', 'admin-1', {
      title: 'Toshkentda kuchli qor yog‘ishi',
      message: 'Bugungi darslar soat 16:00 da tugatiladi. Iltimos bolalarni o‘z vaqtida olib keting.',
      severity: 'CRITICAL',
      targetAudience: 'ALL_ACTIVE_STUDENTS',
    });

    expect(broadcastResult.success).toBe(true);
    expect(broadcastResult.studentsTargetedCount).toBe(1);
    expect(broadcastResult.telegramMessagesDispatched).toBe(1);
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMERGENCY_PARENT_BROADCAST',
      }),
    );
  });
});
