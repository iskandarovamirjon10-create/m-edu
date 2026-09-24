import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    inventoryItem: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    inventoryTransaction: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const mockItem = {
    id: 'item-1',
    organizationId: 'org-1',
    name: 'Textbook',
    category: 'BOOKS' as const,
    quantity: 50,
    unit: 'pcs',
    minStock: 10,
    purchasePrice: 20,
    sellingPrice: 30,
  };

  beforeEach(() => {
    prisma = {
      inventoryItem: {
        findMany: vi.fn().mockResolvedValue([mockItem]),
        findFirst: vi.fn().mockResolvedValue(mockItem),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue(mockItem),
        update: vi.fn().mockResolvedValue(mockItem),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        delete: vi.fn().mockResolvedValue(mockItem),
        aggregate: vi.fn().mockResolvedValue({ _sum: { purchasePrice: 100 } }),
        groupBy: vi.fn().mockResolvedValue([{ category: 'BOOKS', _count: { category: 1 }, _sum: { quantity: 50 } }]),
      },
      inventoryTransaction: {
        create: vi.fn().mockResolvedValue({ id: 'tx-1' }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    service = new InventoryService(prisma as unknown as PrismaService);
  });

  describe('findAllItems', () => {
    it('should return paginated items', async () => {
      const result = await service.findAllItems('org-1', { page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findItemById', () => {
    it('should return item when found', async () => {
      const result = await service.findItemById('org-1', 'item-1');
      expect(result).toEqual(mockItem);
    });

    it('should throw NotFoundException when item is missing', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      await expect(service.findItemById('org-1', 'item-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createItem', () => {
    it('should create an inventory item', async () => {
      const dto = {
        name: 'Notebook',
        category: 'SUPPLIES' as const,
        unit: 'pcs',
        quantity: 100,
      };
      const result = await service.createItem('org-1', dto);
      expect(result).toBeDefined();
      expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organizationId: 'org-1', name: 'Notebook' }),
      });
    });
  });

  describe('updateItem', () => {
    it('should update item', async () => {
      const result = await service.updateItem('org-1', 'item-1', { name: 'Updated' });
      expect(result).toEqual(mockItem);
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { name: 'Updated' },
      });
    });

    it('should reject quantity below minStock', async () => {
      await expect(service.updateItem('org-1', 'item-1', { quantity: 5 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteItem', () => {
    it('should delete item when no transactions exist', async () => {
      prisma.inventoryTransaction.count.mockResolvedValue(0);
      const result = await service.deleteItem('org-1', 'item-1');
      expect(result).toEqual(mockItem);
      expect(prisma.inventoryItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });

    it('should throw BadRequestException if item has transactions', async () => {
      prisma.inventoryTransaction.count.mockResolvedValue(5);
      await expect(service.deleteItem('org-1', 'item-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createTransaction', () => {
    it('should decrement stock for ISSUE transaction', async () => {
      const result = await service.createTransaction(
        'org-1',
        { itemId: 'item-1', type: 'ISSUE', quantity: 5 },
        'user-1',
      );
      expect(result).toBeDefined();
      expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', organizationId: 'org-1', quantity: { gte: 5 } },
        data: { quantity: { decrement: 5 } },
      });
    });

    it('should decrement stock for DAMAGE transaction (outbound)', async () => {
      const result = await service.createTransaction(
        'org-1',
        { itemId: 'item-1', type: 'DAMAGE', quantity: 3 },
        'user-1',
      );
      expect(result).toBeDefined();
      expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', organizationId: 'org-1', quantity: { gte: 3 } },
        data: { quantity: { decrement: 3 } },
      });
    });

    it('should decrement stock for DISPOSAL transaction (outbound)', async () => {
      await service.createTransaction(
        'org-1',
        { itemId: 'item-1', type: 'DISPOSAL', quantity: 2 },
        'user-1',
      );
      expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', organizationId: 'org-1', quantity: { gte: 2 } },
        data: { quantity: { decrement: 2 } },
      });
    });

    it('should reject DAMAGE if quantity exceeds available stock', async () => {
      await expect(
        service.createTransaction(
          'org-1',
          { itemId: 'item-1', type: 'DAMAGE', quantity: 999 },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject ISSUE if quantity exceeds available stock', async () => {
      await expect(
        service.createTransaction('org-1', { itemId: 'item-1', type: 'ISSUE', quantity: 999 }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should increment stock for PURCHASE transaction', async () => {
      await service.createTransaction('org-1', { itemId: 'item-1', type: 'PURCHASE', quantity: 10 }, 'user-1');
      expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', organizationId: 'org-1' },
        data: { quantity: { increment: 10 } },
      });
    });
  });

  describe('updateStock and adjustStock', () => {
    it('should update stock directly', async () => {
      await service.updateStock('org-1', 'item-1', 75);
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 75 },
      });
    });

    it('should reject negative stock on updateStock', async () => {
      await expect(service.updateStock('org-1', 'item-1', -1)).rejects.toThrow(BadRequestException);
    });

    it('should adjust stock positively', async () => {
      await service.adjustStock('org-1', 'item-1', 10);
      expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', organizationId: 'org-1' },
        data: { quantity: { increment: 10 } },
      });
    });

    it('should adjust stock negatively with safety check', async () => {
      await service.adjustStock('org-1', 'item-1', -10);
      expect(prisma.inventoryItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', organizationId: 'org-1', quantity: { gte: 10 } },
        data: { quantity: { increment: -10 } },
      });
    });
  });

  describe('reports', () => {
    it('should generate stock report', async () => {
      const report = await service.getStockReport('org-1');
      expect(report.summary.totalItems).toBe(1);
      expect(report.lowStockItems).toBeDefined();
    });

    it('should return category stats', async () => {
      const stats = await service.getCategoryStats('org-1');
      expect(stats).toBeDefined();
    });
  });
});
