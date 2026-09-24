/**
 * Regression tests for the "create → select" group flow.
 *
 * The create-group form always submits the `isActive` status toggle. It is a
 * non-whitelisted property unless CreateGroupDto declares it, and the global
 * ValidationPipe runs with `forbidNonWhitelisted: true` — so a missing
 * declaration rejected the whole request with 400 and the group was never
 * created (BUG-001/BUG-005 class).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGroupDto } from '../../common/dto';
import { GroupsService } from '../groups.service';

const COURSE_ID = '11111111-1111-4111-8111-111111111111';

async function validateCreateGroup(payload: Record<string, unknown>) {
  return validate(plainToInstance(CreateGroupDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('CreateGroupDto (ValidationPipe whitelist parity)', () => {
  it('accepts the payload the group form actually submits, including isActive', async () => {
    const errors = await validateCreateGroup({
      name: 'Morning Class A',
      courseId: COURSE_ID,
      capacity: 20,
      room: '101',
      isActive: true,
    });
    if (errors.length > 0) console.log(JSON.stringify(errors, null, 2));
    expect(errors).toHaveLength(0);
  });

  it('still rejects unknown properties (forbidNonWhitelisted)', async () => {
    const errors = await validateCreateGroup({
      name: 'Morning Class A',
      courseId: COURSE_ID,
      totallyUnknownField: 'nope',
    });
    expect(errors.some((e) => e.property === 'totallyUnknownField')).toBe(true);
  });

  it('rejects a non-UUID courseId', async () => {
    const errors = await validateCreateGroup({ name: 'X', courseId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'courseId')).toBe(true);
  });
});

describe('GroupsService.create — isActive propagation', () => {
  function buildService() {
    const prisma = {
      course: { findFirst: vi.fn().mockResolvedValue({ id: COURSE_ID }) },
      teacher: { findFirst: vi.fn().mockResolvedValue({ id: 't-1' }) },
      group: {
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'g-1',
          ...data,
        })),
      },
    };
    return {
      prisma,
      service: new GroupsService(prisma as unknown as ConstructorParameters<typeof GroupsService>[0]),
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it('persists an explicitly requested inactive status', async () => {
    const { prisma, service } = buildService();
    await service.create('org-1', { name: 'G', courseId: COURSE_ID, isActive: false });
    expect(prisma.group.create.mock.calls[0][0].data.isActive).toBe(false);
  });

  it('defaults to active when the flag is omitted', async () => {
    const { prisma, service } = buildService();
    await service.create('org-1', { name: 'G', courseId: COURSE_ID });
    expect(prisma.group.create.mock.calls[0][0].data.isActive).toBe(true);
  });

  it('rejects a course outside the tenant', async () => {
    const { prisma, service } = buildService();
    prisma.course.findFirst.mockResolvedValue(null);
    await expect(
      service.create('org-1', { name: 'G', courseId: COURSE_ID }),
    ).rejects.toThrow('Course not found');
  });
});
