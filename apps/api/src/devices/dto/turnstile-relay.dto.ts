import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RelayProtocol, TurnstileEmergencyMode } from '../turnstile-relay.interface';

export const RELAY_PROTOCOLS: readonly RelayProtocol[] = [
  'HTTP_PULSE',
  'TCP_SOCKET',
  'IPC_SOCKET',
  'MQTT',
  'MOCK',
];

export const EMERGENCY_MODES: readonly TurnstileEmergencyMode[] = [
  'NORMAL',
  'EVACUATION',
  'LOCKDOWN',
];

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsIn(RELAY_PROTOCOLS as unknown as string[])
  protocol!: RelayProtocol;

  @IsOptional()
  @IsString()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_tld: false, // Allows intranet edge names / local DNS
      require_protocol: true,
    },
    { message: 'endpointUrl must be a valid http: or https: URL' },
  )
  endpointUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ipcPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  authToken?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  defaultPulseMs?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ManualOpenDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  durationMs?: number;

  @IsOptional()
  @IsString()
  @IsIn(['IN', 'OUT'])
  direction?: 'IN' | 'OUT';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class EmergencyModeDto {
  @IsString()
  @IsIn(EMERGENCY_MODES as unknown as string[])
  mode!: TurnstileEmergencyMode;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
