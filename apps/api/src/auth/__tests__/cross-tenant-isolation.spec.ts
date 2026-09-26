import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { StudentsService } from '../../students/students.service';
import { DocumentsService } from '../../documents/documents.service';
import { HremployeeService } from '../../hr/hr.service';
import { InventoryService } from '../../inventory/inventory.service';
import { LibraryService } from '../../library/library.service';
import { PrismaService } from '../../prisma/prisma.service';
import { scopeToTenant, assertTenantOwnership } from '../../common/tenant/tenant-scoping';

describe('Cross-Tenant Isolation & Anti-IDOR Adversarial Suite (Phase 5, 6, 7 Hardening)', () => {
  const TENANT_A = 'org-tenant-a';
  const TENANT_B = 'org-tenant-b';

  describe('scopeToTenant helper', () => {
    it('should inject organizationId into where criteria', () => {
      const scoped = scopeToTenant({ id: 'item-1', status: 'ACTIVE' }, TENANT_A);
      expect(scoped).toEqual({ id: 'item-1', status: 'ACTIVE', organizationId: TENANT_A });
    });

    it('should reject missing or empty organizationId', () => {
      expect(() => scopeToTenant({ id: 'item-1' }, '')).toThrow(/Tenant scoping violation/);
      expect(() => scopeToTenant({ id: 'item-1' }, null as any)).toThrow(/Tenant scoping violation/);
    });

    it('assertTenantOwnership should reject records belonging to another tenant', () => {
      expect(() => assertTenantOwnership({ organizationId: TENANT_B }, TENANT_A, 'Student')).toThrow(
        /Tenant isolation violation/,
      );
      expect(() => assertTenantOwnership({ organizationId: TENANT_A }, TENANT_A, 'Student')).not.toThrow();
    });
  });

  describe('StudentsService Tenant Boundary Enforcement', () => {
    let service: StudentsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        student: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            // Emulate database: returns record ONLY if organizationId matches
            if (where.id === 'student-b-1' && where.organizationId === TENANT_B) {
              return Promise.resolve({ id: 'student-b-1', organizationId: TENANT_B });
            }
            return Promise.resolve(null);
          }),
          update: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
        },
      };
      service = new StudentsService(mockPrisma as PrismaService);
    });

    it('Tenant A cannot read Tenant B student (must throw NotFoundException)', async () => {
      await expect(service.findOne(TENANT_A, 'student-b-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'student-b-1', organizationId: TENANT_A }),
        }),
      );
    });

    it('Tenant A cannot update Tenant B student (must throw NotFoundException without mutating)', async () => {
      await expect(
        service.update(TENANT_A, 'student-b-1', { notes: 'malicious overwrite' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.student.update).not.toHaveBeenCalled();
    });

    it('Tenant A cannot delete Tenant B student (must throw NotFoundException)', async () => {
      await expect(service.remove(TENANT_A, 'student-b-1')).rejects.toThrow(NotFoundException);
    });

    it('Tenant A cannot read Tenant B student parents (must throw NotFoundException)', async () => {
      await expect(service.getStudentParents(TENANT_A, 'student-b-1')).rejects.toThrow(NotFoundException);
    });

    it('Tenant A cannot link parent to Tenant B student (must throw NotFoundException)', async () => {
      await expect(
        service.createOrLinkParent(TENANT_A, 'student-b-1', {
          email: 'p@example.com',
          firstName: 'P',
          lastName: 'L',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant A cannot unlink parent from Tenant B student (must throw NotFoundException)', async () => {
      await expect(service.unlinkParent(TENANT_A, 'student-b-1', 'parent-1')).rejects.toThrow(NotFoundException);
    });
  });


  describe('DocumentsService Tenant Boundary Enforcement', () => {
    let service: DocumentsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        document: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'doc-b-1' && where.organizationId === TENANT_B) {
              return Promise.resolve({ id: 'doc-b-1', organizationId: TENANT_B });
            }
            return Promise.resolve(null);
          }),
          updateMany: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'doc-b-1' && where.organizationId === TENANT_A) {
              return Promise.resolve({ count: 1 });
            }
            return Promise.resolve({ count: 0 });
          }),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      service = new DocumentsService(mockPrisma as PrismaService);
    });

    it('Tenant A cannot read Tenant B document (must return null)', async () => {
      const doc = await service.findOne(
        { sub: 'user-a', organizationId: TENANT_A, role: 'STAFF', isStaff: true } as any,
        'doc-b-1',
      );
      expect(doc).toBeNull();
      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'doc-b-1', organizationId: TENANT_A }),
        }),
      );
    });

    it('Tenant A cannot update Tenant B document (must return null without mutating)', async () => {
      const updated = await service.update(TENANT_A, 'doc-b-1', { title: 'hacked' });
      expect(updated).toBeNull();
      expect(mockPrisma.document.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'doc-b-1', organizationId: TENANT_A }),
        }),
      );
    });

    it('Tenant A cannot delete Tenant B document (must return null without deleting)', async () => {
      const deleted = await service.delete(TENANT_A, 'doc-b-1');
      expect(deleted).toBeNull();
      expect(mockPrisma.document.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('HremployeeService Salary Records Tenant Boundary Enforcement', () => {
    let service: HremployeeService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        salaryRecord: {
          updateMany: vi.fn().mockImplementation(({ where }) => {
            // Record belongs to TENANT_B: only updates if organizationId === TENANT_B
            if (where.id === 'salary-b-1' && where.organizationId === TENANT_B) {
              return Promise.resolve({ count: 1 });
            }
            return Promise.resolve({ count: 0 }); // Tenant mismatch -> count: 0
          }),
          findFirst: vi.fn(),
        },
      };
      service = new HremployeeService(mockPrisma as PrismaService);
    });

    it('Tenant A cannot pay or process Tenant B salary record (must throw NotFoundException)', async () => {
      await expect(service.processSalaryPayment(TENANT_A, 'salary-b-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.salaryRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'salary-b-1', organizationId: TENANT_A, status: 'PENDING' }),
        }),
      );
      expect(mockPrisma.salaryRecord.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('InventoryService Tenant Boundary Enforcement', () => {
    let service: InventoryService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        inventoryItem: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'item-b-1' && where.organizationId === TENANT_B) {
              return Promise.resolve({ id: 'item-b-1', organizationId: TENANT_B, quantity: 50 });
            }
            return Promise.resolve(null);
          }),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
        $transaction: vi.fn().mockImplementation(cb => cb(mockPrisma)),
      };
      service = new InventoryService(mockPrisma as PrismaService);
    });

    it('Tenant A cannot update Tenant B stock (must throw NotFoundException)', async () => {
      await expect(service.updateStock(TENANT_A, 'item-b-1', 100)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.inventoryItem.update).not.toHaveBeenCalled();
    });

    it('Tenant A cannot adjust Tenant B stock (must throw NotFoundException)', async () => {
      await expect(service.adjustStock(TENANT_A, 'item-b-1', -5)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.inventoryItem.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('LibraryService Tenant Boundary Enforcement', () => {
    let service: LibraryService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        libraryBorrow: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'borrow-b-1' && where.organizationId === TENANT_B) {
              return Promise.resolve({
                id: 'borrow-b-1',
                organizationId: TENANT_B,
                status: 'ACTIVE',
                dueDate: new Date(Date.now() + 86400000),
                book: { id: 'book-b-1' },
              });
            }
            return Promise.resolve(null);
          }),
          update: vi.fn(),
        },
        $transaction: vi.fn().mockImplementation(cb => cb(mockPrisma)),
      };
      service = new LibraryService(mockPrisma as PrismaService);
    });

    it('Tenant A cannot return a book borrowed under Tenant B (must throw NotFoundException)', async () => {
      await expect(service.returnBook(TENANT_A, 'borrow-b-1', { condition: 'good' } as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.libraryBorrow.update).not.toHaveBeenCalled();
    });
  });
});
