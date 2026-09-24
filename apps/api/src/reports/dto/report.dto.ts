import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ReportDimension, RunReportParams } from '../report-builder.service';

/**
 * Report Builder request DTOs (SF-4).
 *
 * `RunReportParams` was an interface, so `@Body() params: RunReportParams`
 * silently skipped validation. The DTO `implements` the interface so the
 * service contract is unchanged while the HTTP boundary is now enforced.
 *
 * Keep REPORT_DIMENSIONS in sync with `ReportDimension` in
 * report-builder.service.ts.
 */
export const REPORT_DIMENSIONS = [
  'STUDENTS',
  'TEACHERS',
  'GROUPS',
  'ATTENDANCE',
  'PAYMENTS',
  'INVOICES',
  'EXPENSES',
  'PAYROLL',
  'LEADS',
  'FOLLOWUPS',
  'NOTIFICATIONS',
  'FINANCE',
] as const satisfies readonly ReportDimension[];

export class RunReportParamsDto implements RunReportParams {
  @IsIn(REPORT_DIMENSIONS)
  type: ReportDimension;

  @IsOptional() @IsString()
  dateFrom?: string;

  @IsOptional() @IsString()
  dateTo?: string;

  @IsOptional() @IsString() @MaxLength(100)
  status?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  columns?: string[];

  @IsOptional() @IsString() @MaxLength(100)
  sortField?: string;

  @IsOptional() @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional() @IsString() @MaxLength(100)
  groupBy?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  pageSize?: number;
}

export class SaveReportDefinitionDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsIn(REPORT_DIMENSIONS)
  type: ReportDimension;

  @ValidateNested()
  @Type(() => RunReportParamsDto)
  parameters: RunReportParamsDto;

  @IsOptional() @IsString() @MaxLength(100)
  schedule?: string;
}

export class ExportReportDto {
  @ValidateNested()
  @Type(() => RunReportParamsDto)
  params: RunReportParamsDto;

  @IsOptional() @IsIn(['csv', 'xlsx', 'pdf'])
  format?: 'csv' | 'xlsx' | 'pdf';
}
