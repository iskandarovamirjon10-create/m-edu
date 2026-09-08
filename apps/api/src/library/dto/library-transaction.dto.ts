import { IsUUID, IsDateString, IsOptional, IsString, IsIn } from 'class-validator';

export class BorrowBookDto {
  @IsUUID()
  bookId: string;

  @IsUUID()
  studentId: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReturnBookDto {
  @IsOptional()
  @IsString()
  @IsIn(['good', 'damaged', 'lost'])
  condition?: 'good' | 'damaged' | 'lost';

  @IsOptional()
  @IsString()
  notes?: string;
}