import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SecureLogger } from '@medu/face-security';
import type { Request } from 'express';

import { Permissions } from '@medu/contracts';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { RequestUser } from '../auth/types';
import { PermissionsGuard } from '../auth/permissions.guard';

import { CameraEventQuery } from '../common/dto/query';

import { CameraService } from './camera.service';
import { CameraWorkerManagerService } from './camera-worker-manager.service';

import {
  CameraQueryApiDto,
  CreateCameraApiDto,
  DiscoverCamerasApiDto,
  TestCameraConnectionApiDto,
  UpdateCameraApiDto,
  UpdateCameraConfigDto,
} from './dto/camera.dto';

type AuthenticatedRequest =
  Request & {
    user: RequestUser;
  };

@ApiTags('cameras')
@ApiBearerAuth()
// PermissionsGuard (not RolesGuard): endpoints below are annotated with
// permission strings (e.g. Permissions.CAMERA_MANAGE = 'camera.manage').
// RolesGuard compares those against user.role and would 403 every role —
// effectively disabling the whole Cameras API. PermissionsGuard maps the
// role to its registered permission set (@medu/contracts RolePermissions).
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cameras')
export class CameraController {
  private readonly auditLogger = new SecureLogger('info');

  /**
   * Bring a running camera worker back in line with its stored configuration.
   *
   * `updateCamera` and `updateCameraConfig` only write the database, but
   * `CameraWorkerSession` captures its whole configuration once, at start:
   * stream URI, decrypted credentials, processing fps, similarity threshold and
   * the recognition/attendance flags. Without a resync a rotated camera
   * password, a moved stream path or a lowered threshold silently keeps using
   * the previous values until the API is restarted.
   *
   * Only an already-running worker is resynced. Starting one here would enable
   * recognition for a disabled camera and could exceed the worker caps, which
   * are enforced by `startWorker`.
   */
  private async resyncRunningWorker(
    organizationId: string,
    cameraId: string,
  ): Promise<void> {
    try {
      const status = await this.workerManager.getWorkerStatus(
        organizationId,
        cameraId,
      );

      if (!status.running) {
        return;
      }

      await this.workerManager.restartWorker(organizationId, cameraId);
    } catch (err: unknown) {
      // The camera change is already committed. A worker that cannot restart
      // must not turn a successful update into a 500 — `/worker-status` and the
      // camera alerting pipeline surface the failure to the operator.
      this.auditLogger.warn(
        'Camera worker resync failed after configuration update',
        {
          organizationId,
          cameraId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  constructor(
    private readonly cameraService: CameraService,
    private readonly workerManager: CameraWorkerManagerService,
  ) {}

  // ============================================================
  // CAMERA CRUD
  // ============================================================

  @Post()
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @ApiOperation({
    summary: 'Create a new camera',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Camera created successfully',
  })
  async createCamera(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCameraApiDto,
  ) {
    return this.cameraService.createCamera(
      req.user.organizationId,
      this.toCreateCameraInput(dto),
    );
  }

  @Get()
  @RequirePermissions(Permissions.CAMERA_VIEW)
  @ApiOperation({
    summary:
      'List cameras for the current organization',
  })
  async listCameras(
    @Req() req: AuthenticatedRequest,
    @Query() query: CameraQueryApiDto,
  ) {
    return this.cameraService.listCameras(
      req.user.organizationId,
      {
        page: query.page,
        limit: query.limit,
        status: query.status,
        enabled: query.enabled,
        location: query.location,
        search: query.search,
      },
    );
  }

  @Get(':id')
  @RequirePermissions(Permissions.CAMERA_VIEW)
  @ApiOperation({
    summary: 'Get camera details',
  })
  async getCamera(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cameraService.getCamera(
      req.user.organizationId,
      id,
    );
  }

  @Patch(':id')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @ApiOperation({
    summary: 'Update camera',
  })
  async updateCamera(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCameraApiDto,
  ) {
    const camera = await this.cameraService.updateCamera(
      req.user.organizationId,
      id,
      this.toUpdateCameraInput(dto),
    );

    await this.resyncRunningWorker(req.user.organizationId, id);

    return camera;
  }

  @Delete(':id')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete camera',
  })
  async deleteCamera(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const organizationId =
      req.user.organizationId;

    /**
     * Stop recognition BEFORE deleting the DB record.
     *
     * This prevents an active FFmpeg process from
     * continuing to process frames against a deleted
     * camera.
     */
    await this.workerManager.stopWorker(
      organizationId,
      id,
    );

    this.auditLogger.info('Camera deleted', {
      userId: req.user.sub,
      organizationId,
      cameraId: id,
      action: 'DELETE',
      resourceType: 'Camera',
      resourceId: id,
    });

    return this.cameraService.deleteCamera(
      organizationId,
      id,
    );
  }

  // ============================================================
  // ENABLE / DISABLE
  // ============================================================

  @Patch(':id/enable')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enable camera',
  })
  async enableCamera(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.auditLogger.info('Camera enabled', {
      userId: req.user.sub,
      organizationId: req.user.organizationId,
      cameraId: id,
      action: 'ENABLE',
      resourceType: 'Camera',
      resourceId: id,
    });
    const camera = await this.cameraService.enableCamera(
      req.user.organizationId,
      id,
    );

    /**
     * `enableCamera` only flips the stored flag, while recognition is owned by
     * a worker that is started in bulk by `startEnabledCameras()` at boot.
     * Without this, an operator who disables and then re-enables a camera gets
     * one that reports "enabled" and records no attendance at all until the API
     * is restarted.
     */
    if (camera.recognitionEnabled) {
      try {
        await this.workerManager.startWorker(
          req.user.organizationId,
          id,
        );
      } catch (err: unknown) {
        this.auditLogger.warn(
          'Camera enabled but its recognition worker could not start',
          {
            organizationId: req.user.organizationId,
            cameraId: id,
            error: err instanceof Error ? err.message : String(err),
          },
        );
      }
    }

    return camera;
  }

