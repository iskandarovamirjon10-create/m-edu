import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ZReportQueryDto {
  @ApiPropertyOptional({ description: 'Boshlanish sanasi (ISO 8601)', example: '2026-10-26T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Tugash sanasi (ISO 8601)', example: '2026-10-26T23:59:59.999Z' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filial ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Kassir ID' })
  @IsOptional()
  @IsUUID()
  cashierId?: string;
}

export class OpenCashShiftDto {
  @ApiPropertyOptional({ description: 'Smena ochilishidagi naqd pul qoldig‘i (tortmadagi boshlang‘ich pul)', example: 500000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Boshlang‘ich qoldiq manfiy bo‘lishi mumkin emas' })
  openingBalance?: number;

  @ApiPropertyOptional({ description: 'Filial ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Smena ochilishi haqida eslatma / izoh', example: 'Ertalabki smena boshlandi' })
  @IsOptional()
  @IsString()
  openingNote?: string;
}

export class CloseCashierShiftDto {
  @ApiPropertyOptional({ description: 'Yopilishi kerak bo‘lgan kassa smenasi ID' })
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional({ description: 'Smena boshlanish sanasi (ISO 8601)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Smena tugash sanasi (ISO 8601)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ description: 'Kassada sanalgan haqiqiy naqd pul summasi', example: 4500000 })
  @IsNumber()
  @Min(0, { message: 'Kassadagi naqd pul manfiy bo‘lishi mumkin emas' })
  actualCashCounted!: number;

  @ApiPropertyOptional({ description: 'Kassadan topshirilayotgan summa (inkassatsiya yoki bosh kassaga)', example: 4000000 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Topshiriladigan summa manfiy bo‘lishi mumkin emas' })
  handoverAmount?: number;

  @ApiPropertyOptional({ description: 'Kassir izohi yoki kamomad/ortiqcha sababi', example: 'Kunlik kassa to‘liq mos keldi' })
  @IsOptional()
  @IsString()
  closingNotes?: string;
}

export class CashShiftQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSED'], description: 'Smena holati' })
  @IsOptional()
  @IsEnum(['OPEN', 'CLOSED'])
  status?: 'OPEN' | 'CLOSED';

  @ApiPropertyOptional({ description: 'Kassir ID' })
  @IsOptional()
  @IsUUID()
  cashierId?: string;

  @ApiPropertyOptional({ description: 'Filial ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Natijalar soni', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Sahifa raqami', default: 1 })
  @IsOptional()
  page?: number;
}
