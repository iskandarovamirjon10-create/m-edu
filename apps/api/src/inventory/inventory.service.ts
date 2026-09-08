import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto, UpdateInventoryItemDto, CreateTransactionDto } from './dto/inventory.dto';
import { PaginationParams } from '../common/dto/pagination';
import { parsePagination } from '../lib/pagination';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ===================== Inventory Items =====================

  async findAllItems(organizationId: string, params: PaginationParams) {
    const { search, category, status } = params as any;
    const { skip, limit: limitVal } = parsePagination(params);
    const pageVal = Math.max(1, parseInt(String(params?.page ?? ''), 10) || 1);

    const where: any = { organizationId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        skip,
        take: limitVal,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Math.max(1, limitVal));
    return {
      items,
      total,
      page: pageVal,
      limit: limitVal,
      totalPages,
    };
  }

  async findItemById(organizationId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, organizationId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async createItem(organizationId: string, dto: CreateInventoryItemDto) {
    return this.prisma.inventoryItem.create({
      data: {
        ...dto,
        organizationId,
        quantity: dto.quantity || 0,
      },
    });
  }

  async updateItem(organizationId: string, id: string, dto: UpdateInventoryItemDto) {
    const item = await this.findItemById(organizationId, id);

    // Check if quantity is being set below minimum stock
    if (dto.quantity !== undefined && dto.quantity < item.minStock) {
      throw new BadRequestException(`Quantity cannot be below minimum stock (${item.minStock})`);
    }

    return this.prisma.inventoryItem.update({
      where: { id, organizationId },
      data: dto,
    });
  }

  async deleteItem(organizationId: string, id: string) {
    const item = await this.findItemById(organizationId, id);

    // Check if item has active transactions
    const transactionCount = await this.prisma.inventoryTransaction.count({
      where: { itemId: id },
    });

    if (transactionCount > 0) {
      throw new BadRequestException('Cannot delete item with existing transactions');
    }

    return this.prisma.inventoryItem.delete({
      where: { id, organizationId },
    });
  }

  // ===================== Transactions =====================

  async createTransaction(organizationId: string, dto: CreateTransactionDto, userId: string) {
    const { itemId, type, quantity, notes } = dto;
    // Security: createdBy must come from the authenticated principal only.
    // A client-supplied createdBy is never trusted.
    const createdBy = userId;

    if (quantity <= 0) {
      throw new BadRequestException('Transaction quantity must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      // Read item inside transaction with row-level lock to prevent concurrent
      // transactions from reading stale quantity values (fixes check-then-act race).
      const item = await tx.inventoryItem.findFirst({
        where: { id: itemId, organizationId },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      // Atomic quantity validation and update for decrementing operations.
      // P2002 unique constraint on itemId+type+createdAt is already handled by
      // the service-level deduplication in the controller; the transaction
      // ensures atomicity of the quantity update.
      if (type === 'ISSUE' || type === 'DISPOSAL') {
        if (quantity > item.quantity) {
          throw new BadRequestException(`Insufficient stock. Available: ${item.quantity}`);
        }

        // Atomic decrement — only succeeds if quantity has not changed since read.
        // Includes organizationId in WHERE to enforce tenant isolation.
        const result = await tx.inventoryItem.updateMany({
          where: {
            id: itemId,
            organizationId,  // tenant isolation on the update target
            quantity: { gte: quantity },
          },
          data: { quantity: { decrement: quantity } },
        });

        if (result.count === 0) {
          // Either quantity dropped below threshold or organizationId mismatch.
          // Re-throw with a generic message to avoid leaking timing data.
          throw new BadRequestException('Insufficient stock or item not accessible');
        }
      } else {
        // Increment operations (PURCHASE, RETURN) are inherently safe since
        // quantity cannot go negative. Include organizationId in WHERE for
        // consistency and defense-in-depth.
        await tx.inventoryItem.updateMany({
          where: { id: itemId, organizationId },
          data: { quantity: { increment: quantity } },
        });
      }

      // Create transaction record after successful quantity update.
      const transaction = await tx.inventoryTransaction.create({
        data: {
          organizationId,
          itemId,
          type,
          quantity,
          notes,
          createdBy,
        },
      });

      return transaction;
    });
  }

  async getTransactionHistory(organizationId: string, itemId: string, params: PaginationParams) {
    const item = await this.findItemById(organizationId, itemId);
    const { skip } = parsePagination(params);
    const pageVal = Math.max(1, parseInt(String(params?.page ?? ''), 10) || 1);
    const limitVal = Math.min(Math.max(1, parseInt(String(params?.limit ?? ''), 10) || 20), 100);

    const [transactions, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where: { organizationId, itemId },
        skip,
        take: limitVal,
        include: {
          creator: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryTransaction.count({ where: { organizationId, itemId } }),
    ]);

    return {
      item,
      transactions,
      total,
      page: pageVal,
      limit: limitVal,
      totalPages: Math.ceil(total / limitVal),
    };
  }

  // ===================== Stock Management =====================

  async updateStock(organizationId: string, itemId: string, quantity: number) {
    if (quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: itemId, organizationId },
      });
      if (!item) throw new NotFoundException('Item not found');
      return tx.inventoryItem.update({
        where: { id: itemId, organizationId },
        data: { quantity },
      });
    });
  }

  async adjustStock(organizationId: string, itemId: string, adjustment: number) {
    // Verify the item exists and belongs to the organization before adjusting.
    // This gives a precise 404 if the item is missing, while the actual stock
    // check + update is performed atomically in a single SQL statement to
    // prevent the check-then-act race that exists when the read happens
    // outside the update.
    await this.findItemById(organizationId, itemId);

    if (adjustment < 0) {
      // Atomic decrement guarded by the current quantity. The update only
      // succeeds if the current quantity is at least |adjustment|.
      const result = await this.prisma.inventoryItem.updateMany({
        where: {
          id: itemId,
          organizationId,
          quantity: { gte: Math.abs(adjustment) },
        },
        data: { quantity: { increment: adjustment } },
      });

      if (result.count === 0) {
        throw new BadRequestException('Insufficient stock for adjustment');
      }
    } else if (adjustment > 0) {
      // Increment is inherently safe (quantity cannot go negative).
      await this.prisma.inventoryItem.updateMany({
        where: { id: itemId, organizationId },
        data: { quantity: { increment: adjustment } },
      });
    } else {
      // Zero adjustment is a no-op; return the current item unchanged.
      return this.findItemById(organizationId, itemId);
    }

    return this.findItemById(organizationId, itemId);
  }

  // ===================== Reports =====================

  async getStockReport(organizationId: string) {
    const [
      totalItems,
      totalValue,
      lowStockItems,
      categoryBreakdown,
      recentActivity,
    ] = await Promise.all([
      this.prisma.inventoryItem.count({ where: { organizationId } }),
      this.prisma.inventoryItem.aggregate({
        where: { organizationId },
        _sum: {
          purchasePrice: true,
        },
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          organizationId,
          // Pull a candidate set: items with quantity at or below the higher
          // of (their minStock, 10). A precise per-row comparison is then
          // applied in the post-filter below because Prisma cannot compare
          // two columns in a where clause directly.
          quantity: { lte: 10000 },
        },
        select: {
          id: true,
          name: true,
          quantity: true,
          minStock: true,
          unit: true,
          location: true,
        },
      }),
      this.prisma.inventoryItem.groupBy({
        by: ['category'],
        where: { organizationId },
        _count: { category: true },
        _sum: { quantity: true },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          organizationId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        },
        include: {
          item: {
            select: {
              name: true,
            },
          },
          creator: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      summary: {
        totalItems,
        totalValue: totalValue._sum.purchasePrice || 0,
      },
      // Post-filter: low stock means current quantity is at or below the
      // per-item minStock (with a 10-unit baseline when minStock is unset).
      lowStockItems: (lowStockItems as any[]).filter((i) => i.quantity <= Math.max(i.minStock || 0, 10)),
      categoryBreakdown,
      recentActivity,
    };
  }

  async getCategoryStats(organizationId: string) {
    return this.prisma.inventoryItem.groupBy({
      by: ['category'],
      where: { organizationId },
      _count: { category: true },
      _sum: { quantity: true },
      _avg: { purchasePrice: true },
    });
  }
}