  @Patch(':id/disable')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disable camera',
  })
  async disableCamera(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const organizationId =
      req.user.organizationId;

    /**
     * Security invariant:
     *
     * disabled camera === no active recognition worker.
     */
    await this.workerManager.stopWorker(
      organizationId,
      id,
    );

    this.auditLogger.info('Camera disabled', {
      userId: req.user.sub,
      organizationId,
      cameraId: id,
      action: 'DISABLE',
      resourceType: 'Camera',
      resourceId: id,
    });

    return this.cameraService.disableCamera(
      organizationId,
      id,
    );
  }

  // ============================================================
  // CONNECTION / DISCOVERY
  // ============================================================

  @Post('test-connection')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @ApiOperation({
    summary:
      'Test camera connection without saving',
  })
  async testConnection(
    @Req() req: AuthenticatedRequest,
    @Body() dto: TestCameraConnectionApiDto,
  ) {
    return this.cameraService.testCameraConnection(
      req.user.organizationId,
      {
        host: dto.host,
        port: dto.port,
        protocol: dto.protocol,
        username: dto.username,
        password: dto.password,
        streamPath: dto.streamPath,
        rtspTransport: dto.rtspTransport,
      },
    );
  }

  @Post('discover')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @Throttle({
    default: {
      limit: 3,
      ttl: 60_000,
    },
  })
  @ApiOperation({
    summary:
      'Discover ONVIF cameras on the network',
  })
  async discoverCameras(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DiscoverCamerasApiDto,
  ) {
    return this.cameraService.discoverCameras(
      req.user.organizationId,
      {
        timeoutMs: dto.timeoutMs,
        subnet: dto.subnet,
      },
    );
  }

  // ============================================================
  // HEALTH / EVENTS
  // ============================================================

  @Get(':id/health')
  @RequirePermissions(Permissions.CAMERA_VIEW)
  @ApiOperation({
    summary: 'Get camera health',
  })
  async getHealth(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cameraService.getCameraHealth(
      req.user.organizationId,
      id,
    );
  }

  @Get(':id/events')
  @RequirePermissions(Permissions.CAMERA_VIEW)
  @ApiOperation({
    summary:
      'Get camera recognition events',
  })
  async getEvents(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CameraEventQuery,
  ) {
    return this.cameraService.getCameraEvents(
      req.user.organizationId,
      id,
      {
        page: query.page,
        limit: query.limit,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    );
  }

  // ============================================================
  // CAMERA CONFIG
  // ============================================================

  @Patch(':id/config')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @ApiOperation({
    summary:
      'Update camera processing configuration',
  })
  async updateConfig(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCameraConfigDto,
  ) {
    const camera = await this.cameraService.updateCameraConfig(
      req.user.organizationId,
      id,
      dto,
    );

    await this.resyncRunningWorker(req.user.organizationId, id);

    return camera;
  }

  // ============================================================
  // WORKER LIFECYCLE
  // ============================================================

  @Post(':id/start-worker')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Start real-time camera recognition worker',
  })
  async startWorker(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.workerManager.startWorker(
      req.user.organizationId,
      id,
    );

    return {
      success: true,
      cameraId: id,
      status: 'STARTED',
    };
  }

  @Post(':id/stop-worker')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Stop camera recognition worker',
  })
  async stopWorker(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.workerManager.stopWorker(
      req.user.organizationId,
      id,
    );

    return {
      success: true,
      cameraId: id,
      status: 'STOPPED',
    };
  }

  @Post(':id/restart-worker')
  @RequirePermissions(Permissions.CAMERA_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Restart camera recognition worker',
  })
  async restartWorker(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const status = await this.workerManager.restartWorker(
      req.user.organizationId,
      id,
    );

    // Report the real post-restart state instead of an unconditional success:
    // a restart may deliberately not start when another replica owns the
    // camera, and the operator must be able to see that.
    return {
      success: status.running === true,
      cameraId: id,
      status: status.running ? 'RESTARTED' : 'NOT_STARTED',
      worker: status,
    };
  }

  @Get(':id/worker-status')
  @RequirePermissions(Permissions.CAMERA_VIEW)
  @ApiOperation({
    summary:
      'Get camera worker status',
  })
  async getWorkerStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workerManager.getWorkerStatus(
      req.user.organizationId,
      id,
    );
  }

  // ============================================================
  // PRIVATE MAPPERS
  // ============================================================

  private toCreateCameraInput(
    dto: CreateCameraApiDto,
  ) {
    return {
      name: dto.name,
      vendor: dto.vendor,
      model: dto.model,
      protocol: dto.protocol,
      host: dto.host,
      port: dto.port,
      username: dto.username,
      password: dto.password,
      streamPath: dto.streamPath,
      rtspTransport: dto.rtspTransport,
      location: dto.location,
      processingFps: dto.processingFps,
      enabled: dto.enabled,
      recognitionEnabled:
        dto.recognitionEnabled,
      attendanceEnabled:
        dto.attendanceEnabled,
      metadata: dto.metadata,
    };
  }

  private toUpdateCameraInput(
    dto: UpdateCameraApiDto,
  ) {
    return {
      name: dto.name,
      vendor: dto.vendor,
      model: dto.model,
      protocol: dto.protocol,
      host: dto.host,
      port: dto.port,
      username: dto.username,
      password: dto.password,
      streamPath: dto.streamPath,
      rtspTransport: dto.rtspTransport,
      location: dto.location,
      processingFps: dto.processingFps,
      enabled: dto.enabled,
      recognitionEnabled:
        dto.recognitionEnabled,
      attendanceEnabled:
        dto.attendanceEnabled,
      metadata: dto.metadata,
    };
  }
}