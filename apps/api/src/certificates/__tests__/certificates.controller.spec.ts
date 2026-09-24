import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { CertificatesController } from '../certificates.controller';
import { CertificatesService } from '../certificates.service';
import { CreateCertificateDto } from '../dto/certificate.dto';
import { CreateCertificateTemplateDto, UpdateCertificateTemplateDto } from '../dto/certificate-template.dto';
import { RequestUser } from '../../auth/types';

describe('CertificatesController', () => {
  let controller: CertificatesController;

  const mockService = {
    findAllCertificates: vi.fn(),
    getStudentCertificates: vi.fn(),
    verifyCertificate: vi.fn(),
    findAllTemplates: vi.fn(),
    findCertificateById: vi.fn(),
    generateCertificate: vi.fn(),
    generatePdf: vi.fn(),
    findTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    setDefaultTemplate: vi.fn(),
  };

  const user: RequestUser = {
    sub: 'user-1',
    email: 'admin@school.com',
    role: Role.ORG_ADMIN,
    organizationId: 'org-1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificatesController],
      providers: [
        {
          provide: CertificatesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CertificatesController>(CertificatesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAllCertificates should call service', async () => {
    mockService.findAllCertificates.mockResolvedValue([]);
    const res = await controller.findAllCertificates(user);
    expect(mockService.findAllCertificates).toHaveBeenCalledWith(user.organizationId);
    expect(res).toEqual([]);
  });

  it('getStudentCertificates should call service', async () => {
    mockService.getStudentCertificates.mockResolvedValue([]);
    const res = await controller.getStudentCertificates(user, 'stu-1');
    expect(mockService.getStudentCertificates).toHaveBeenCalledWith(
      user.organizationId,
      'stu-1',
      user.sub,
      user.role,
    );
    expect(res).toEqual([]);
  });

  it('verifyCertificate should call service without user', async () => {
    mockService.verifyCertificate.mockResolvedValue({ valid: true });
    const res = await controller.verifyCertificate('CERT-123');
    expect(mockService.verifyCertificate).toHaveBeenCalledWith('CERT-123');
    expect(res).toEqual({ valid: true });
  });

  it('findAllTemplates should call service', async () => {
    mockService.findAllTemplates.mockResolvedValue([]);
    const res = await controller.findAllTemplates(user);
    expect(mockService.findAllTemplates).toHaveBeenCalledWith(user.organizationId);
    expect(res).toEqual([]);
  });

  it('findCertificateById should call service', async () => {
    mockService.findCertificateById.mockResolvedValue({ id: 'c-1' });
    const res = await controller.findCertificateById(user, 'c-1');
    expect(mockService.findCertificateById).toHaveBeenCalledWith(user.organizationId, 'c-1', user.sub, user.role);
    expect(res).toEqual({ id: 'c-1' });
  });

  it('generateCertificate should call service', async () => {
    const dto: CreateCertificateDto = { studentId: 's-1', courseId: 'cr-1' };
    mockService.generateCertificate.mockResolvedValue({ id: 'c-1' });
    const res = await controller.generateCertificate(user, dto);
    expect(mockService.generateCertificate).toHaveBeenCalledWith(user.organizationId, dto);
    expect(res).toEqual({ id: 'c-1' });
  });

  it('downloadCertificate should send buffer', async () => {
    const pdfBuffer = Buffer.from('PDF');
    mockService.generatePdf.mockResolvedValue(pdfBuffer);
    const mockRes = {
      header: vi.fn(),
      send: vi.fn(),
    } as unknown as import('express').Response;

    await controller.downloadCertificate(user, 'c-1', mockRes);
    expect(mockService.generatePdf).toHaveBeenCalledWith(user.organizationId, 'c-1');
    expect(mockRes.header).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="certificate-c-1.pdf"');
    expect(mockRes.send).toHaveBeenCalledWith(pdfBuffer);
  });

  it('createTemplate should call service', async () => {
    const dto: CreateCertificateTemplateDto = { name: 'Gold', htmlTemplate: '<h1>{{student}}</h1>' };
    mockService.createTemplate.mockResolvedValue({ id: 't-1' });
    const res = await controller.createTemplate(user, dto);
    expect(mockService.createTemplate).toHaveBeenCalledWith(user.organizationId, dto);
    expect(res).toEqual({ id: 't-1' });
  });

  it('updateTemplate should call service', async () => {
    const dto: UpdateCertificateTemplateDto = { name: 'Silver' };
    mockService.updateTemplate.mockResolvedValue({ id: 't-1', name: 'Silver' });
    const res = await controller.updateTemplate(user, 't-1', dto);
    expect(mockService.updateTemplate).toHaveBeenCalledWith(user.organizationId, 't-1', dto);
    expect(res).toEqual({ id: 't-1', name: 'Silver' });
  });

  it('deleteTemplate should call service', async () => {
    mockService.deleteTemplate.mockResolvedValue({ success: true });
    const res = await controller.deleteTemplate(user, 't-1');
    expect(mockService.deleteTemplate).toHaveBeenCalledWith(user.organizationId, 't-1');
    expect(res).toEqual({ success: true });
  });

  it('setDefaultTemplate should call service', async () => {
    mockService.setDefaultTemplate.mockResolvedValue({ id: 't-1', isDefault: true });
    const res = await controller.setDefaultTemplate(user, 't-1');
    expect(mockService.setDefaultTemplate).toHaveBeenCalledWith(user.organizationId, 't-1');
    expect(res).toEqual({ id: 't-1', isDefault: true });
  });
});
