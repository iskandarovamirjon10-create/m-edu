import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ZReportQueryDto {
  @ApiPropertyOptional({ description: 'Boshlanish sanasi (ISO 8601)', example: '2026-10-26T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Tugash sanasi (ISO 8601)', example: '2026-10-26T23:59:59.999Z' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class CloseCashierShiftDto {
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

  @ApiPropertyOptional({ description: 'Kassir izohi yoki kamomad/ortiqcha sababi', example: 'Kunlik kassa to‘liq mos keldi' })
  @IsOptional()
  @IsString()
  closingNotes?: string;
}
