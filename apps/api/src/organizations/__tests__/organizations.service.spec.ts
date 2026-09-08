import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationsService } from '../organizations.service';

function createMockPrisma() {
  return {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('OrganizationsService', () => {
  let prisma: any;
  let svc: OrganizationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new OrganizationsService(prisma);
  });

  describe('getOrganization', () => {
    it('throws NotFoundException for an unknown organization', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(svc.getOrganization('org-missing')).rejects.toThrow('Organization not found');
    });

    it('returns the organization with aggregate counts', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: 'org-1',
        name: 'Edu',
        _count: { users: 3, students: 10 },
      });
      const result = await svc.getOrganization('org-1');
      expect(result._count).toEqual({ users: 3, students: 10 });
      expect(prisma.organization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          include: { _count: expect.objectContaining({ select: expect.any(Object) }) },
        }),
      );
    });
  });

  describe('updateOrganization', () => {
    it('throws NotFoundException when the organization does not exist', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(svc.updateOrganization('org-missing', { name: 'X' })).rejects.toThrow(
        'Organization not found',
      );
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('updates only name, email and phone', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', name: 'Edu' });
      prisma.organization.update.mockResolvedValue({ id: 'org-1', name: 'New Edu' });
      await svc.updateOrganization('org-1', { name: 'New Edu', email: 'a@b.co', phone: '+998' });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { name: 'New Edu', email: 'a@b.co', phone: '+998' },
      });
    });
  });
});
