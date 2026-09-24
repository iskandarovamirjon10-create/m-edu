import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendancePolicy } from '../application/attendance.policy';
import type { StudentDirectoryPort } from '../ports/student-directory.port';
import type { RecognitionRepository } from '../ports/recognition-repository.port';
import type { TenantContext } from '../ports/tenant-context.port';

// Mock implementations
const mockStudentDir: StudentDirectoryPort = {
  getStudent: vi.fn(),
  isStudentInGroup: vi.fn(),
  getStudentGroups: vi.fn(),
  isStudentActive: vi.fn(),
  listStudentsInGroup: vi.fn(),
};

const mockRecogRepo: RecognitionRepository = {
  createSession: vi.fn(),
  findSession: vi.fn(),
  updateSessionStatus: vi.fn(),
  countActiveSessions: vi.fn(),
  createAttempt: vi.fn(),
  listAttempts: vi.fn(),
  getSessionAttempts: vi.fn(),
  createAttendance: vi.fn(),
  findExistingAttendance: vi.fn(),
  listAttendance: vi.fn(),
  getRecognitionStats: vi.fn(),
  getAttendanceStats: vi.fn(),
};

const tenant: TenantContext = {
  userId: 'user-1',
  email: 'admin@test.com',
  role: 'ORG_ADMIN',
  organizationId: 'org-1',
};

describe('AttendancePolicy', () => {
  let policy: AttendancePolicy;

  beforeEach(() => {
    vi.clearAllMocks();
    policy = new AttendancePolicy(mockStudentDir, mockRecogRepo, 5);
  });

  it('rejects inactive students', async () => {
    vi.mocked(mockStudentDir.isStudentActive).mockResolvedValue(false);

    const result = await policy.validate(tenant, 'student-1', 'group-1', 'lesson-1', 'session-1');
    expect(result.decision).toBe('STUDENT_INACTIVE');
  });

  it('rejects students not in the group', async () => {
    vi.mocked(mockStudentDir.isStudentActive).mockResolvedValue(true);
    vi.mocked(mockStudentDir.isStudentInGroup).mockResolvedValue(false);

    const result = await policy.validate(tenant, 'student-1', 'group-1', 'lesson-1', 'session-1');
    expect(result.decision).toBe('STUDENT_NOT_IN_GROUP');
  });

  it('prevents duplicate attendance within window', async () => {
    vi.mocked(mockStudentDir.isStudentActive).mockResolvedValue(true);
    vi.mocked(mockStudentDir.isStudentInGroup).mockResolvedValue(true);
    vi.mocked(mockRecogRepo.findExistingAttendance).mockResolvedValue({
      id: 'existing-1',
      organizationId: 'org-1',
      studentId: 'student-1',
      groupId: 'group-1',
      lessonId: 'lesson-1',
      sessionId: 'session-0',
      decision: 'RECORDED',
      recordedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      metadata: null,
      createdAt: new Date(),
    });

    const result = await policy.validate(tenant, 'student-1', 'group-1', 'lesson-1', 'session-1');
    expect(result.decision).toBe('DUPLICATE_PREVENTED');
  });

  it('allows attendance when all checks pass', async () => {
    vi.mocked(mockStudentDir.isStudentActive).mockResolvedValue(true);
    vi.mocked(mockStudentDir.isStudentInGroup).mockResolvedValue(true);
    vi.mocked(mockRecogRepo.findExistingAttendance).mockResolvedValue(null);

    const result = await policy.validate(tenant, 'student-1', 'group-1', 'lesson-1', 'session-1');
    expect(result.decision).toBe('RECORDED');
  });

  it('prevents duplicate attendance for the day even when the earlier record is outside the window', async () => {
    // Attendance is day-scoped (DB unique (studentId, groupId, date) with a
    // day-normalized date). An older same-day record must NOT allow a second
    // row for the same day — that was the previous bug (duplicate same-day
    // attendance after the 5-minute window).
    vi.mocked(mockStudentDir.isStudentActive).mockResolvedValue(true);
    vi.mocked(mockStudentDir.isStudentInGroup).mockResolvedValue(true);
    vi.mocked(mockRecogRepo.findExistingAttendance).mockResolvedValue({
      id: 'old-1',
      organizationId: 'org-1',
      studentId: 'student-1',
      groupId: 'group-1',
      lessonId: 'lesson-1',
      sessionId: 'session-old',
      decision: 'RECORDED',
      recordedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      metadata: null,
      createdAt: new Date(),
    });

    const result = await policy.validate(tenant, 'student-1', 'group-1', 'lesson-1', 'session-1');
    expect(result.decision).toBe('DUPLICATE_PREVENTED');
    expect(result.existingAttendanceId).toBe('old-1');
  });
});
