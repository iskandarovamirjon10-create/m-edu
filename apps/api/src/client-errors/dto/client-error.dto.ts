import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Browser runtime error payload reported by the web app's error reporter
 * (apps/web/src/lib/errorReporter.ts). Deliberately tiny: message + stack +
 */
export class ClientErrorDto {
  @ApiProperty({ description: 'Error message (truncated to 500 chars)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @ApiPropertyOptional({ description: 'Stack trace (truncated to 4000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string;

  @ApiPropertyOptional({ description: 'App route where the error occurred' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  route?: string;

  @ApiPropertyOptional({ description: 'Capturing boundary' })
  @IsOptional()
  @IsIn(['window', 'promise', 'boundary', 'sw'])
  source?: 'window' | 'promise' | 'boundary' | 'sw';

  @ApiPropertyOptional({ description: 'Frontend build identifier (VITE_APP_RELEASE)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  release?: string;
}
