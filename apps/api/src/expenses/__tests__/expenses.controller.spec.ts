import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpensesController } from '../expenses.controller';
import { ExpensesService } from '../expenses.service';
import { ExpenseCategory } from '@prisma/client';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    getSummary: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      getSummary: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    controller = new ExpensesController(service as unknown as ExpensesService);
  });

  describe('findAll', () => {
    it('calls service.findAll with orgId and query', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });
      const res = await controller.findAll('org-1', { page: 1, limit: 10 });
      expect(service.findAll).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
      expect(res.total).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('calls service.getSummary', async () => {
      service.getSummary.mockResolvedValue({ total: 1000 });
      const res = await controller.getSummary('org-1', {});
      expect(service.getSummary).toHaveBeenCalledWith('org-1', {});
      expect(res.total).toBe(1000);
    });
  });

  describe('findOne', () => {
    it('calls service.findOne', async () => {
      service.findOne.mockResolvedValue({ id: 'exp-1' });
      const res = await controller.findOne('org-1', 'exp-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'exp-1');
      expect(res.id).toBe('exp-1');
    });
  });

  describe('create', () => {
    it('calls service.create', async () => {
      service.create.mockResolvedValue({ id: 'exp-1' });
      const dto = {
        category: ExpenseCategory.RENT,
        amount: 500,
        date: '2026-09-01T00:00:00.000Z',
      };
      const res = await controller.create('org-1', dto);
      expect(service.create).toHaveBeenCalledWith('org-1', dto);
      expect(res.id).toBe('exp-1');
    });
  });

  describe('update', () => {
    it('calls service.update', async () => {
      service.update.mockResolvedValue({ id: 'exp-1', amount: 600 });
      const res = await controller.update('org-1', 'exp-1', { amount: 600 });
      expect(service.update).toHaveBeenCalledWith('org-1', 'exp-1', { amount: 600 });
      expect(res.amount).toBe(600);
    });
  });

  describe('remove', () => {
    it('calls service.remove', async () => {
      service.remove.mockResolvedValue({ id: 'exp-1' });
      const res = await controller.remove('org-1', 'exp-1');
      expect(service.remove).toHaveBeenCalledWith('org-1', 'exp-1');
      expect(res.id).toBe('exp-1');
    });
  });
});
