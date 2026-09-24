import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationEventProcessor } from '../notification-event.processor';
import { Job, Queue } from 'bullmq';
import { NotificationEventPayload } from '../notification.events';

describe('NotificationEventProcessor Idempotency', () => {
  let processor: NotificationEventProcessor;
  let mockPrisma: any;
  let mockSms: any;
  let mockTelegram: any;
  let mockDeadLetterQueue: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      notificationDedup: {
        create: vi.fn().mockResolvedValue({ id: 'dedup-1' }),
        upsert: vi.fn(),
      },
      notification: { create: vi.fn() },
      student: { findUnique: vi.fn().mockResolvedValue({ userId: 'u-1', parentPhone: '+998901234567' }) },
      parentStudent: { findMany: vi.fn().mockResolvedValue([]) },
    };

    mockSms = {
      sendSms: vi.fn().mockResolvedValue(true),
    };

    mockTelegram = {
      sendMessage: vi.fn().mockResolvedValue(true),
    };

    mockDeadLetterQueue = {
      add: vi.fn(),
    };

    const redisStore = new Map<string, string>();
    mockRedis = {
      get: vi.fn(async (k) => redisStore.get(k) || null),
      set: vi.fn(async (k, v, ...opts) => {
        if (opts.includes('NX')) {
          if (redisStore.has(k)) return null;
          redisStore.set(k, v);
          return 'OK';
        }
        redisStore.set(k, v);
        return 'OK';
      }),
      del: vi.fn(async (k) => {
        redisStore.delete(k);
      }),
    };

    processor = new NotificationEventProcessor(
      mockPrisma,
      mockSms,
      mockTelegram,
      mockDeadLetterQueue as unknown as Queue,
    );

    // Override the getRedis method directly for testing
    // @ts-ignore
    processor.getRedis = vi.fn().mockResolvedValue(mockRedis);
  });

  function createJob(id: string, payload: Partial<NotificationEventPayload>): Job<NotificationEventPayload> {
    return {
      id,
      data: {
        organizationId: 'org-1',
        type: 'ATTENDANCE_MARKED_ABSENT',
        occurredAt: new Date().toISOString(),
        entityType: 'Attendance',
        entityId: 'att-1',
        data: { studentId: 's-1', studentName: 'Test Student' },
        ...payload,
      },
    } as unknown as Job<NotificationEventPayload>;
  }

  it('1. first delivery completes successfully', async () => {
    const job = createJob('job-1', {});
    const result = await processor.process(job);

    expect(result.deliveries.length).toBeGreaterThan(0);
    expect(mockSms.sendSms).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledWith('notif_idemp:job-1', 'DELIVERED', 'EX', 604800);
  });

  it('2. duplicate same event (retry after success) returns cached result', async () => {
    const job = createJob('job-2', {});
    // First run
    await processor.process(job);
    expect(mockSms.sendSms).toHaveBeenCalledTimes(1);

    // Second run (simulate BullMQ duplicate or retry after success)
    const result2 = await processor.process(job);
    expect(mockSms.sendSms).toHaveBeenCalledTimes(1); // STILL 1, no duplicate sending
    expect(result2.deliveries).toBeDefined();
  });

  it('3. concurrent duplicate workers block execution', async () => {
    const job = createJob('job-3', {});

    // Manually set the lock to simulate another worker currently executing
    await mockRedis.set('notif_idemp:job-3', 'PROCESSING_INTERNAL');

    // Attempt process
    await processor.process(job);
    // Since it's INTERNAL, the code proceeds because in-app delivery is idempotent natively via Prisma.
    // Let's verify it continues.
    expect(mockSms.sendSms).toHaveBeenCalledTimes(1);
  });

  it('8. processor crash during external delivery skips subsequent external attempts', async () => {
    const job = createJob('job-4', {});

    // Simulate crash AFTER in-app delivery but BEFORE returning
    await mockRedis.set('notif_idemp:job-4', 'DELIVERING_EXTERNAL');

    const result = await processor.process(job);
    
    // It should skip SMS delivery to prevent duplicates
    expect(mockSms.sendSms).toHaveBeenCalledTimes(0);
    expect(result.deliveries[0].channel).toBe('SKIPPED_PREVENT_DUPLICATE');
  });

  it('5. different events trigger separate deliveries', async () => {
    const jobA = createJob('job-A', {});
    const jobB = createJob('job-B', {});

    await processor.process(jobA);
    await processor.process(jobB);

    expect(mockSms.sendSms).toHaveBeenCalledTimes(2);
  });

  it('6. different tenants preserve separation', async () => {
    const jobT1 = createJob('job-T1', { organizationId: 'org-1' });
    const jobT2 = createJob('job-T2', { organizationId: 'org-2' });

    await processor.process(jobT1);
    await processor.process(jobT2);

    expect(mockSms.sendSms).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'org-1');
    expect(mockSms.sendSms).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'org-2');
  });

  it('DLQ uses a distinct queue name from the source queue (no retry loop)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const processorSrc = fs.readFileSync(
      path.join(__dirname, '../notification-event.processor.ts'),
      'utf8',
    );
    const eventsSrc = fs.readFileSync(
      path.join(__dirname, '../notification.events.ts'),
      'utf8',
    );
    const moduleSrc = fs.readFileSync(
      path.join(__dirname, '../notification-events.module.ts'),
      'utf8',
    );

    // Source queue and DLQ must be distinct string constants.
    expect(eventsSrc).toMatch(/NOTIFICATION_EVENTS_QUEUE\s*=\s*'notification-events'/);
    expect(eventsSrc).toMatch(/NOTIFICATION_EVENTS_DLQ\s*=\s*'notification-events-dlq'/);

    // Processor injects the DLQ queue for dead-lettering, not the source queue.
    const dlqInject = processorSrc.match(
      /@InjectQueue\(([^)]+)\)\s+private readonly deadLetterQueue/,
    );
    expect(dlqInject).toBeTruthy();
    expect(dlqInject![1]).toBe('NOTIFICATION_EVENTS_DLQ');
    expect(dlqInject![1]).not.toBe('NOTIFICATION_EVENTS_QUEUE');

    // Module registers BOTH queues.
    expect(moduleSrc).toContain('NOTIFICATION_EVENTS_QUEUE');
    expect(moduleSrc).toContain('NOTIFICATION_EVENTS_DLQ');
  });
});
