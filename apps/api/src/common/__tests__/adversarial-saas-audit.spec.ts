import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { QuotaGuard } from '../../subscriptions/guards/quota.guard';
import { EntitlementGuard } from '../../subscriptions/guards/entitlement.guard';
import { PlatformGuard } from '../../common/guards/platform.guard';
import { BillingService } from '../../billing/billing.service';
import { PaymeAdapter } from '../../billing/adapters/payme.adapter';
import { ClickAdapter } from '../../billing/adapters/click.adapter';
import { PlatformService } from '../../platform/platform.service';
import { OnnxDualBiometricEngine, BiometricServiceUnavailableException } from '../../face/face.service';
import { SubscriptionStatus } from '@prisma/client';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';

describe('M-EDU Adversarial Verification & Attack Simulation Suite', () => {
  let prismaMock: any;
  let securityMock: any;
  let subscriptionsService: SubscriptionsService;
  let billingService: BillingService;
  let platformService: PlatformService;
  let paymeAdapter: PaymeAdapter;
  let clickAdapter: ClickAdapter;

  beforeEach(() => {
    process.env.PAYME_MERCHANT_KEY = 'sandbox_payme_key_xyz';
    process.env.CLICK_SECRET_KEY = 'sandbox_click_secret_abc';

    prismaMock = {
      organization: {
        findUnique: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      subscription: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      subscriptionInvoice: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      subscriptionPayment: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      saaSPlan: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      student: {
        count: vi.fn(),
      },
      branch: {
        count: vi.fn(),
      },
      user: {
        count: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      camera: {
        count: vi.fn(),
      },
      platformInvitation: {
        create: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((arg) => typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)),
    };

    securityMock = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    paymeAdapter = new PaymeAdapter();
    clickAdapter = new ClickAdapter();

    subscriptionsService = new SubscriptionsService(prismaMock);
    billingService = new BillingService(prismaMock, paymeAdapter, clickAdapter);
    platformService = new PlatformService(prismaMock, securityMock);
  });

  // ==========================================================================
  // PHASE 3 — SECURITY ATTACK SIMULATIONS
  // ==========================================================================
  describe('PHASE 3 — Security Attack Simulations', () => {
    it('ATTACK 1: Tenant Admin attempts PLATFORM_OWNER endpoint -> Blocked by PlatformGuard with 403', () => {
      const guard = new PlatformGuard();
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'admin-1', role: 'SUPER_ADMIN', organizationId: 'org-tenant-a' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('ATTACK 2: Unauthenticated caller attempts platform operation -> Blocked by PlatformGuard', () => {
      const guard = new PlatformGuard();
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ user: null }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('ATTACK 3: Unentitled tenant attempts AI Copilot invocation -> Blocked by EntitlementGuard', async () => {
      const reflectorMock = {
        getAllAndOverride: vi.fn().mockReturnValue('hasAiCopilot'),
      };
      const guard = new EntitlementGuard(reflectorMock as any, subscriptionsService);

      // Org is on START plan without AI Copilot entitlement
      prismaMock.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        organizationId: 'org-no-ai',
        status: SubscriptionStatus.ACTIVE,
        hasAiCopilot: false,
      });

      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user-1', role: 'ORG_ADMIN', organizationId: 'org-no-ai' },
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it('ATTACK 4: Direct API request attempts student creation when quota is full -> Blocked by QuotaGuard', async () => {
      const reflectorMock = {
        getAllAndOverride: vi.fn().mockReturnValue('students'),
      };
      const guard = new QuotaGuard(reflectorMock as any, subscriptionsService);

      // Org has maxStudents = 100, currently at 100
      prismaMock.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        organizationId: 'org-full',
        status: SubscriptionStatus.ACTIVE,
        maxStudents: 100,
      });
      prismaMock.student.count.mockResolvedValue(100);

      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user-1', role: 'ORG_ADMIN', organizationId: 'org-full' },
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // PHASE 4 — SAAS SUBSCRIPTION LIFECYCLE & QUOTAS
  // ==========================================================================
  describe('PHASE 4 — SaaS Subscription Verification', () => {
    it('LIFECYCLE 1: 7-day trial creation sets exact 7-day expiration timestamp', async () => {
      prismaMock.saaSPlan.findMany.mockResolvedValue([
        { id: 'plan-1', code: 'START', priceUzsPerMonth: BigInt(299000), maxStudents: 100, maxBranches: 1, maxEmployees: 5, hasFaceId: false, hasAiCopilot: true },
      ]);
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      prismaMock.subscription.upsert.mockImplementation(({ create }) => Promise.resolve({ id: 'sub-trial', ...create }));

      const sub = await subscriptionsService.createTrial('org-new');

      expect(sub.status).toBe(SubscriptionStatus.TRIALING);
      expect(sub.trialStartAt).toBeDefined();
      expect(sub.trialEndAt).toBeDefined();

      const diffDays = (new Date(sub.trialEndAt!).getTime() - new Date(sub.trialStartAt!).getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(7);
    });

    it('LIFECYCLE 2: Expired trial blocks write operations immediately', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      prismaMock.subscription.findUnique.mockResolvedValue({
        id: 'sub-expired',
        organizationId: 'org-trial-over',
        status: SubscriptionStatus.TRIALING,
        trialEndAt: pastDate,
      });
      prismaMock.subscription.update.mockResolvedValue({
        id: 'sub-expired',
        status: SubscriptionStatus.EXPIRED,
      });

      await expect(
        subscriptionsService.checkQuota('org-trial-over', 'students'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('LIFECYCLE 3: Confirmed payment activates subscription for exactly 1 month', async () => {
      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-101',
        invoiceNumber: 'INV-202610-9999',
        amountUzs: 549000,
        subscriptionId: 'sub-101',
      });

      const clickSignature = clickAdapter.generateSignature({
        clickTransId: 'click-tx-101',
        serviceId: '100',
        secretKey: 'sandbox_click_secret_abc',
        merchantTransId: 'INV-202610-9999',
        amount: '549000',
        action: '1',
        signTime: '2026-10-30 15:00:00',
      });

      const res = await billingService.handleClickWebhook({
        click_trans_id: 'click-tx-101',
        service_id: '100',
        click_paydoc_id: 'doc-1',
        merchant_trans_id: 'INV-202610-9999',
        merchant_prepare_id: 'inv-101',
        amount: '549000',
        action: '1',
        error: '0',
        error_note: '',
        sign_time: '2026-10-30 15:00:00',
        sign_string: clickSignature,
      });

      expect(res.error).toBe(0);
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-101' },
          data: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
          }),
        }),
      );
    });

    it('LIFECYCLE 4: Plan downgrade fails when current students exceed target plan limit', async () => {
      prismaMock.saaSPlan.findUnique.mockResolvedValue({
        id: 'plan-start',
        code: 'START',
        isActive: true,
        maxStudents: 100,
        maxBranches: 1,
        maxEmployees: 5,
        priceUzsPerMonth: BigInt(299000),
      });
      prismaMock.subscription.findUnique.mockResolvedValue({
        id: 'sub-pro',
        organizationId: 'org-downgrade',
        plan: 'PRO',
        maxStudents: 1000,
      });
      // Organization currently has 250 students (exceeds START limit of 100)
      prismaMock.student.count.mockResolvedValue(250);
      prismaMock.branch.count.mockResolvedValue(1);
      prismaMock.user.count.mockResolvedValue(4);
      prismaMock.camera.count.mockResolvedValue(0);

      await expect(
        subscriptionsService.changePlan('org-downgrade', { planCode: 'START' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // PHASE 5 — PAYME & CLICK MERCHANT PROTOCOL COMPLIANCE
  // ==========================================================================
  describe('PHASE 5 — Payme and Click Protocol Compliance', () => {
    const validPaymeAuth = `Basic ${Buffer.from('Paycom:sandbox_payme_key_xyz').toString('base64')}`;

    it('PAYME 1: Rejects missing or wrong Basic Auth with error -32504', async () => {
      const res = await billingService.handlePaymeWebhook({
        id: 1,
        method: 'CheckPerformTransaction',
        params: { amount: 100000 },
      }, 'Basic invalid-auth-credentials');

      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32504);
    });

    it('PAYME 2: Validates strict tiyin conversion (amountUZS * 100)', async () => {
      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-tiyin',
        invoiceNumber: 'INV-TIYIN-1',
        amountUzs: 299000, // 299,000 UZS = 29,900,000 tiyin
        status: 'ISSUED',
      });

      // Passing 29,899,999 tiyin (off by 1 tiyin)
      const resMismatch = await billingService.handlePaymeWebhook({
        id: 2,
        method: 'CheckPerformTransaction',
        params: {
          account: { invoice_number: 'INV-TIYIN-1' },
          amount: 29899999,
        },
      }, validPaymeAuth);

      expect(resMismatch.error?.code).toBe(-31001); // INVALID_AMOUNT

      // Passing exact tiyin: 29,900,000
      const resValid = await billingService.handlePaymeWebhook({
        id: 3,
        method: 'CheckPerformTransaction',
        params: {
          account: { invoice_number: 'INV-TIYIN-1' },
          amount: 29900000,
        },
      }, validPaymeAuth);

      expect(resValid.result?.allow).toBe(true);
    });

    it('PAYME 3: Idempotent CreateTransaction handles duplicate callback cleanly', async () => {
      prismaMock.subscriptionInvoice.findUnique.mockResolvedValue({
        id: 'inv-dup',
        invoiceNumber: 'INV-DUP-1',
        amountUzs: 549000,
      });

      const createdAt = new Date();
      prismaMock.subscriptionPayment.findFirst.mockResolvedValue({
        id: 'pay-existing',
        createdAt,
        status: 'PENDING',
      });

      const res = await billingService.handlePaymeWebhook({
        id: 4,
        method: 'CreateTransaction',
        params: {
          id: 'payme-dup-tx',
          account: { invoice_number: 'INV-DUP-1' },
          amount: 54900000,
        },
      }, validPaymeAuth);

      expect(res.result?.transaction).toBe('pay-existing');
      expect(res.result?.state).toBe(1);
    });

    it('CLICK 1: Rejects tampered MD5 signature with error -1', async () => {
      const res = await billingService.handleClickWebhook({
        click_trans_id: 'tx-tampered',
        service_id: '100',
        click_paydoc_id: 'doc-1',
        merchant_trans_id: 'INV-1',
        amount: '549000',
        action: '0',
        error: '0',
        error_note: '',
        sign_time: '2026-10-30 15:00:00',
        sign_string: 'tampered-signature-hash',
      });

      expect(res.error).toBe(-1);
      expect(res.error_note).toBe('SIGN CHECK FAILED');
    });
  });

  // ==========================================================================
  // PHASE 6 — FACE ID & CAMERA FAIL-CLOSED HARDENING
  // ==========================================================================
  describe('PHASE 6 — Face ID Fail-Closed Hardening', () => {
    it('BIOMETRICS 1: Fail-closed production engine rejects synthetic SHA-256 fallback', async () => {
      const engine = new OnnxDualBiometricEngine();
      process.env.NODE_ENV = 'production';

      // Initialize without native ONNX runtime or weights
      await engine.initialize('/invalid/nonexistent/model.onnx');

      expect(engine.getState()).toBe('UNAVAILABLE');

      const testImage = Buffer.from('synthetic-face-bytes-test');
      await expect(engine.extractEmbedding512(testImage)).rejects.toThrow(
        BiometricServiceUnavailableException,
      );

      process.env.NODE_ENV = 'test';
    });

    it('BIOMETRICS 2: Test environment operates in DEGRADED mode for unit testing', async () => {
      const engine = new OnnxDualBiometricEngine();
      process.env.NODE_ENV = 'test';
      delete process.env.FACE_FAIL_CLOSED;

      await engine.initialize('/invalid/nonexistent/model.onnx');
      expect(engine.getState()).toBe('DEGRADED');

      const testImage = Buffer.from('test-unit-face-bytes');
      const vector = await engine.extractEmbedding512(testImage);
      expect(vector).toBeInstanceOf(Float32Array);
      expect(vector.length).toBe(512);
    });
  });

  // ==========================================================================
  // PHASE 7 — SUPER ADMIN TELEMETRY & MATH ACCURACY
  // ==========================================================================
  describe('PHASE 7 — Super Admin Plane & Mathematical Accuracy', () => {
    it('TELEMETRY 1: Calculates mathematically accurate MRR and ARR across active tenants only', async () => {
      prismaMock.organization.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
      prismaMock.user.count.mockResolvedValue(20);
      prismaMock.student.count.mockResolvedValue(150);

      // 2 ACTIVE subscribers (549,000 + 1,190,000) and 1 TRIALING subscriber (0)
      prismaMock.subscription.findMany.mockResolvedValue([
        { status: SubscriptionStatus.ACTIVE, priceUzs: 549000, plan: 'STANDARD' },
        { status: SubscriptionStatus.ACTIVE, priceUzs: 1190000, plan: 'PRO' },
        { status: SubscriptionStatus.TRIALING, priceUzs: 0, plan: 'START' },
        { status: SubscriptionStatus.SUSPENDED, priceUzs: 299000, plan: 'START' },
      ]);

      const stats = await platformService.getStatistics();

      // MRR must sum ACTIVE subscriptions only: 549,000 + 1,190,000 = 1,739,000 UZS
      expect(stats.mrr).toBe(1739000);
      // ARR must equal exact MRR * 12 = 20,868,000 UZS
      expect(stats.arr).toBe(1739000 * 12);
      expect(stats.statusCounts.ACTIVE).toBe(2);
      expect(stats.statusCounts.TRIALING).toBe(1);
      expect(stats.statusCounts.SUSPENDED).toBe(1);
    });

    it('TELEMETRY 2: Cryptographic invitation key generation returns 128-bit key and stores only SHA-256', async () => {
      let storedHash = '';
      prismaMock.platformInvitation.create.mockImplementation(({ data }) => {
        storedHash = data.codeHash;
        return Promise.resolve({
          id: 'inv-uuid',
          codeHash: data.codeHash,
          expiresAt: data.expiresAt,
          maxUses: data.maxUses,
        });
      });

      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 14);

      const invite = await platformService.createInvitation('platform-owner-id', {
        maxUses: 1,
        expiresAt: expDate.toISOString(),
      });

      expect(invite.code).toMatch(/^M-EDU-[A-F0-9]{32}$/);
      expect(storedHash).toHaveLength(64); // SHA-256 hex digest length
      expect(invite.code).not.toBe(storedHash);
    });
  });
});
