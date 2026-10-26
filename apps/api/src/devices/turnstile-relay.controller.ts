import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TurnstileRelayService } from './turnstile-relay.service';
import {
  PulseRelayOptions,
  PulseRelayResult,
  TurnstileDeviceConfig,
} from './turnstile-relay.interface';

export class ManualOpenDto {
  deviceId?: string;
  durationMs?: number;
  direction?: 'IN' | 'OUT';
  reason?: string;
}

export class RegisterDeviceDto {
  id!: string;
  name!: string;
  protocol!: 'HTTP_PULSE' | 'TCP_SOCKET' | 'MQTT' | 'MOCK';
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
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  listDevices(@CurrentUser('organizationId') orgId: string): TurnstileDeviceConfig[] {
    return this.relayService.listDevices(orgId);
  }

  @Post('open')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
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
      defaultPulseMs: dto.defaultPulseMs ?? 1000,
      enabled: dto.enabled !== false,
    };

    this.relayService.registerDevice(config);
    return { success: true, device: config };
  }
}
