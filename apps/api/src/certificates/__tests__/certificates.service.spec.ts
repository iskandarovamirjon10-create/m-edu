import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CertificatesService } from '../certificates.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCertificateDto } from '../dto/certificate.dto';
import { CreateCertificateTemplateDto, UpdateCertificateTemplateDto } from '../dto/certificate-template.dto';

describe('CertificatesService', () => {
  let service: CertificatesService;

  const mockPrisma = {
    certificate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    studentGroup: {
      findFirst: vi.fn(),
    },
    certificateTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };

  // Prisma's callback-style transaction hands the callback a tx client; model
  // the same here so the service's `tx.certificate.*` / `tx.$queryRaw` calls
  // hit the mocks instead of resolving to the callback itself.
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => Promise<unknown>)(mockPrisma)
      : arg,
  );

  const orgId = 'org-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CertificatesService(mockPrisma as unknown as PrismaService);
  });

  describe('findAllCertificates', () => {
    it('returns certificates for organization', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([{ id: 'c1' }]);
      const res = await service.findAllCertificates(orgId);
      expect(mockPrisma.certificate.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, isActive: true },
        include: expect.any(Object),
        orderBy: { issueDate: 'desc' },
      });
      expect(res).toEqual([{ id: 'c1' }]);
    });
  });

  describe('findCertificateById', () => {
    it('throws NotFoundException if certificate not found', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      await expect(service.findCertificateById(orgId, 'c1', 'u1', 'STUDENT')).rejects.toThrow(NotFoundException);
    });

    it('allows privileged admin to view any certificate', async () => {
      const cert = { id: 'c1', student: { userId: 'different-user' } };
      mockPrisma.certificate.findFirst.mockResolvedValue(cert);

      const res = await service.findCertificateById(orgId, 'c1', 'admin-u', 'ORG_ADMIN');
      expect(res).toBe(cert);
    });

    it('allows student to view their own certificate', async () => {
      const cert = { id: 'c1', student: { userId: 'student-u' } };
      mockPrisma.certificate.findFirst.mockResolvedValue(cert);

      const res = await service.findCertificateById(orgId, 'c1', 'student-u', 'STUDENT');
      expect(res).toBe(cert);
    });

    it('throws NotFoundException if student tries to view another student certificate', async () => {
      const cert = { id: 'c1', student: { userId: 'other-student' } };
      mockPrisma.certificate.findFirst.mockResolvedValue(cert);

      await expect(service.findCertificateById(orgId, 'c1', 'student-u', 'STUDENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStudentCertificates', () => {
    it('throws NotFoundException if student does not exist in org', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(null);
      await expect(service.getStudentCertificates(orgId, 's1')).rejects.toThrow(NotFoundException);
    });

    it('returns student and their active certificates', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.certificate.findMany.mockResolvedValue([{ id: 'c1' }]);

      const res = await service.getStudentCertificates(orgId, 's1');
      expect(res.student).toEqual({ id: 's1' });
      expect(res.certificates).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });

  describe('generateCertificate', () => {
    const dto: CreateCertificateDto = { studentId: 's1', courseId: 'cr1' };

    it('throws NotFoundException if student not found', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(null);
      await expect(service.generateCertificate(orgId, dto)).rejects.toThrow('Student not found');
    });

    it('throws NotFoundException if course not found', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValue(null);
      await expect(service.generateCertificate(orgId, dto)).rejects.toThrow('Course not found');
    });

    it('throws BadRequestException if student is not enrolled in course group', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'cr1' });
      mockPrisma.studentGroup.findFirst.mockResolvedValue(null);
      await expect(service.generateCertificate(orgId, dto)).rejects.toThrow(/not enrolled/);
    });

    it('throws BadRequestException if active certificate already exists', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'cr1' });
      mockPrisma.studentGroup.findFirst.mockResolvedValue({ id: 'sg1' });
      mockPrisma.certificate.findFirst.mockResolvedValue({ id: 'existing-cert' });

      await expect(service.generateCertificate(orgId, dto)).rejects.toThrow(/already exists/);
    });

    it('creates certificate with generated number and verification code', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'cr1' });
      mockPrisma.studentGroup.findFirst.mockResolvedValue({ id: 'sg1' });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.certificate.create.mockResolvedValue({ id: 'new-cert' });

      const res = await service.generateCertificate(orgId, dto);
      expect(mockPrisma.certificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            studentId: 's1',
            courseId: 'cr1',
            isActive: true,
          }),
        }),
      );
      expect(res).toEqual({ id: 'new-cert' });
    });
  });

  describe('generatePdf & renderTemplate', () => {
    it('escapes user input in rendered HTML to prevent XSS', () => {
      const html = '<h1>Hello {{studentName}}</h1>';
      const rendered = service.renderTemplate(html, {
        studentName: '<script>alert("xss")</script>',
      });
      expect(rendered).not.toContain('<script>');
      expect(rendered).toContain('&lt;script&gt;');
    });

    it('generates PDF buffer and updates certificate with download url', async () => {
      const cert = {
        id: 'c1',
        certificateNumber: 'CERT-001',
        verificationCode: 'V123',
        issueDate: new Date('2026-01-01'),
        student: { user: { firstName: 'John', lastName: 'Doe' } },
        course: { name: 'Fullstack' },
      };
      mockPrisma.certificate.findFirst.mockResolvedValue(cert);
      mockPrisma.certificate.update.mockResolvedValue(cert);

      const buffer = await service.generatePdf(orgId, 'c1');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      // Must be a REAL PDF (not HTML bytes mislabelled application/pdf) —
      // regression F-04.
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
      expect(mockPrisma.certificate.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { pdfUrl: '/api/certificates/c1/download' },
      });
    });
  });

  describe('verifyCertificate', () => {
    it('throws NotFoundException when certificate does not exist or is inactive', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      await expect(service.verifyCertificate('INVALID')).rejects.toThrow('Certificate not found or inactive');
    });

    it('returns verification result without sensitive PII', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue({
        certificateNumber: 'CERT-1',
        issueDate: new Date('2026-01-01'),
        student: { user: { firstName: 'John', lastName: 'Doe' } },
        course: { name: 'Math' },
      });

      const res = await service.verifyCertificate('V-123');
      expect(res.isValid).toBe(true);
      expect(res.student).toEqual({ firstName: 'John', lastName: 'Doe' });
      expect(res).not.toHaveProperty('email');
      expect(res).not.toHaveProperty('phone');
    });
  });

  describe('Template Management', () => {
    it('findAllTemplates queries by organizationId', async () => {
      mockPrisma.certificateTemplate.findMany.mockResolvedValue([]);
      await service.findAllTemplates(orgId);
      expect(mockPrisma.certificateTemplate.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('findTemplateById throws NotFoundException when missing', async () => {
      mockPrisma.certificateTemplate.findFirst.mockResolvedValue(null);
      await expect(service.findTemplateById(orgId, 't1')).rejects.toThrow(NotFoundException);
    });

    it('createTemplate creates template scoped to organizationId', async () => {
      const dto: CreateCertificateTemplateDto = { name: 'Default', htmlTemplate: '<div></div>' };
      mockPrisma.certificateTemplate.create.mockResolvedValue({ id: 't1', ...dto });

      const res = await service.createTemplate(orgId, dto);
      expect(mockPrisma.certificateTemplate.create).toHaveBeenCalledWith({
        data: { ...dto, organizationId: orgId },
      });
      expect(res).toEqual({ id: 't1', ...dto });
    });

    it('updateTemplate updates template', async () => {
      mockPrisma.certificateTemplate.findFirst.mockResolvedValue({ id: 't1' });
      mockPrisma.certificateTemplate.update.mockResolvedValue({ id: 't1', name: 'New' });

      const dto: UpdateCertificateTemplateDto = { name: 'New' };
      const res = await service.updateTemplate(orgId, 't1', dto);
      expect(mockPrisma.certificateTemplate.update).toHaveBeenCalledWith({
        where: { id: 't1', organizationId: orgId },
        data: dto,
      });
      expect(res).toEqual({ id: 't1', name: 'New' });
    });

    it('deleteTemplate throws ConflictException when template is in use', async () => {
      mockPrisma.certificateTemplate.findFirst.mockResolvedValue({ id: 't1' });
      mockPrisma.certificate.count.mockResolvedValue(5);

      await expect(service.deleteTemplate(orgId, 't1')).rejects.toThrow(ConflictException);
    });

    it('deleteTemplate deletes when not in use', async () => {
      mockPrisma.certificateTemplate.findFirst.mockResolvedValue({ id: 't1' });
      mockPrisma.certificate.count.mockResolvedValue(0);
      mockPrisma.certificateTemplate.delete.mockResolvedValue({ id: 't1' });

      const res = await service.deleteTemplate(orgId, 't1');
      expect(mockPrisma.certificateTemplate.delete).toHaveBeenCalledWith({
        where: { id: 't1', organizationId: orgId },
      });
      expect(res).toEqual({ deleted: true });
    });

    it('setDefaultTemplate sets template as default inside transaction', async () => {
      mockPrisma.certificateTemplate.findFirst.mockResolvedValue({ id: 't1' });
      mockPrisma.certificateTemplate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.certificateTemplate.update.mockResolvedValue({ id: 't1', isDefault: true });

      await service.setDefaultTemplate(orgId, 't1');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
