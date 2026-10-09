import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { SecureLogger } from '@medu/face-security';
import type { Request } from 'express';

import { AttendanceDecisionEngine } from './attendance-decision.engine';
import { TerminalAuthGuard } from './terminal-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AllowPublic } from '../auth/public.decorator';
import { RequireApiKeyScopes } from '../api-keys/api-keys.guard';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Body contract for the PUBLIC terminal webhook (body-validated). */
export class TerminalEventDto {
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  deviceId: string;

  @IsString()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

/** Postgres `uuid` literal — rejects malformed ids before they reach Prisma. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PUSH-Model Architecture for Standalone Face ID Terminals (e.g. Hikvision MinMoe, ZKTeco).
 *
 * Instead of streaming video (PULL) and running heavy AI on our servers,
 * this controller allows dedicated smart terminals to PUSH successful face
 * recognitions directly to our system.
 *
 * AUTHENTICATION (fail-closed)
 * ----------------------------
 * Every request must carry `x-terminal-token: <raw API key>`.
 *
 * The terminal endpoint is deliberately exempt from user-JWT authentication
 * (`@AllowPublic()`), because hardware has no user session — but that exemption
 * only skips `GlobalAuthGuard`. The token itself is verified by
 * `TerminalAuthGuard` → `ApiKeyGuard`: bcrypt-hashed at rest, revocable,
 * expirable, usage-counted, and required to hold the `attendance:write` scope.
 *
 * A missing token → 401. An unknown / revoked / expired / wrong-scope key →
 * 401 or 403. Nothing in this handler runs unauthenticated.
 *
 * TENANT ISOLATION
 * ----------------
 * `organizationId` is taken from the **API key**, never from the payload.
 * The camera lookup is therefore `id AND organizationId`, so a key minted for
 * organization A can neither read nor write organization B's attendance —
 * probing an out-of-tenant camera id returns the same 401 as a garbage id, so
 * cross-tenant camera ids cannot be enumerated.
 *
 * Provisioning: create an API key scoped `attendance:write` in Settings → API
 * Keys and paste the plaintext value into the terminal's webhook secret field.
 */
@ApiTags('hardware-terminals')
@AllowPublic()
@UseGuards(TerminalAuthGuard)
@Controller('webhooks/terminal')
export class TerminalWebhookController {
  private readonly logger = new SecureLogger('info');

  constructor(
    private readonly attendanceEngine: AttendanceDecisionEngine,
    private readonly prisma: PrismaService,
  ) {}

  @Post('event')
  @HttpCode(HttpStatus.OK)
  @RequireApiKeyScopes('attendance:write')
  @ApiOperation({
    summary: 'Receive Face Recognition Event from Standalone Terminal',
    description:
      'Hardware terminals send an HTTP POST here when they recognize a face locally. ' +
      'Authenticate with `x-terminal-token: <API key>`; the key must hold the ' +
      '`attendance:write` scope and belongs to exactly one organization.',
  })
  @ApiHeader({
    name: 'x-terminal-token',
    description:
      'Raw API key issued in Settings → API Keys with the `attendance:write` scope',
  })
  @ApiResponse({ status: 200, description: 'Event processed' })
  @ApiResponse({ status: 401, description: 'Missing, unknown, revoked or expired terminal token' })
  @ApiResponse({ status: 403, description: 'Terminal token lacks the `attendance:write` scope' })
  async handleTerminalEvent(
    @Req() req: Request & { user?: { organizationId?: string } },
    @Body() payload: TerminalEventDto,
  ) {
    // Bound to the API key by ApiKeyGuard; absent only if the guard was bypassed.
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException('Terminal token is missing');
    }

    // 1. Resolve the terminal to a camera **inside the token's organization**.
    const deviceId = typeof payload?.deviceId === 'string' ? payload.deviceId.trim() : '';
    if (!UUID_PATTERN.test(deviceId)) {
      // Malformed ids are indistinguishable from unknown ids on purpose: no
      // 500 from Prisma's uuid validation, no cross-tenant oracle.
      this.logger.warn('Received webhook with malformed terminal deviceId', {
        organizationId,
      });
      throw new UnauthorizedException('Invalid terminal identity');
    }

    const camera = await this.prisma.camera.findFirst({
      where: {
        id: deviceId,
        organizationId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!camera) {
      this.logger.warn('Received webhook from unknown terminal', { deviceId });
      throw new UnauthorizedException('Invalid terminal identity');
    }

    // 2. Normalize Timestamp
    const recognizedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
    if (Number.isNaN(recognizedAt.getTime())) {
      throw new BadRequestException('Invalid timestamp');
    }

    // 3. Process Attendance using our Core Engine (same as Video Stream Engine)
    // This perfectly unifies both architectures!
    try {
      await this.attendanceEngine.processRecognition({
        organizationId: camera.organizationId,
        cameraId: camera.id,
        studentId: payload.userId,
        recognizedAt,
        confidence: payload.confidence ?? 0.99, // Terminals usually only send "sure" matches
      });

      this.logger.info('Hardware terminal event processed successfully', {
        cameraId: camera.id,
        studentId: payload.userId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to process terminal event', { error: String(error) });
      // Return 200 anyway so the terminal doesn't keep retrying and DDOS us
      return { success: false, error: 'Internal processing error' };
    }
  }
}
