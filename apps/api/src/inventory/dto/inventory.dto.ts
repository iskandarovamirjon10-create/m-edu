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

  // NOTE: must mirror the Prisma `InventoryCategory` enum — there is no
  // OTHER value in the database, so accepting it here would fail at insert.
  @IsEnum(['BOOKS', 'EQUIPMENT', 'FURNITURE', 'SUPPLIES', 'ELECTRONICS'])
  category: 'BOOKS' | 'EQUIPMENT' | 'FURNITURE' | 'SUPPLIES' | 'ELECTRONICS';

  @Type(() => Number)
  @IsInt()
  quantity?: number = 0;

  @IsString()
  unit: string;

  @Type(() => Number)
  @IsInt()
  minStock?: number = 0;

  @Type(() => Number)
  @IsNumber()
  purchasePrice?: number;

  @Type(() => Number)
  @IsNumber()
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
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  purchasePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
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
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  // Optional: the controller always overrides this with the authenticated
  // user id (userId comes from auth, never from the client), so clients are
  // not required to send it.
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