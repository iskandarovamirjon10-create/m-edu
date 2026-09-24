import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Body for resolving a security alert (SF-4 — was an inline object type). */
export class ResolveSecurityAlertDto {
  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class SecurityAlertQueryDto {
  @IsOptional() @IsString()
  severity?: string;

  @IsOptional() @IsString()
  type?: string;

  @IsOptional() @IsString()
  resolved?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  skip?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  take?: number;
}
