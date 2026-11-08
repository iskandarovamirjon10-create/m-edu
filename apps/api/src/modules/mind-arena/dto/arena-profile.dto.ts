import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class SelectAvatarDto {
  @ApiProperty({ description: 'ID of the avatar to set as active' })
  @IsNotEmpty()
  @IsUUID()
  avatarId!: string;
}

export class SelectTitleDto {
  @ApiProperty({ description: 'ID of the title to set as active' })
  @IsNotEmpty()
  @IsUUID()
  titleId!: string;
}

export class ArenaLeaderboardQueryDto {
  @ApiPropertyOptional({ description: 'Number of leaderboard entries to return (1-100)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
