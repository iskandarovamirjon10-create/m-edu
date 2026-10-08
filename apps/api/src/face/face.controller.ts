import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Delete,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Throttle } from '@nestjs/throttler';

import type { Request } from 'express';

import { Permissions } from '@medu/contracts';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type {
  RequestUser,
  TenantContext,
} from '../auth/types';

import {
  FaceAuditQueryDto,
} from './dto/audit.dto';

import {
  FacePermissions,
} from './auth/face-permissions.decorator';

import {
  FacePermissionsGuard,
} from './auth/face-permissions.guard';

import { FaceService } from './face.service';

import {
  TenantInterceptor,
} from './interceptors/tenant.interceptor';

import {
  CreateEnrollmentDto,
  EnrollmentQueryDto,
  ReenrollEnrollmentDto,
  RevokeEnrollmentDto,
} from './dto/enrollment.dto';

import {
  CreateSessionDto,
  FinishSessionDto,
  RecognitionHistoryQueryDto,
  SubmitAttemptDto,
} from './dto/recognition.dto';

import {
  DeviceQueryDto,
  RegisterDeviceDto,
} from './dto/device.dto';

type FaceRequest = Request & {
  user: RequestUser;
  tenantContext: TenantContext;
};

const UUID_PIPE = new ParseUUIDPipe({
  version: '4',
});

@ApiTags('face')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  FacePermissionsGuard,
)
@UseInterceptors(TenantInterceptor)
@Controller('face')
@Throttle({
  default: {
    limit: 30,
    ttl: 60_000,
  },
})
export class FaceController {
  constructor(
    private readonly faceService: FaceService,
  ) {}

  // ---------------------------------------------------------------------------
  // ENROLLMENTS
  // ---------------------------------------------------------------------------

  @Post('enrollments')
  @FacePermissions(Permissions.FACE_ENROLL)
  @ApiOperation({
    summary: 'Start a new face enrollment for a student',
  })
  startEnrollment(
    @Req() req: FaceRequest,
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.faceService.startEnrollment(
      req.tenantContext,
      dto.studentId,
    );
  }

  @Get('enrollments')
  @FacePermissions(Permissions.FACE_VIEW)
  @ApiOperation({
    summary: 'List all enrollments',
  })
  listEnrollments(
    @Req() req: FaceRequest,
    @Query() query: EnrollmentQueryDto,
  ) {
    return this.faceService.listEnrollments(
      req.tenantContext,
      query,
    );
  }

  @Get('enrollments/:id')
  @FacePermissions(Permissions.FACE_VIEW)
  @ApiOperation({
    summary: 'Get enrollment details',
  })
  getEnrollment(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.faceService.getEnrollment(
      req.tenantContext,
      id,
    );
  }

  @Post('enrollments/:id/capture')
  @FacePermissions(Permissions.FACE_ENROLL)
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @ApiOperation({
    summary:
      'Process a face capture for enrollment ' +
      '(detect → quality → liveness → embed → activate)',
  })
  processCapture(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.faceService.processEnrollmentCapture(
      req.tenantContext,
      id,
      dto.imageBase64,
    );
  }

  @Post('enrollments/:id/reenroll')
  @FacePermissions(Permissions.FACE_REENROLL)
  @ApiOperation({
    summary: 'Re-enroll a student',
  })
  reenroll(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: ReenrollEnrollmentDto,
  ) {
    return this.faceService.reenrollStudent(
      req.tenantContext,
      id,
      dto.reason,
    );
  }

  @Delete('enrollments/:id/pending')
  @FacePermissions(Permissions.FACE_ENROLL)
  @ApiOperation({
    summary: 'Cancel a pending enrollment',
  })
  cancelPendingEnrollment(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.faceService.cancelPendingEnrollment(
      req.tenantContext,
      id,
    );
  }

  @Post('enrollments/:id/revoke')
  @FacePermissions(Permissions.FACE_REVOKE)
  @ApiOperation({
    summary: 'Revoke an enrollment',
  })
  revokeEnrollment(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: RevokeEnrollmentDto,
  ) {
    return this.faceService.revokeEnrollment(
      req.tenantContext,
      id,
      dto.reason,
    );
  }

  // ---------------------------------------------------------------------------
  // RECOGNITION SESSIONS
  // ---------------------------------------------------------------------------

  @Post('sessions')
  @FacePermissions(Permissions.FACE_RECOGNIZE)
  @ApiOperation({
    summary: 'Start a recognition session',
  })
  startSession(
    @Req() req: FaceRequest,
    @Body() dto: CreateSessionDto,
  ) {
    return this.faceService.startSession(
      req.tenantContext,
      dto,
    );
  }

