import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TurnstileRelayService } from './turnstile-relay.service';
import {
  DeviceTestResult,
  EmergencyModeState,
  PulseRelayOptions,
  PulseRelayResult,
  TurnstileDeviceConfig,
  TurnstileEmergencyMode,
} from './turnstile-relay.interface';

export class ManualOpenDto {
  deviceId?: string;
  durationMs?: number;
  direction?: 'IN' | 'OUT';
  reason?: string;
}

export class EmergencyModeDto {
  mode!: TurnstileEmergencyMode;
  reason?: string;
}

export class RegisterDeviceDto {
  id!: string;
  name!: string;
  protocol!: 'HTTP_PULSE' | 'TCP_SOCKET' | 'IPC_SOCKET' | 'MQTT' | 'MOCK';
  ipcPath?: string;
  endpointUrl?: string;
  authToken?: string;
  defaultPulseMs?: number;
  enabled?: boolean;
}

@Controller('devices/turnstile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TurnstileRelayController {
  constructor(private readonly relayService: TurnstileRelayService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'STAFF')
  listDevices(@CurrentUser('organizationId') orgId: string): TurnstileDeviceConfig[] {
    return this.relayService.listDevices(orgId);
  }

  @Get('emergency')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'STAFF', 'TEACHER')
  getEmergencyMode(@CurrentUser('organizationId') orgId: string): EmergencyModeState {
    return this.relayService.getEmergencyMode(orgId);
  }

  @Post('emergency')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  async setEmergencyMode(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: EmergencyModeDto,
  ): Promise<EmergencyModeState> {
    return this.relayService.setEmergencyMode(orgId, dto.mode, dto.reason, userId);
  }

  @Post(':id/test')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  async testDevice(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ): Promise<DeviceTestResult> {
    return this.relayService.testDevice(id, orgId);
  }

  @Post('open')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'STAFF')
  async openGate(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ManualOpenDto,
  ): Promise<PulseRelayResult> {
    const options: PulseRelayOptions = {
      organizationId: orgId,
      deviceId: dto.deviceId,
      direction: dto.direction ?? 'IN',
      pulseMs: dto.durationMs ?? 1000,
      reason: dto.reason || `Manual release by user ${userId}`,
    };

    return this.relayService.triggerPulse(options);
  }

  @Post('register')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  registerDevice(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: RegisterDeviceDto,
  ): { success: boolean; device: TurnstileDeviceConfig } {
    const config: TurnstileDeviceConfig = {
      id: dto.id,
      name: dto.name,
      organizationId: orgId,
      protocol: dto.protocol,
      endpointUrl: dto.endpointUrl,
      authToken: dto.authToken,
      ipcPath: dto.ipcPath,
      defaultPulseMs: dto.defaultPulseMs ?? 1000,
      enabled: dto.enabled !== false,
    };

    this.relayService.registerDevice(config);
    return { success: true, device: config };
  }
}
