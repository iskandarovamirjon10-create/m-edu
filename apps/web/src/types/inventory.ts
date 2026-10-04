/**
 * Inventory, supplies, and asset tracking domain models.
 */

export type InventoryCategory =
  | 'BOOKS'
  | 'EQUIPMENT'
  | 'FURNITURE'
  | 'SUPPLIES'
  | 'ELECTRONICS'
  | 'OTHER';

export type TransactionType =
  | 'PURCHASE'
  | 'ISSUE'
  | 'RETURN'
  | 'DAMAGE'
  | 'DISPOSAL';

export interface InventoryItem {
  id: string;
  organizationId: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  minStock?: number;
  location?: string;
  supplier?: string;
  purchasePrice?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  organizationId: string;
  itemId: string;
  type: TransactionType;
  quantity: number;
  pricePerUnit?: number;
  totalPrice?: number;
  performedBy?: string;
  notes?: string;
  item?: InventoryItem;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  totalValue: number;
  recentTransactions: number;
}
