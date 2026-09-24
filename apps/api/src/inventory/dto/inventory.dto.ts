import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryItemDto {
  @IsString()
  name: string;

  // NOTE: must mirror the Prisma `InventoryCategory` enum
  @IsEnum(['BOOKS', 'EQUIPMENT', 'FURNITURE', 'SUPPLIES', 'ELECTRONICS'])
  category: 'BOOKS' | 'EQUIPMENT' | 'FURNITURE' | 'SUPPLIES' | 'ELECTRONICS';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity?: number = 0;

  @IsString()
  unit: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['BOOKS', 'EQUIPMENT', 'FURNITURE', 'SUPPLIES', 'ELECTRONICS'])
  category?: 'BOOKS' | 'EQUIPMENT' | 'FURNITURE' | 'SUPPLIES' | 'ELECTRONICS';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateTransactionDto {
  @IsUUID()
  itemId: string;

  @IsEnum(['PURCHASE', 'ISSUE', 'RETURN', 'DAMAGE', 'DISPOSAL'])
  type: 'PURCHASE' | 'ISSUE' | 'RETURN' | 'DAMAGE' | 'DISPOSAL';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  // Optional: the controller always overrides this with the authenticated user id
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}

export class StockAdjustmentDto {
  @Type(() => Number)
  @IsNumber()
  adjustment: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;
}