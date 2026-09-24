import { IsString, IsBoolean, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateNotificationPreferenceDto {
  @IsBoolean() @IsOptional() emailEnabled?: boolean;
  @IsBoolean() @IsOptional() smsEnabled?: boolean;
  @IsBoolean() @IsOptional() pushEnabled?: boolean;
  @IsBoolean() @IsOptional() inAppEnabled?: boolean;
}

export class BulkPreferenceItemDto {
  @IsString() category!: string;
  @IsBoolean() @IsOptional() emailEnabled?: boolean;
  @IsBoolean() @IsOptional() smsEnabled?: boolean;
  @IsBoolean() @IsOptional() pushEnabled?: boolean;
  @IsBoolean() @IsOptional() inAppEnabled?: boolean;
}

export class BulkUpdateNotificationPreferenceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPreferenceItemDto)
  preferences: BulkPreferenceItemDto[];
}
