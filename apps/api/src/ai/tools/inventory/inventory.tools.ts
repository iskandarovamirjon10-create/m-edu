import { z } from 'zod';
import {
  AiPermission,
  AiToolRiskLevel,
  type AiToolDefinition,
} from '@medu/contracts';
import type { InventoryService } from '../../../inventory/inventory.service';

export function createInventoryTools(inventory: InventoryService): AiToolDefinition[] {
  return [
    {
      name: 'inventory.overview',
      description:
        "Ombordagi tovarlar, o'quv qo'llanmalari, kantselyariya va qoldiqlar hisoboti, tugayotgan tovarlar xabarnomasi.",
      inputSchema: z.object({}),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.INVENTORY_READ,
      execute: async (_input, context) => {
        const report = await inventory.getStockReport(context.organizationId);

        return {
          totalItems: report.summary.totalItems,
          totalValuationUzs: Number(report.summary.totalValue || 0),
          lowStockAlertsCount: report.lowStockItems.length,
          lowStockItems: report.lowStockItems.map((item: any) => ({
            id: item.id,
            name: item.name,
            currentQuantity: item.quantity,
            minQuantity: item.minStock,
            unit: item.unit,
            location: item.location || 'Asosiy ombor',
          })),
        };
      },
    },
    {
      name: 'inventory.search',
      description:
        "Ombordan tovar yoki materialni nomi bo'yicha qidirish.",
      inputSchema: z.object({
        search: z.string().max(100).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: AiPermission.INVENTORY_READ,
      execute: async (input: { search?: string; limit?: number }, context) => {
        const result = await inventory.findAllItems(context.organizationId, {
          search: input.search,
          limit: String(input.limit ?? 10),
        });

        return {
          total: result.total,
          items: result.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            category: String(item.category),
            quantity: item.quantity,
            unit: item.unit,
            sellingPrice: item.sellingPrice ? Number(item.sellingPrice) : null,
          })),
        };
      },
    },
  ];
}
