import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
      findFirst: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    mockPrisma.certificate.findFirst.mockReset();
    mockPrisma.certificate.create.mockReset();
    mockPrisma.student.findFirst.mockImplementation(mockPrisma.student.findUnique);
    mockPrisma.course.findFirst.mockImplementation(mockPrisma.course.findUnique);
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

    it('safely handles template keys with special regex characters without ReDoS or syntax error', () => {
      const html = '<h1>Hello {{user[name]}} and {{student+grade}} and {{score*100}}</h1>';
      const rendered = service.renderTemplate(html, {
        'user[name]': 'Alice',
        'student+grade': 'Grade A+',
        'score*100': '98%',
      });
      expect(rendered).toBe('<h1>Hello Alice and Grade A+ and 98%</h1>');
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

  describe('DB-002: Tenant-scoped Certificate.certificateNumber uniqueness and isolation', () => {
    const dto = { studentId: 's1', courseId: 'cr1' };

    it('rejects duplicate certificateNumber within the same organization (intra-tenant rejection)', async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValueOnce({ id: 'cr1' });
      mockPrisma.studentGroup.findFirst.mockResolvedValueOnce({ id: 'sg1' });
      mockPrisma.certificate.findFirst.mockImplementation(async ({ where }: { where: { certificateNumber?: string; studentId?: string } }) => {
        if (where.certificateNumber) {
          return { id: 'dup-cert', organizationId: orgId, certificateNumber: where.certificateNumber };
        }
        return null;
      });

      await expect(service.generateCertificate(orgId, dto)).rejects.toThrow(BadRequestException);
    });

    it('allows same certificateNumber in a different organization (cross-tenant allow)', async () => {
      const org2Id = 'org-2-uuid';
      mockPrisma.student.findUnique.mockResolvedValueOnce({ id: 's2' });
      mockPrisma.course.findUnique.mockResolvedValueOnce({ id: 'cr2' });
      mockPrisma.studentGroup.findFirst.mockResolvedValueOnce({ id: 'sg2' });
      mockPrisma.certificate.findFirst
        .mockResolvedValueOnce(null) // no existing cert for student+course in org-2
        .mockResolvedValueOnce(null); // certificateNumber is unique within org-2

      mockPrisma.certificate.create.mockResolvedValueOnce({
        id: 'cert-org2',
        organizationId: org2Id,
        certificateNumber: 'CERT-SHARED-001',
      });

      const res = await service.generateCertificate(org2Id, { studentId: 's2', courseId: 'cr2' });
      expect(res).toBeDefined();
      expect(mockPrisma.certificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: org2Id,
          }),
        }),
      );
    });

    it('prohibits cross-tenant access to certificates belonging to another organization', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.findCertificateById('org-2', 'cert-org-1', 'u1', 'ORG_ADMIN'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.certificate.findFirst).toHaveBeenCalledWith({
        where: { id: 'cert-org-1', organizationId: 'org-2' },
        include: expect.any(Object),
      });
    });

    it('retries and succeeds when first attempt hits certificateNumber P2002 collision', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'cr1' });
      mockPrisma.studentGroup.findFirst.mockResolvedValue({ id: 'sg1' });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);

      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target: ['organizationId', 'certificateNumber'] },
      });
      const successfulCert = { id: 'cert-retry-success', certificateNumber: 'CERT-RETRY-001' };

      mockPrisma.certificate.create
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce(successfulCert);

      const res = await service.generateCertificate(orgId, dto);
      expect(res).toEqual(successfulCert);
      expect(mockPrisma.certificate.create).toHaveBeenCalledTimes(2);
    });

    it('exhausts MAX_RETRIES (3 attempts) on persistent certificateNumber collision and throws BadRequestException', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'cr1' });
      mockPrisma.studentGroup.findFirst.mockResolvedValue({ id: 'sg1' });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);

      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target: ['organizationId', 'certificateNumber'] },
      });

      mockPrisma.certificate.create.mockRejectedValue(p2002Error);

      await expect(service.generateCertificate(orgId, dto)).rejects.toThrow(
        new BadRequestException('Certificate number already exists in this organization'),
      );
      expect(mockPrisma.certificate.create).toHaveBeenCalledTimes(3);
    });

    it('retries and succeeds when first attempt hits verificationCode P2002 collision', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'cr1' });
      mockPrisma.studentGroup.findFirst.mockResolvedValue({ id: 'sg1' });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);

      const p2002Verification = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target: ['verificationCode'] },
      });
      const successfulCert = { id: 'cert-code-success', verificationCode: 'V999' };

      mockPrisma.certificate.create
        .mockRejectedValueOnce(p2002Verification)
        .mockResolvedValueOnce(successfulCert);

      const res = await service.generateCertificate(orgId, dto);
      expect(res).toEqual(successfulCert);
      expect(mockPrisma.certificate.create).toHaveBeenCalledTimes(2);
    });

    it('does not retry when P2002 error target is an unrelated constraint and throws immediately', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 's1' });
      mockPrisma.course.findUnique.mockResolvedValue({ id: 'cr1' });
      mockPrisma.studentGroup.findFirst.mockResolvedValue({ id: 'sg1' });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);

      const p2002Other = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target: ['organizationId', 'otherConstraint'] },
      });

      mockPrisma.certificate.create.mockRejectedValue(p2002Other);

      await expect(service.generateCertificate(orgId, dto)).rejects.toThrow(
        new BadRequestException('Certificate unique constraint violation: organizationId,otherConstraint'),
      );
      expect(mockPrisma.certificate.create).toHaveBeenCalledTimes(1);
    });

    it('handles concurrent certificate generation requests independently', async () => {
      mockPrisma.student.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
      mockPrisma.course.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
      mockPrisma.studentGroup.findFirst.mockResolvedValue({ id: 'sg1' });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);

      mockPrisma.certificate.create.mockImplementation(async ({ data }: { data: { studentId: string; certificateNumber: string; verificationCode: string } }) => ({
        id: `cert-${data.studentId}`,
        ...data,
      }));

      const [cert1, cert2] = await Promise.all([
        service.generateCertificate(orgId, { studentId: 'student-A', courseId: 'cr1' }),
        service.generateCertificate(orgId, { studentId: 'student-B', courseId: 'cr1' }),
      ]);

      expect(cert1).toBeDefined();
      expect(cert2).toBeDefined();
      expect((cert1 as { id: string }).id).toBe('cert-student-A');
      expect((cert2 as { id: string }).id).toBe('cert-student-B');
      expect((cert1 as { certificateNumber: string }).certificateNumber).not.toBe((cert2 as { certificateNumber: string }).certificateNumber);
      expect((cert1 as { verificationCode: string }).verificationCode).not.toBe((cert2 as { verificationCode: string }).verificationCode);
    });
  });
});
