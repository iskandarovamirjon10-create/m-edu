import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryController } from '../inventory.controller';
import { InventoryService } from '../inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: InventoryService;

  const mockItem = {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 'org-1',
    name: 'Desk',
    category: 'FURNITURE' as const,
    quantity: 10,
    unit: 'pcs',
    minStock: 2,
  };

  beforeEach(() => {
    service = {
      findAllItems: vi.fn().mockResolvedValue({ items: [mockItem], total: 1 }),
      findItemById: vi.fn().mockResolvedValue(mockItem),
      createItem: vi.fn().mockResolvedValue(mockItem),
      updateItem: vi.fn().mockResolvedValue(mockItem),
      deleteItem: vi.fn().mockResolvedValue(mockItem),
      getTransactionHistory: vi.fn().mockResolvedValue({ transactions: [], total: 0 }),
      createTransaction: vi.fn().mockResolvedValue({ id: 'tx-1' }),
      updateStock: vi.fn().mockResolvedValue(mockItem),
      adjustStock: vi.fn().mockResolvedValue(mockItem),
      getStockReport: vi.fn().mockResolvedValue({ summary: { totalItems: 1 } }),
      getCategoryStats: vi.fn().mockResolvedValue([]),
    } as unknown as InventoryService;

    controller = new InventoryController(service);
  });

  it('should find all items', async () => {
    const result = await controller.findAllItems({ organizationId: 'org-1' }, { page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(service.findAllItems).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
  });

  it('should find item by id', async () => {
    const result = await controller.findItemById({ organizationId: 'org-1' }, mockItem.id);
    expect(result).toEqual(mockItem);
    expect(service.findItemById).toHaveBeenCalledWith('org-1', mockItem.id);
  });

  it('should create item', async () => {
    const dto = { name: 'Desk', category: 'FURNITURE' as const, unit: 'pcs' };
    const result = await controller.createItem({ organizationId: 'org-1' }, dto);
    expect(result).toEqual(mockItem);
    expect(service.createItem).toHaveBeenCalledWith('org-1', dto);
  });

  it('should update item', async () => {
    const dto = { name: 'New Desk' };
    const result = await controller.updateItem({ organizationId: 'org-1' }, mockItem.id, dto);
    expect(result).toEqual(mockItem);
    expect(service.updateItem).toHaveBeenCalledWith('org-1', mockItem.id, dto);
  });

  it('should delete item', async () => {
    const result = await controller.deleteItem({ organizationId: 'org-1' }, mockItem.id);
    expect(result).toEqual(mockItem);
    expect(service.deleteItem).toHaveBeenCalledWith('org-1', mockItem.id);
  });

  it('should get transaction history', async () => {
    const result = await controller.getTransactionHistory({ organizationId: 'org-1' }, mockItem.id, { page: 1, limit: 10 });
    expect(result.total).toBe(0);
    expect(service.getTransactionHistory).toHaveBeenCalledWith('org-1', mockItem.id, { page: 1, limit: 10 });
  });

  it('should create transaction with authenticated userId', async () => {
    const dto = { itemId: mockItem.id, type: 'ISSUE' as const, quantity: 2 };
    const result = await controller.createTransaction({ organizationId: 'org-1', id: 'user-1' }, dto);
    expect(result).toEqual({ id: 'tx-1' });
    expect(service.createTransaction).toHaveBeenCalledWith('org-1', dto, 'user-1');
  });

  it('should update stock', async () => {
    const result = await controller.updateStock({ organizationId: 'org-1' }, mockItem.id, 20);
    expect(result).toEqual(mockItem);
    expect(service.updateStock).toHaveBeenCalledWith('org-1', mockItem.id, 20);
  });

  it('should adjust stock', async () => {
    const result = await controller.adjustStock({ organizationId: 'org-1' }, mockItem.id, { adjustment: -5 });
    expect(result).toEqual(mockItem);
    expect(service.adjustStock).toHaveBeenCalledWith('org-1', mockItem.id, -5);
  });

  it('should get stock report', async () => {
    const result = await controller.getStockReport({ organizationId: 'org-1' });
    expect(result.summary.totalItems).toBe(1);
    expect(service.getStockReport).toHaveBeenCalledWith('org-1');
  });

  it('should get category stats', async () => {
    const result = await controller.getCategoryStats({ organizationId: 'org-1' });
    expect(result).toEqual([]);
    expect(service.getCategoryStats).toHaveBeenCalledWith('org-1');
  });
});
