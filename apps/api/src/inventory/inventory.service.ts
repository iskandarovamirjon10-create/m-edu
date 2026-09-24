import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto, UpdateInventoryItemDto, CreateTransactionDto } from './dto/inventory.dto';
import { PaginationParams } from '../common/dto/pagination';
import { parsePagination } from '../lib/pagination';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ===================== Inventory Items =====================

  async findAllItems(organizationId: string, params: PaginationParams) {
    const rawParams = params as Record<string, unknown>;
    const search = typeof rawParams.search === 'string' ? rawParams.search : undefined;
    const category = typeof rawParams.category === 'string' ? rawParams.category as Prisma.EnumInventoryCategoryFilter['equals'] : undefined;
    const status = typeof rawParams.status === 'string' ? rawParams.status as Prisma.EnumAssetStatusFilter['equals'] : undefined;
    const { skip, limit: limitVal } = parsePagination(params);
    const pageVal = Math.max(1, parseInt(String(params?.page ?? ''), 10) || 1);

    const where: Prisma.InventoryItemWhereInput = { organizationId };

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
      where: { id },
      data: dto,
    });
  }

  async deleteItem(organizationId: string, id: string) {
    await this.findItemById(organizationId, id);

    // Check if item has active transactions
    const transactionCount = await this.prisma.inventoryTransaction.count({
      where: { itemId: id },
    });

    if (transactionCount > 0) {
      throw new BadRequestException('Cannot delete item with existing transactions');
    }

    return this.prisma.inventoryItem.delete({
      where: { id },
    });
  }

  // ===================== Transactions =====================

  async createTransaction(organizationId: string, dto: CreateTransactionDto, userId: string) {
    const { itemId, type, quantity, notes } = dto;
    const createdBy = userId;

    if (quantity <= 0) {
      throw new BadRequestException('Transaction quantity must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: itemId, organizationId },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      // Outbound stock movements: ISSUE, DISPOSAL, and DAMAGE all leave
      // available inventory (damaged goods are no longer usable stock).
      if (type === 'ISSUE' || type === 'DISPOSAL' || type === 'DAMAGE') {
        if (quantity > item.quantity) {
          throw new BadRequestException(`Insufficient stock. Available: ${item.quantity}`);
        }

        const result = await tx.inventoryItem.updateMany({
          where: {
            id: itemId,
            organizationId,
            quantity: { gte: quantity },
          },
          data: { quantity: { decrement: quantity } },
        });

        if (result.count === 0) {
          throw new BadRequestException('Insufficient stock or item not accessible');
        }
      } else {
        await tx.inventoryItem.updateMany({
          where: { id: itemId, organizationId },
          data: { quantity: { increment: quantity } },
        });
      }

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
        where: { id: itemId },
        data: { quantity },
      });
    });
  }

  async adjustStock(organizationId: string, itemId: string, adjustment: number) {
    await this.findItemById(organizationId, itemId);

    if (adjustment < 0) {
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
      await this.prisma.inventoryItem.updateMany({
        where: { id: itemId, organizationId },
        data: { quantity: { increment: adjustment } },
      });
    } else {
      return this.findItemById(organizationId, itemId);
    }

    return this.findItemById(organizationId, itemId);
  }

  // ===================== Reports =====================

  async getStockReport(organizationId: string) {
    const [
      totalItems,
      totalValue,
      lowStockCandidates,
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
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
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
      lowStockItems: lowStockCandidates.filter((i) => i.quantity <= Math.max(i.minStock || 0, 10)),
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