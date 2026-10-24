import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from '../invoices.controller';
import { InvoicesService } from '../invoices.service';
import { Role } from '@prisma/client';
import { CreateInvoiceDto, RecordPaymentDto, CreateRefundDto } from '../dto/invoice.dto';
import { UnauthorizedException } from '@nestjs/common';
import { RedisPubSubService } from '../../common/redis/redis-pubsub.service';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    getBalanceForUser: ReturnType<typeof vi.fn>;
    getStudentBalance: ReturnType<typeof vi.fn>;
    getInvoiceForStudent: ReturnType<typeof vi.fn>;
    getPaymentLinks: ReturnType<typeof vi.fn>;
    createInvoice: ReturnType<typeof vi.fn>;
    addItem: ReturnType<typeof vi.fn>;
    issueInvoice: ReturnType<typeof vi.fn>;
    cancelInvoice: ReturnType<typeof vi.fn>;
    recordPayment: ReturnType<typeof vi.fn>;
    requestRefund: ReturnType<typeof vi.fn>;
    processRefund: ReturnType<typeof vi.fn>;
    rejectRefund: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      getBalanceForUser: vi.fn(),
      getStudentBalance: vi.fn(),
      getInvoiceForStudent: vi.fn(),
      getPaymentLinks: vi.fn(),
      createInvoice: vi.fn(),
      addItem: vi.fn(),
      issueInvoice: vi.fn(),
      cancelInvoice: vi.fn(),
      recordPayment: vi.fn(),
      requestRefund: vi.fn(),
      processRefund: vi.fn(),
      rejectRefund: vi.fn(),
    };

    controller = new InvoicesController(service as unknown as InvoicesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('calls service.findAll with parsed queries', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });
      const result = await controller.findAll(orgId, 'ISSUED', 's-1', 'true', '1', '10');
      expect(result).toEqual({ items: [], total: 0 });
      expect(service.findAll).toHaveBeenCalledWith(orgId, {
        status: 'ISSUED',
        studentId: 's-1',
        overdue: true,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('myBalance', () => {
    it('calls getBalanceForUser', async () => {
      service.getBalanceForUser.mockResolvedValue({ balance: 500 });
      const result = await controller.myBalance({ organizationId: orgId, id: userId, role: Role.STUDENT });
      expect(result).toEqual({ balance: 500 });
      expect(service.getBalanceForUser).toHaveBeenCalledWith(orgId, userId);
    });
  });

  describe('findOne', () => {
    it('routes to getInvoiceForStudent if caller is STUDENT', async () => {
      service.getInvoiceForStudent.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.findOne(
        { organizationId: orgId, id: userId, role: Role.STUDENT },
        'inv-1',
      );
      expect(result).toEqual({ id: 'inv-1' });
      expect(service.getInvoiceForStudent).toHaveBeenCalledWith(orgId, userId, 'inv-1');
    });

    it('routes to findOne if caller is admin', async () => {
      service.findOne.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.findOne(
        { organizationId: orgId, id: userId, role: Role.ORG_ADMIN },
        'inv-1',
      );
      expect(result).toEqual({ id: 'inv-1' });
      expect(service.findOne).toHaveBeenCalledWith(orgId, 'inv-1');
    });
  });

  describe('paymentLinks (SEC-FIN-01 regression)', () => {
    it('verifies student ownership via getInvoiceForStudent if caller is STUDENT', async () => {
      service.getInvoiceForStudent.mockResolvedValue({ id: 'inv-1' });
      service.getPaymentLinks.mockResolvedValue({ paymeUrl: 'https://payme/1', clickUrl: 'https://click/1' });
      const result = await controller.paymentLinks(
        { organizationId: orgId, id: userId, role: Role.STUDENT },
        'inv-1',
      );
      expect(service.getInvoiceForStudent).toHaveBeenCalledWith(orgId, userId, 'inv-1');
      expect(service.getPaymentLinks).toHaveBeenCalledWith(orgId, 'inv-1');
      expect(result).toEqual({ paymeUrl: 'https://payme/1', clickUrl: 'https://click/1' });
    });

    it('rejects cross-student payment links request if invoice does not belong to student', async () => {
      service.getInvoiceForStudent.mockRejectedValue(new Error('Invoice not found'));
      await expect(
        controller.paymentLinks(
          { organizationId: orgId, id: userId, role: Role.STUDENT },
          'inv-other-student',
        ),
      ).rejects.toThrow('Invoice not found');
      expect(service.getInvoiceForStudent).toHaveBeenCalledWith(orgId, userId, 'inv-other-student');
      expect(service.getPaymentLinks).not.toHaveBeenCalled();
    });

    it('bypasses student ownership check if caller is ORG_ADMIN', async () => {
      service.getPaymentLinks.mockResolvedValue({ paymeUrl: 'https://payme/1', clickUrl: 'https://click/1' });
      const result = await controller.paymentLinks(
        { organizationId: orgId, id: userId, role: Role.ORG_ADMIN },
        'inv-1',
      );
      expect(service.getInvoiceForStudent).not.toHaveBeenCalled();
      expect(service.getPaymentLinks).toHaveBeenCalledWith(orgId, 'inv-1');
      expect(result).toEqual({ paymeUrl: 'https://payme/1', clickUrl: 'https://click/1' });
    });
  });

  describe('create', () => {
    it('calls createInvoice', async () => {
      const dto: CreateInvoiceDto = {
        studentId: 's-1',
        number: 'INV-100',
        items: [{ description: 'Item', unitPrice: 100 }],
      };
      service.createInvoice.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.create({ organizationId: orgId, id: userId }, dto);
      expect(result).toEqual({ id: 'inv-1' });
      expect(service.createInvoice).toHaveBeenCalledWith(orgId, userId, dto);
    });
  });

  describe('recordPayment', () => {
    it('throws UnauthorizedException if dto.invoiceId does not match URL id', async () => {
      const dto: RecordPaymentDto = { invoiceId: 'inv-2', amount: 100 };
      expect(() =>
        controller.recordPayment({ organizationId: orgId, id: userId }, 'inv-1', dto),
      ).toThrow(UnauthorizedException);
    });

    it('calls recordPayment when invoiceId matches URL id', async () => {
      const dto: RecordPaymentDto = { invoiceId: 'inv-1', amount: 100 };
      service.recordPayment.mockResolvedValue({ receipt: 'RCP-1' });
      const result = await controller.recordPayment(
        { organizationId: orgId, id: userId },
        'inv-1',
        dto,
      );
      expect(result).toEqual({ receipt: 'RCP-1' });
      expect(service.recordPayment).toHaveBeenCalledWith(orgId, userId, dto);
    });
  });

  describe('refund operations', () => {
    it('handles requestRefund', async () => {
      const dto: CreateRefundDto = { paymentId: 'p-1', amount: 50 };
      service.requestRefund.mockResolvedValue({ id: 'ref-1' });
      const result = await controller.requestRefund({ organizationId: orgId, id: userId }, dto);
      expect(result).toEqual({ id: 'ref-1' });
      expect(service.requestRefund).toHaveBeenCalledWith(orgId, userId, dto);
    });

    it('handles processRefund', async () => {
      service.processRefund.mockResolvedValue({ id: 'ref-1', status: 'PROCESSED' });
      const result = await controller.processRefund(
        { organizationId: orgId, id: userId },
        'ref-1',
        'ext-123',
      );
      expect(result).toEqual({ id: 'ref-1', status: 'PROCESSED' });
      expect(service.processRefund).toHaveBeenCalledWith(orgId, userId, 'ref-1', 'ext-123');
    });

    it('handles rejectRefund', async () => {
      service.rejectRefund.mockResolvedValue({ id: 'ref-1', status: 'REJECTED' });
      const result = await controller.rejectRefund(
        { organizationId: orgId, id: userId },
        'ref-1',
        'Duplicate request',
      );
      expect(result).toEqual({ id: 'ref-1', status: 'REJECTED' });
      expect(service.rejectRefund).toHaveBeenCalledWith(
        orgId,
        userId,
        'ref-1',
        'Duplicate request',
      );
    });
  });
});
