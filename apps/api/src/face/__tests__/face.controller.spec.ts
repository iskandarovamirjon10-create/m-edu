import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Permissions } from '@medu/contracts';

import { FaceController } from '../face.controller';
import { FaceService } from '../face.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { FacePermissionsGuard } from '../auth/face-permissions.guard';
import { FACE_PERMISSIONS_KEY } from '../auth/face-permissions.decorator';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import type { TenantContext, RequestUser } from '../../auth/types';
import type {
  CreateEnrollmentDto,
  EnrollmentQueryDto,
  ReenrollEnrollmentDto,
  RevokeEnrollmentDto,
} from '../dto/enrollment.dto';
import type {
  CreateSessionDto,
  FinishSessionDto,
  RecognitionHistoryQueryDto,
  SubmitAttemptDto,
} from '../dto/recognition.dto';
import type {
  DeviceQueryDto,
  RegisterDeviceDto,
} from '../dto/device.dto';
import type { FaceAuditQueryDto } from '../dto/audit.dto';

interface MockFaceRequest {
  user: RequestUser;
  tenantContext: TenantContext;
}

describe('FaceController', () => {
  let controller: FaceController;
  let service: {
    startEnrollment: ReturnType<typeof vi.fn>;
    listEnrollments: ReturnType<typeof vi.fn>;
    getEnrollment: ReturnType<typeof vi.fn>;
    processEnrollmentCapture: ReturnType<typeof vi.fn>;
    reenrollStudent: ReturnType<typeof vi.fn>;
    revokeEnrollment: ReturnType<typeof vi.fn>;
    startSession: ReturnType<typeof vi.fn>;
    processAttempt: ReturnType<typeof vi.fn>;
    finishSession: ReturnType<typeof vi.fn>;
    getSessionAttempts: ReturnType<typeof vi.fn>;
    getRecognitionHistory: ReturnType<typeof vi.fn>;
    registerDevice: ReturnType<typeof vi.fn>;
    listDevices: ReturnType<typeof vi.fn>;
    getDevice: ReturnType<typeof vi.fn>;
    revokeDevice: ReturnType<typeof vi.fn>;
    getAuditLog: ReturnType<typeof vi.fn>;
    getAnalytics: ReturnType<typeof vi.fn>;
    getEngineStatus: ReturnType<typeof vi.fn>;
  };

  const mockTenantContext: TenantContext = {
    userId: 'user-uuid-1',
    email: 'admin@school.uz',
    role: 'ORG_ADMIN',
    organizationId: 'org-uuid-1',
  };

  const mockRequestUser: RequestUser = {
    sub: 'user-uuid-1',
    email: 'admin@school.uz',
    role: 'ORG_ADMIN',
    organizationId: 'org-uuid-1',
    sid: 'session-uuid-1',
  };

  function createMockRequest(
    overrides?: Partial<TenantContext>,
  ): MockFaceRequest {
    return {
      user: mockRequestUser,
      tenantContext: {
        ...mockTenantContext,
        ...overrides,
      },
    };
  }

  beforeEach(async () => {
    service = {
      startEnrollment: vi.fn(),
      listEnrollments: vi.fn(),
      getEnrollment: vi.fn(),
      processEnrollmentCapture: vi.fn(),
      reenrollStudent: vi.fn(),
      revokeEnrollment: vi.fn(),
      startSession: vi.fn(),
      processAttempt: vi.fn(),
      finishSession: vi.fn(),
      getSessionAttempts: vi.fn(),
      getRecognitionHistory: vi.fn(),
      registerDevice: vi.fn(),
      listDevices: vi.fn(),
      getDevice: vi.fn(),
      revokeDevice: vi.fn(),
      getAuditLog: vi.fn(),
      getAnalytics: vi.fn(),
      getEngineStatus: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaceController],
      providers: [
        {
          provide: FaceService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<FaceController>(FaceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // ENROLLMENTS
  // ---------------------------------------------------------------------------

  describe('startEnrollment', () => {
    const dto: CreateEnrollmentDto = { studentId: 'student-uuid-1' };

    it('delegates to faceService.startEnrollment with tenant context and studentId', async () => {
      const mockReq = createMockRequest();
      const expected = { id: 'enrollment-1', studentId: 'student-uuid-1', status: 'PENDING' };
      service.startEnrollment.mockResolvedValue(expected);

      const result = await controller.startEnrollment(mockReq as any, dto);

      expect(result).toEqual(expected);
      expect(service.startEnrollment).toHaveBeenCalledTimes(1);
      expect(service.startEnrollment).toHaveBeenCalledWith(mockReq.tenantContext, dto.studentId);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.startEnrollment.mockRejectedValue(new Error('Enrollment already active'));

      await expect(controller.startEnrollment(mockReq as any, dto)).rejects.toThrow(
        'Enrollment already active',
      );
    });
  });

  describe('listEnrollments', () => {
    const query: EnrollmentQueryDto = { page: 1, limit: 10, status: 'ACTIVE' as any };

    it('delegates to faceService.listEnrollments with tenant context and query', async () => {
      const mockReq = createMockRequest();
      const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      service.listEnrollments.mockResolvedValue(expected);

      const result = await controller.listEnrollments(mockReq as any, query);

      expect(result).toEqual(expected);
      expect(service.listEnrollments).toHaveBeenCalledTimes(1);
      expect(service.listEnrollments).toHaveBeenCalledWith(mockReq.tenantContext, query);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.listEnrollments.mockRejectedValue(new Error('Failed to query enrollments'));

      await expect(controller.listEnrollments(mockReq as any, query)).rejects.toThrow(
        'Failed to query enrollments',
      );
    });
  });

  describe('getEnrollment', () => {
    const enrollmentId = 'enrollment-uuid-1';

    it('delegates to faceService.getEnrollment with tenant context and id', async () => {
      const mockReq = createMockRequest();
      const expected = { id: enrollmentId, status: 'ACTIVE' };
      service.getEnrollment.mockResolvedValue(expected);

      const result = await controller.getEnrollment(mockReq as any, enrollmentId);

      expect(result).toEqual(expected);
      expect(service.getEnrollment).toHaveBeenCalledTimes(1);
      expect(service.getEnrollment).toHaveBeenCalledWith(mockReq.tenantContext, enrollmentId);
    });

    it('propagates service errors (e.g. not found)', async () => {
      const mockReq = createMockRequest();
      service.getEnrollment.mockRejectedValue(new Error('Enrollment not found'));

      await expect(controller.getEnrollment(mockReq as any, enrollmentId)).rejects.toThrow(
        'Enrollment not found',
      );
    });
  });

  describe('processCapture', () => {
    const enrollmentId = 'enrollment-uuid-1';
    const dto: SubmitAttemptDto = { imageBase64: 'data:image/jpeg;base64,dGVzdA==' };

    it('delegates to faceService.processEnrollmentCapture with tenant context, id and imageBase64', async () => {
      const mockReq = createMockRequest();
      const expected = { success: true, status: 'COMPLETED' };
      service.processEnrollmentCapture.mockResolvedValue(expected);

      const result = await controller.processCapture(mockReq as any, enrollmentId, dto);

      expect(result).toEqual(expected);
      expect(service.processEnrollmentCapture).toHaveBeenCalledTimes(1);
      expect(service.processEnrollmentCapture).toHaveBeenCalledWith(
        mockReq.tenantContext,
        enrollmentId,
        dto.imageBase64,
      );
    });

    it('propagates service errors (e.g. liveness check failed)', async () => {
      const mockReq = createMockRequest();
      service.processEnrollmentCapture.mockRejectedValue(new Error('Liveness check failed'));

      await expect(controller.processCapture(mockReq as any, enrollmentId, dto)).rejects.toThrow(
        'Liveness check failed',
      );
    });
  });

  describe('reenroll', () => {
    const enrollmentId = 'enrollment-uuid-1';
    const dto: ReenrollEnrollmentDto = { reason: 'Appearance changed significantly' };

    it('delegates to faceService.reenrollStudent with tenant context, id and reason', async () => {
      const mockReq = createMockRequest();
      const expected = { id: 'new-enrollment-uuid', status: 'PENDING' };
      service.reenrollStudent.mockResolvedValue(expected);

      const result = await controller.reenroll(mockReq as any, enrollmentId, dto);

      expect(result).toEqual(expected);
      expect(service.reenrollStudent).toHaveBeenCalledTimes(1);
      expect(service.reenrollStudent).toHaveBeenCalledWith(
        mockReq.tenantContext,
        enrollmentId,
        dto.reason,
      );
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.reenrollStudent.mockRejectedValue(new Error('Cannot re-enroll inactive enrollment'));

      await expect(controller.reenroll(mockReq as any, enrollmentId, dto)).rejects.toThrow(
        'Cannot re-enroll inactive enrollment',
      );
    });
  });

  describe('revokeEnrollment', () => {
    const enrollmentId = 'enrollment-uuid-1';
    const dto: RevokeEnrollmentDto = { reason: 'Student consent withdrawn' };

    it('delegates to faceService.revokeEnrollment with tenant context, id and reason', async () => {
      const mockReq = createMockRequest();
      const expected = { id: enrollmentId, status: 'REVOKED' };
      service.revokeEnrollment.mockResolvedValue(expected);

      const result = await controller.revokeEnrollment(mockReq as any, enrollmentId, dto);

      expect(result).toEqual(expected);
      expect(service.revokeEnrollment).toHaveBeenCalledTimes(1);
      expect(service.revokeEnrollment).toHaveBeenCalledWith(
        mockReq.tenantContext,
        enrollmentId,
        dto.reason,
      );
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.revokeEnrollment.mockRejectedValue(new Error('Enrollment already revoked'));

      await expect(controller.revokeEnrollment(mockReq as any, enrollmentId, dto)).rejects.toThrow(
        'Enrollment already revoked',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // RECOGNITION SESSIONS
  // ---------------------------------------------------------------------------

  describe('startSession', () => {
    const dto: CreateSessionDto = {
      deviceId: 'device-uuid-1',
      location: 'Main Entrance',
    };

    it('delegates to faceService.startSession with tenant context and dto', async () => {
      const mockReq = createMockRequest();
      const expected = { id: 'session-uuid-10', status: 'ACTIVE' };
      service.startSession.mockResolvedValue(expected);

      const result = await controller.startSession(mockReq as any, dto);

      expect(result).toEqual(expected);
      expect(service.startSession).toHaveBeenCalledTimes(1);
      expect(service.startSession).toHaveBeenCalledWith(mockReq.tenantContext, dto);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.startSession.mockRejectedValue(new Error('Device not found or inactive'));

      await expect(controller.startSession(mockReq as any, dto)).rejects.toThrow(
        'Device not found or inactive',
      );
    });
  });

  describe('submitAttempt', () => {
    const sessionId = 'session-uuid-1';
    const dto: SubmitAttemptDto = { imageBase64: 'data:image/jpeg;base64,dGVzdA==' };

    it('delegates to faceService.processAttempt with tenant context, id and imageBase64', async () => {
      const mockReq = createMockRequest();
      const expected = { matched: true, studentId: 'student-1', confidence: 0.98 };
      service.processAttempt.mockResolvedValue(expected);

      const result = await controller.submitAttempt(mockReq as any, sessionId, dto);

      expect(result).toEqual(expected);
      expect(service.processAttempt).toHaveBeenCalledTimes(1);
      expect(service.processAttempt).toHaveBeenCalledWith(
        mockReq.tenantContext,
        sessionId,
        dto.imageBase64,
      );
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.processAttempt.mockRejectedValue(new Error('Session is closed'));

      await expect(controller.submitAttempt(mockReq as any, sessionId, dto)).rejects.toThrow(
        'Session is closed',
      );
    });
  });

  describe('finishSession', () => {
    const sessionId = 'session-uuid-1';
    const dto: FinishSessionDto = { reason: 'Class period ended' };

    it('delegates to faceService.finishSession with tenant context, id and reason', async () => {
      const mockReq = createMockRequest();
      const expected = { id: sessionId, status: 'FINISHED' };
      service.finishSession.mockResolvedValue(expected);

      const result = await controller.finishSession(mockReq as any, sessionId, dto);

      expect(result).toEqual(expected);
      expect(service.finishSession).toHaveBeenCalledTimes(1);
      expect(service.finishSession).toHaveBeenCalledWith(
        mockReq.tenantContext,
        sessionId,
        dto.reason,
      );
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.finishSession.mockRejectedValue(new Error('Session not found'));

      await expect(controller.finishSession(mockReq as any, sessionId, dto)).rejects.toThrow(
        'Session not found',
      );
    });
  });

  describe('getSessionAttempts', () => {
    const sessionId = 'session-uuid-1';

    it('delegates to faceService.getSessionAttempts with tenant context and id', async () => {
      const mockReq = createMockRequest();
      const expected = [{ id: 'attempt-1', matched: true }];
      service.getSessionAttempts.mockResolvedValue(expected);

      const result = await controller.getSessionAttempts(mockReq as any, sessionId);

      expect(result).toEqual(expected);
      expect(service.getSessionAttempts).toHaveBeenCalledTimes(1);
      expect(service.getSessionAttempts).toHaveBeenCalledWith(mockReq.tenantContext, sessionId);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.getSessionAttempts.mockRejectedValue(new Error('Session attempts query failed'));

      await expect(controller.getSessionAttempts(mockReq as any, sessionId)).rejects.toThrow(
        'Session attempts query failed',
      );
    });
  });

  describe('getRecognitionHistory', () => {
    const query: RecognitionHistoryQueryDto = { page: 1, limit: 20 };

    it('delegates to faceService.getRecognitionHistory with tenant context and query', async () => {
      const mockReq = createMockRequest();
      const expected = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      service.getRecognitionHistory.mockResolvedValue(expected);

      const result = await controller.getRecognitionHistory(mockReq as any, query);

      expect(result).toEqual(expected);
      expect(service.getRecognitionHistory).toHaveBeenCalledTimes(1);
      expect(service.getRecognitionHistory).toHaveBeenCalledWith(mockReq.tenantContext, query);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.getRecognitionHistory.mockRejectedValue(new Error('History query failed'));

      await expect(controller.getRecognitionHistory(mockReq as any, query)).rejects.toThrow(
        'History query failed',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // DEVICES
  // ---------------------------------------------------------------------------

  describe('registerDevice', () => {
    const dto: RegisterDeviceDto = {
      name: 'Gate 1 Camera',
      deviceType: 'RASPBERRY_PI' as any,
      location: 'North Gate',
    };

    it('delegates to faceService.registerDevice with tenant context and dto', async () => {
      const mockReq = createMockRequest();
      const expected = { id: 'dev-1', ...dto, apiKey: 'secret-key' };
      service.registerDevice.mockResolvedValue(expected);

      const result = await controller.registerDevice(mockReq as any, dto);

      expect(result).toEqual(expected);
      expect(service.registerDevice).toHaveBeenCalledTimes(1);
      expect(service.registerDevice).toHaveBeenCalledWith(mockReq.tenantContext, dto);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.registerDevice.mockRejectedValue(new Error('Device name already taken'));

      await expect(controller.registerDevice(mockReq as any, dto)).rejects.toThrow(
        'Device name already taken',
      );
    });
  });

  describe('listDevices', () => {
    const query: DeviceQueryDto = { page: 1, limit: 10 };

    it('delegates to faceService.listDevices with tenant context and query', async () => {
      const mockReq = createMockRequest();
      const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      service.listDevices.mockResolvedValue(expected);

      const result = await controller.listDevices(mockReq as any, query);

      expect(result).toEqual(expected);
      expect(service.listDevices).toHaveBeenCalledTimes(1);
      expect(service.listDevices).toHaveBeenCalledWith(mockReq.tenantContext, query);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.listDevices.mockRejectedValue(new Error('List devices failed'));

      await expect(controller.listDevices(mockReq as any, query)).rejects.toThrow(
        'List devices failed',
      );
    });
  });

  describe('getDevice', () => {
    const deviceId = 'device-uuid-1';

    it('delegates to faceService.getDevice with tenant context and id', async () => {
      const mockReq = createMockRequest();
      const expected = { id: deviceId, name: 'Gate 1 Camera' };
      service.getDevice.mockResolvedValue(expected);

      const result = await controller.getDevice(mockReq as any, deviceId);

      expect(result).toEqual(expected);
      expect(service.getDevice).toHaveBeenCalledTimes(1);
      expect(service.getDevice).toHaveBeenCalledWith(mockReq.tenantContext, deviceId);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.getDevice.mockRejectedValue(new Error('Device not found'));

      await expect(controller.getDevice(mockReq as any, deviceId)).rejects.toThrow(
        'Device not found',
      );
    });
  });

  describe('revokeDevice', () => {
    const deviceId = 'device-uuid-1';

    it('delegates to faceService.revokeDevice with tenant context and id', async () => {
      const mockReq = createMockRequest();
      const expected = { id: deviceId, revoked: true };
      service.revokeDevice.mockResolvedValue(expected);

      const result = await controller.revokeDevice(mockReq as any, deviceId);

      expect(result).toEqual(expected);
      expect(service.revokeDevice).toHaveBeenCalledTimes(1);
      expect(service.revokeDevice).toHaveBeenCalledWith(mockReq.tenantContext, deviceId);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.revokeDevice.mockRejectedValue(new Error('Device already revoked'));

      await expect(controller.revokeDevice(mockReq as any, deviceId)).rejects.toThrow(
        'Device already revoked',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // AUDIT / ANALYTICS
  // ---------------------------------------------------------------------------

  describe('getAuditLog', () => {
    const query: FaceAuditQueryDto = { page: 1, limit: 50 };

    it('delegates to faceService.getAuditLog with tenant context and query', async () => {
      const mockReq = createMockRequest();
      const expected = { items: [], total: 0, page: 1, limit: 50, totalPages: 0 };
      service.getAuditLog.mockResolvedValue(expected);

      const result = await controller.getAuditLog(mockReq as any, query);

      expect(result).toEqual(expected);
      expect(service.getAuditLog).toHaveBeenCalledTimes(1);
      expect(service.getAuditLog).toHaveBeenCalledWith(mockReq.tenantContext, query);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.getAuditLog.mockRejectedValue(new Error('Audit query failed'));

      await expect(controller.getAuditLog(mockReq as any, query)).rejects.toThrow(
        'Audit query failed',
      );
    });
  });

  describe('getAnalytics', () => {
    it('delegates to faceService.getAnalytics with tenant context', async () => {
      const mockReq = createMockRequest();
      const expected = {
        overview: {
          totalEnrolled: 10,
          activeEnrollments: 8,
          totalSessions: 5,
          totalAttempts: 25,
          recognitionSuccessRate: 92,
        },
      };
      service.getAnalytics.mockResolvedValue(expected);

      const result = await controller.getAnalytics(mockReq as any);

      expect(result).toEqual(expected);
      expect(service.getAnalytics).toHaveBeenCalledTimes(1);
      expect(service.getAnalytics).toHaveBeenCalledWith(mockReq.tenantContext);
    });

    it('propagates service errors', async () => {
      const mockReq = createMockRequest();
      service.getAnalytics.mockRejectedValue(new Error('Analytics computation failed'));

      await expect(controller.getAnalytics(mockReq as any)).rejects.toThrow(
        'Analytics computation failed',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // ENGINE STATUS
  // ---------------------------------------------------------------------------

  describe('getEngineStatus', () => {
    it('delegates to faceService.getEngineStatus without tenantContext', () => {
      const expected = { provider: 'mock', isReal: false };
      service.getEngineStatus.mockReturnValue(expected);

      const result = controller.getEngineStatus();

      expect(result).toEqual(expected);
      expect(service.getEngineStatus).toHaveBeenCalledTimes(1);
      expect(service.getEngineStatus).toHaveBeenCalledWith();
    });

    it('propagates service errors', () => {
      service.getEngineStatus.mockImplementation(() => {
        throw new Error('Engine status unavailable');
      });

      expect(() => controller.getEngineStatus()).toThrow('Engine status unavailable');
    });
  });

  // ---------------------------------------------------------------------------
  // GUARDS, INTERCEPTORS & DECORATORS VERIFICATION
  // ---------------------------------------------------------------------------

  describe('Guard, Interceptor and Permission verification (structural)', () => {
    it('has JwtAuthGuard and FacePermissionsGuard applied at the controller class level', () => {
      const guards = Reflect.getMetadata('__guards__', FaceController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(FacePermissionsGuard);
    });

    it('has TenantInterceptor applied at the controller class level', () => {
      const interceptors = Reflect.getMetadata('__interceptors__', FaceController);
      expect(interceptors).toBeDefined();
      expect(interceptors).toContain(TenantInterceptor);
    });

    it('has correct route-level FacePermissions on enrollment endpoints', () => {
      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.startEnrollment),
      ).toEqual([Permissions.FACE_ENROLL]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.listEnrollments),
      ).toEqual([Permissions.FACE_VIEW]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.getEnrollment),
      ).toEqual([Permissions.FACE_VIEW]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.processCapture),
      ).toEqual([Permissions.FACE_ENROLL]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.reenroll),
      ).toEqual([Permissions.FACE_REENROLL]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.revokeEnrollment),
      ).toEqual([Permissions.FACE_REVOKE]);
    });

    it('has correct route-level FacePermissions on session endpoints', () => {
      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.startSession),
      ).toEqual([Permissions.FACE_RECOGNIZE]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.submitAttempt),
      ).toEqual([Permissions.FACE_RECOGNIZE]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.finishSession),
      ).toEqual([Permissions.FACE_RECOGNIZE]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.getSessionAttempts),
      ).toEqual([Permissions.FACE_VIEW]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.getRecognitionHistory),
      ).toEqual([Permissions.FACE_VIEW]);
    });

    it('has correct route-level FacePermissions on device endpoints', () => {
      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.registerDevice),
      ).toEqual([Permissions.FACE_DEVICE_MANAGE]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.listDevices),
      ).toEqual([Permissions.FACE_DEVICE_MANAGE]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.getDevice),
      ).toEqual([Permissions.FACE_DEVICE_MANAGE]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.revokeDevice),
      ).toEqual([Permissions.FACE_DEVICE_MANAGE]);
    });

    it('has correct route-level FacePermissions on audit, analytics, and engine-status endpoints', () => {
      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.getAuditLog),
      ).toEqual([Permissions.FACE_AUDIT_VIEW]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.getAnalytics),
      ).toEqual([Permissions.FACE_ANALYTICS_VIEW]);

      expect(
        Reflect.getMetadata(FACE_PERMISSIONS_KEY, FaceController.prototype.getEngineStatus),
      ).toEqual([Permissions.FACE_VIEW]);
    });

    it('has HttpCode 200 on capture and attempt submission endpoints', () => {
      const captureHttpCode = Reflect.getMetadata(
        '__httpCode__',
        FaceController.prototype.processCapture,
      );
      expect(captureHttpCode).toBe(200);

      const attemptHttpCode = Reflect.getMetadata(
        '__httpCode__',
        FaceController.prototype.submitAttempt,
      );
      expect(attemptHttpCode).toBe(200);
    });
  });
});
