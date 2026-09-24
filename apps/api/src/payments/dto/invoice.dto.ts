import {
  IsUUID,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsIn,
  IsDateString,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @IsString()
  description: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateInvoiceDto {
  @IsUUID()
  studentId: string;

  /** Organization-unique invoice number, e.g. INV-2026-000123. */
  @IsString()
  number: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  penalty?: number;

  @IsOptional()
  @IsIn(['UZS', 'USD', 'EUR', 'RUB'])
  currency?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddInvoiceItemDto {
  @IsString()
  description: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class RecordPaymentDto {
  @IsUUID()
  invoiceId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsIn(['CASH', 'CARD', 'BANK_TRANSFER', 'PAYME', 'CLICK', 'UZUM', 'OTHER'])
  method?: string;

  /** Idempotency reference (e.g. provider transaction id). */
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateRefundDto {
  @IsUUID()
  paymentId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;

  /** Gateway refund reference for idempotent retries. */
  @IsOptional()
  @IsString()
  externalId?: string;
}