  @Post('sessions/:id/attempts')
  @FacePermissions(Permissions.FACE_RECOGNIZE)
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @ApiOperation({
    summary:
      'Submit a recognition attempt ' +
      '(detect → quality → liveness → embed → match → decide)',
  })
  submitAttempt(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.faceService.processAttempt(
      req.tenantContext,
      id,
      dto.imageBase64,
      dto.clientAttemptId,
    );
  }

  @Post('sessions/:id/finish')
  @FacePermissions(Permissions.FACE_RECOGNIZE)
  @ApiOperation({
    summary: 'Finish a recognition session',
  })
  finishSession(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
    @Body() dto: FinishSessionDto,
  ) {
    return this.faceService.finishSession(
      req.tenantContext,
      id,
      dto.reason,
    );
  }

  @Get('sessions/:id/attempts')
  @FacePermissions(Permissions.FACE_VIEW)
  @ApiOperation({
    summary: 'Get attempts for a session',
  })
  getSessionAttempts(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.faceService.getSessionAttempts(
      req.tenantContext,
      id,
    );
  }

  @Get('recognition-history')
  @FacePermissions(Permissions.FACE_VIEW)
  @ApiOperation({
    summary: 'Get recognition history',
  })
  getRecognitionHistory(
    @Req() req: FaceRequest,
    @Query() query: RecognitionHistoryQueryDto,
  ) {
    return this.faceService.getRecognitionHistory(
      req.tenantContext,
      query,
    );
  }

  // ---------------------------------------------------------------------------
  // DEVICES
  // ---------------------------------------------------------------------------

  @Post('devices')
  @FacePermissions(Permissions.FACE_DEVICE_MANAGE)
  @ApiOperation({
    summary: 'Register a new recognition device',
  })
  registerDevice(
    @Req() req: FaceRequest,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.faceService.registerDevice(
      req.tenantContext,
      dto,
    );
  }

  @Get('devices')
  @FacePermissions(Permissions.FACE_DEVICE_MANAGE)
  @ApiOperation({
    summary: 'List recognition devices',
  })
  listDevices(
    @Req() req: FaceRequest,
    @Query() query: DeviceQueryDto,
  ) {
    return this.faceService.listDevices(
      req.tenantContext,
      query,
    );
  }

  @Get('devices/:id')
  @FacePermissions(Permissions.FACE_DEVICE_MANAGE)
  @ApiOperation({
    summary: 'Get device details',
  })
  getDevice(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.faceService.getDevice(
      req.tenantContext,
      id,
    );
  }

  @Post('devices/:id/revoke')
  @FacePermissions(Permissions.FACE_DEVICE_MANAGE)
  @ApiOperation({
    summary: 'Revoke a device',
  })
  revokeDevice(
    @Req() req: FaceRequest,
    @Param('id', UUID_PIPE) id: string,
  ) {
    return this.faceService.revokeDevice(
      req.tenantContext,
      id,
    );
  }

  // ---------------------------------------------------------------------------
  // AUDIT / ANALYTICS
  // ---------------------------------------------------------------------------

  @Get('audit-log')
  @FacePermissions(Permissions.FACE_AUDIT_VIEW)
  @ApiOperation({
    summary: 'Get face recognition audit log',
  })
  getAuditLog(
    @Req() req: FaceRequest,
    @Query() query: FaceAuditQueryDto,
  ) {
    return this.faceService.getAuditLog(
      req.tenantContext,
      query,
    );
  }

  @Get('analytics')
  @FacePermissions(Permissions.FACE_ANALYTICS_VIEW)
  @ApiOperation({
    summary: 'Get face recognition analytics',
  })
  getAnalytics(
    @Req() req: FaceRequest,
  ) {
    return this.faceService.getAnalytics(
      req.tenantContext,
    );
  }

  // ---------------------------------------------------------------------------
  // ENGINE STATUS
  // ---------------------------------------------------------------------------

  @Get('engine-status')
  @FacePermissions(Permissions.FACE_VIEW)
  @ApiOperation({
    summary: 'Get face engine provider status',
  })
  getEngineStatus() {
    /*
     * Deliberately does not receive tenantContext.
     *
     * This endpoint reports application-level face-engine provider
     * availability, not organization-specific biometric data.
     */
    return this.faceService.getEngineStatus();
  }
}
