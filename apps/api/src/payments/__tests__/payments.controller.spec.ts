import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1';

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('delegates to service.findAll', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });
      const result = await controller.findAll(orgId, { page: 1, limit: 10 });
      expect(result).toEqual({ items: [], total: 0 });
      expect(service.findAll).toHaveBeenCalledWith(orgId, { page: 1, limit: 10 });
    });
  });

describe('findOne', () => {
    it('delegates to service.findOne', async () => {
      const mockPay = { id: 'p-1', amount: 100 };
      service.findOne.mockResolvedValue(mockPay);
      const result = await controller.findOne(orgId, 'p-1');
      expect(result).toEqual(mockPay);
      expect(service.findOne).toHaveBeenCalledWith(orgId, 'p-1');
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = { studentId: 's-1', amount: 50 } as never;
      const mockPay = { id: 'p-2', amount: 50 };
      service.create = vi.fn().mockResolvedValue(mockPay);
      const result = await controller.create(orgId, dto);
      expect(result).toEqual(mockPay);
      expect(service.create).toHaveBeenCalledWith(orgId, dto);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { status: 'PAID' } as never;
      const mockPay = { id: 'p-1', status: 'PAID' };
      service.update = vi.fn().mockResolvedValue(mockPay);
      const result = await controller.update(orgId, 'p-1', dto);
      expect(result).toEqual(mockPay);
      expect(service.update).toHaveBeenCalledWith(orgId, 'p-1', dto);
    });
  });
});
