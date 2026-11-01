import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ChildMovementNotificationDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsString()
  @IsIn(['IN', 'OUT'])
  direction!: 'IN' | 'OUT';

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  gateOrDeviceName!: string;

  @IsOptional()
  @IsString()
  @IsIn(['FACE_RECOGNITION', 'TURNSTILE_RFID', 'MANUAL'])
  verificationMethod?: 'FACE_RECOGNITION' | 'TURNSTILE_RFID' | 'MANUAL';

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class EmergencyParentBroadcastDto {
  @IsString()
  @IsIn(['HIGH', 'CRITICAL'])
  severity!: 'HIGH' | 'CRITICAL';

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsString()
  @IsIn(['CURRENTLY_PRESENT', 'ALL_ACTIVE_STUDENTS'])
  targetAudience!: 'CURRENTLY_PRESENT' | 'ALL_ACTIVE_STUDENTS';

  @IsOptional()
  @IsString()
  branchId?: string;
}
