import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramExecutiveBriefingService } from '../telegram-executive-briefing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram.service';
import { TelegramDeliveryService } from '../telegram-delivery.service';

describe('TelegramExecutiveBriefingService', () => {
  let prisma: {
    organization: { findMany: ReturnType<typeof vi.fn> };
    user: { findMany: ReturnType<typeof vi.fn> };
    schedule: { findMany: ReturnType<typeof vi.fn> };
    payment: { findMany: ReturnType<typeof vi.fn> };
    invoice: { findMany: ReturnType<typeof vi.fn> };
    camera: { findMany: ReturnType<typeof vi.fn> };
    attendance: { groupBy: ReturnType<typeof vi.fn> };
  };
  let telegram: { sendMessageDetailed: ReturnType<typeof vi.fn> };
  let delivery: { resolveActiveTargetsForPrincipals: ReturnType<typeof vi.fn> };
  let service: TelegramExecutiveBriefingService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      organization: { findMany: vi.fn() },
      user: { findMany: vi.fn() },
      schedule: { findMany: vi.fn() },
      payment: { findMany: vi.fn() },
      invoice: { findMany: vi.fn() },
      camera: { findMany: vi.fn() },
      attendance: { groupBy: vi.fn() },
    };
    telegram = {
      sendMessageDetailed: vi.fn().mockResolvedValue({ ok: true, messageId: 101 }),
    };
    delivery = {
      resolveActiveTargetsForPrincipals: vi.fn(),
    };

    service = new TelegramExecutiveBriefingService(
      prisma as unknown as PrismaService,
      telegram as unknown as TelegramService,
      delivery as unknown as TelegramDeliveryService,
    );
  });

  describe('generateBriefingText', () => {
    it('aggregates daily metrics and formats executive HTML message', async () => {
      prisma.schedule.findMany.mockResolvedValue([
        {
          group: {
            _count: { enrollments: 18 },
          },
        },
        {
          group: {
            _count: { enrollments: 12 },
          },
        },
      ]);

      prisma.payment.findMany.mockResolvedValue([
        { amount: 1500000 },
        { amount: 850000 },
      ]);

      prisma.invoice.findMany.mockResolvedValue([
        { total: 450000 },
        { total: 600000 },
      ]);

      prisma.camera.findMany.mockResolvedValue([
        { id: 'cam-1', enabled: true, status: 'ONLINE' },
        { id: 'cam-2', enabled: true, status: 'ONLINE' },
        { id: 'cam-3', enabled: true, status: 'OFFLINE' },
      ]);

      prisma.attendance.groupBy.mockResolvedValue([
        { studentId: 'stud-1', _count: { studentId: 3 } },
      ]);

      const text = await service.generateBriefingText('org-10', 'Cambridge Edu Center');

      expect(text).toContain('Cambridge Edu Center');
      expect(text).toContain('M-EDU Boshqaruv Brifingi');
      expect(text).toContain('Rejalashtirilgan guruhlar: <b>2 ta</b>');
      expect(text).toContain('Kutilayotgan talabalar: <b>30 nafar</b>');
      expect(text).toContain('Kameralar / Turniket holati: <b>2/3 faol</b>');
      expect(text).toContain('2 350 000 UZS'); // 1,500,000 + 850,000
      expect(text).toContain('1 050 000 UZS'); // 450,000 + 600,000 overdue
      expect(text).toContain('1 nafar o\'quvchi');
      expect(text).toContain('2+ marta dars qoldirdi');
    });

    it('reports no risks when zero students have consecutive absences', async () => {
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.camera.findMany.mockResolvedValue([]);
      prisma.attendance.groupBy.mockResolvedValue([]);

      const text = await service.generateBriefingText('org-1', 'Test Org');

      expect(text).toContain('Davomat bo\'yicha xavfli anomaliyalar yo\'q. Hammasi joyida.');
    });

    it('escapes organization name containing HTML special characters to prevent parse errors', async () => {
      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.camera.findMany.mockResolvedValue([]);
      prisma.attendance.groupBy.mockResolvedValue([]);

      const text = await service.generateBriefingText('org-1', '<Special & "Org">');

      expect(text).toContain('&lt;Special &amp; "Org"&gt;');
      expect(text).not.toContain('<Special');
    });
  });

  describe('dispatchDailyBriefing', () => {
    it('sends briefing to all active admin Telegram targets', async () => {
      prisma.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Al-Beruniy School', timezone: 'Asia/Tashkent' },
      ]);

      prisma.user.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);

      prisma.schedule.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.camera.findMany.mockResolvedValue([]);
      prisma.attendance.groupBy.mockResolvedValue([]);

      const targetMap = new Map();
      targetMap.set('admin-1', { chatId: 111111 });
      targetMap.set('admin-2', { chatId: 222222 });
      delivery.resolveActiveTargetsForPrincipals.mockResolvedValue(targetMap);

      const result = await service.dispatchDailyBriefing('org-1');

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(telegram.sendMessageDetailed).toHaveBeenCalledTimes(2);
      expect(telegram.sendMessageDetailed).toHaveBeenCalledWith("111111", expect.any(String));
      expect(telegram.sendMessageDetailed).toHaveBeenCalledWith("222222", expect.any(String));
    });
  });
});
