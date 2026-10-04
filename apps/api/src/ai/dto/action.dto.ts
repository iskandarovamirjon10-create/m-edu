import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
