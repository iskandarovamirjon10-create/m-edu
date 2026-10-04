import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, Camera } from '@prisma/client';
import { CredentialVault, NetworkSecurity } from '@medu/camera-engine';
import type { DiscoveredDevice } from '@medu/camera-engine';
import { SecureLogger } from '@medu/face-security';

import { PrismaService } from '../prisma/prisma.service';
import { getErrorMessage } from '../lib/error';
import { parsePagination } from '../lib/pagination';

import { OrgRateLimiter } from './org-rate-limiter';

import {
  CameraQueryApiDto,
  CreateCameraApiDto,
  DiscoverCamerasApiDto,
  TestCameraConnectionApiDto,
  UpdateCameraApiDto,
  UpdateCameraConfigDto,
} from './dto/camera.dto';

import { CameraEventQuery } from '../common/dto/query';

type CameraEventWithRelations = Prisma.CameraAttendanceEventGetPayload<{
  include: {
    student: {
      include: {
        user: {
          select: {
            firstName: true;
            lastName: true;
          };
        };
      };
    };
    group: {
      select: {
        id: true;
        name: true;
      };
    };
    camera: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

type CameraConnectionParams = {
  validatedIp?: string;
  host: string;
  port: number;
  protocol: 'RTSP' | 'ONVIF';
  credentials?: {
    username: string;
    password: string;
  };
  streamPath?: string;
  rtspTransport: 'tcp' | 'udp';
  timeoutMs: number;
};

@Injectable()
export class CameraService {
  private readonly logger = new SecureLogger('info');

  private readonly credentialVault: CredentialVault;
  private readonly networkSecurity: NetworkSecurity;
  private readonly orgLimiter = new OrgRateLimiter();

  private static readonly DEFAULT_RTSP_PORT = 554;
  private static readonly DEFAULT_ONVIF_PORT = 80;
  private static readonly DEFAULT_PROCESSING_FPS = 3;

  private static readonly MIN_PROCESSING_FPS = 0.5;
  private static readonly MAX_PROCESSING_FPS = 30;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() networkSecurity?: NetworkSecurity,
  ) {
    this.credentialVault = this.createCredentialVault();
    this.networkSecurity = networkSecurity ?? this.createNetworkSecurity();
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async createCamera(
    organizationId: string,
    data: CreateCameraApiDto,
  ) {
    this.assertOrganizationId(organizationId);

    const validatedIp = await this.validateCameraHost(data.host);

    const protocol = data.protocol ?? 'RTSP';
    const port = this.resolvePort(protocol, data.port);

    const processingFps = this.normalizeProcessingFps(
      data.processingFps,
    );

    const encryptedCredentials =
      this.hasCompleteCredentials(data.username, data.password)
        ? await this.encryptCredentials(
            data.username!,
            data.password!,
          )
        : null;

    const camera = await this.prisma.camera.create({
      data: {
        organizationId,

        name: data.name,
        vendor: data.vendor ?? 'Generic',
        model: data.model ?? null,

        protocol,
        host: data.host,
        port,

        streamPath: data.streamPath ?? null,
        rtspTransport: data.rtspTransport ?? 'tcp',

        encryptedCredentials,
        credentialConfigured: encryptedCredentials !== null,

        processingFps,

        location: data.location ?? null,

        enabled: data.enabled !== false,
        recognitionEnabled: data.recognitionEnabled !== false,
        attendanceEnabled: data.attendanceEnabled !== false,

        status: 'CONFIGURED',

        metadata: this.buildCameraMetadata({
          client: data.metadata,
          previous: null,
          host: data.host,
          validatedIp,
        }),
      },
    });

    this.logger.info('Camera created', {
      cameraId: camera.id,
      organizationId,
    });

    return this.serializeCamera(camera);
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  async listCameras(
    organizationId: string,
    query: CameraQueryApiDto,
  ) {
    this.assertOrganizationId(organizationId);

    const { page, limit, skip } = parsePagination(query);

    const where = this.buildCameraWhere(
      organizationId,
      query,
    );

    const [items, total] = await Promise.all([
      this.prisma.camera.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),

      this.prisma.camera.count({
        where,
      }),
    ]);

    return {
      items: items.map((camera) =>
        this.serializeCamera(camera),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------------------------------------------------------------------------
  // GET
  // ---------------------------------------------------------------------------

  async getCamera(
    organizationId: string,
    cameraId: string,
  ) {
    this.assertOrganizationId(organizationId);
    this.assertCameraId(cameraId);

    const camera = await this.findCamera(
      organizationId,
      cameraId,
    );

    return this.serializeCamera(camera);
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async updateCamera(
    organizationId: string,
    cameraId: string,
    data: UpdateCameraApiDto,
  ) {
    this.assertOrganizationId(organizationId);
    this.assertCameraId(cameraId);

    const existing = await this.findCamera(
      organizationId,
      cameraId,
    );

    /**
     * The host is validated BEFORE anything is written. The returned IP is the
     * only destination the runtime is ever allowed to use for this camera, so it
     * has to be re-pinned whenever the host changes.
     */
    const validatedIp =
      data.host !== undefined
        ? await this.validateCameraHost(data.host)
        : undefined;

    const updateData: Prisma.CameraUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.vendor !== undefined) {
      updateData.vendor = data.vendor;
    }

    if (data.model !== undefined) {
      updateData.model = data.model;
    }

    if (data.protocol !== undefined) {
      updateData.protocol = data.protocol;
    }

    if (data.host !== undefined) {
      updateData.host = data.host;
    }

    if (data.port !== undefined) {
      updateData.port = data.port;
    }

    if (data.streamPath !== undefined) {
      updateData.streamPath = data.streamPath;
    }

    if (data.rtspTransport !== undefined) {
      updateData.rtspTransport = data.rtspTransport;
    }

    if (data.location !== undefined) {
      updateData.location = data.location;
    }

    if (data.processingFps !== undefined) {
      updateData.processingFps =
        this.normalizeProcessingFps(
          data.processingFps,
        );
    }

    if (data.enabled !== undefined) {
      updateData.enabled = data.enabled;
    }

    if (data.recognitionEnabled !== undefined) {
      updateData.recognitionEnabled =
        data.recognitionEnabled;
    }

    if (data.attendanceEnabled !== undefined) {
      updateData.attendanceEnabled =
        data.attendanceEnabled;
    }

    /**
     * `metadata` is a shared JSON blob: clients may write their own keys, but
     * the validated destination pin is server-owned and must never be supplied
     * (or removed) by the client — otherwise a tenant could point the worker at
     * an address that never went through SSRF validation.
     */
    if (
      data.metadata !== undefined ||
      data.host !== undefined
    ) {
      updateData.metadata =
        this.buildCameraMetadata({
          client: data.metadata,
          previous: existing.metadata,
          host: data.host,
          validatedIp,
        });
    }

    await this.applyCredentialUpdate(
      updateData,
      data.username,
      data.password,
    );

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'No camera fields were provided for update',
      );
    }

    const camera =
      await this.prisma.camera.update({
        where: {
          id: cameraId,
          organizationId,
        },
        data: updateData,
      });

    this.logger.info('Camera updated', {
      cameraId,
      organizationId,
      updatedFields: Object.keys(updateData),
    });

    return this.serializeCamera(camera);
  }

  // ---------------------------------------------------------------------------
  // ENABLE
  // ---------------------------------------------------------------------------

  async enableCamera(
    organizationId: string,
    cameraId: string,
  ) {
    this.assertOrganizationId(organizationId);
    this.assertCameraId(cameraId);

    const camera = await this.findCamera(
      organizationId,
      cameraId,
    );

    if (camera.enabled) {
      return this.serializeCamera(camera);
    }

    const updated =
      await this.prisma.camera.update({
        where: {
          id: camera.id,
          organizationId,
        },
        data: {
          enabled: true,

          // Do not resurrect runtime states blindly.
          // CONFIGURED is the safe persistent state.
          status:
            camera.status === 'DISABLED'
              ? 'CONFIGURED'
              : camera.status,
        },
      });

    this.logger.info('Camera enabled', {
      cameraId,
      organizationId,
    });

    return this.serializeCamera(updated);
  }

  // ---------------------------------------------------------------------------
  // DISABLE
  // ---------------------------------------------------------------------------

  async disableCamera(
    organizationId: string,
    cameraId: string,
  ) {
    this.assertOrganizationId(organizationId);
    this.assertCameraId(cameraId);

    const camera = await this.findCamera(
      organizationId,
      cameraId,
    );

    if (!camera.enabled && camera.status === 'DISABLED') {
      return this.serializeCamera(camera);
    }

    const updated =
      await this.prisma.camera.update({
        where: {
          id: camera.id,
          organizationId,
        },
        data: {
          enabled: false,
          status: 'DISABLED',
        },
      });

    this.logger.info('Camera disabled', {
      cameraId,
      organizationId,
    });

    return this.serializeCamera(updated);
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  async deleteCamera(
    organizationId: string,
    cameraId: string,
  ) {
    this.assertOrganizationId(organizationId);
    this.assertCameraId(cameraId);

    const camera = await this.findCamera(
      organizationId,
      cameraId,
    );

    const eventCount =
      await this.prisma.cameraAttendanceEvent.count({
        where: {
          cameraId: camera.id,
          organizationId,
        },
      });

    if (eventCount > 0) {
      throw new BadRequestException(
        'This camera has recognition events. Disable it instead of deleting it to preserve event history.',
      );
    }

    try {
      await this.prisma.camera.delete({
        where: {
          id: camera.id,
          organizationId,
        },
      });
    } catch (error: unknown) {
      /*
       * The database remains the final source of truth.
       * Even though we pre-check eventCount, another transaction
       * may create an event between the check and delete.
       */
      if (this.isForeignKeyConstraintError(error)) {
        throw new BadRequestException(
          'Camera cannot be deleted because it has dependent records. Disable it instead.',
        );
      }

      throw error;
    }

    this.logger.info('Camera deleted', {
      cameraId,
      organizationId,
    });

    return {
      success: true,
    };
  }

  // ---------------------------------------------------------------------------
  // CONNECTION TEST
  // ---------------------------------------------------------------------------

  async testCameraConnection(
    organizationId: string,
    data: TestCameraConnectionApiDto,
  ) {
    this.assertOrganizationId(organizationId);

    this.orgLimiter.assert(
      organizationId,
      'test-connection',
      10,
      60_000,
    );

    const validatedIp = await this.validateCameraHost(data.host);

    const protocol = (data.protocol ?? 'RTSP') as 'RTSP' | 'ONVIF';

    const params: CameraConnectionParams = {
      host: data.host,
      validatedIp,
      port: this.resolvePort(
        protocol,
        data.port,
      ),
      protocol,
      streamPath: data.streamPath,
      rtspTransport:
        data.rtspTransport ?? 'tcp',
      timeoutMs: 5_000,

      credentials:
        this.hasCompleteCredentials(
          data.username,
          data.password,
        )
          ? {
              username: data.username!,
              password: data.password!,
            }
          : undefined,
    };

    const {
      RtspProvider,
      OnvifProvider,
    } = await import('@medu/camera-engine');

    if (protocol === 'ONVIF') {
      const provider =
        new OnvifProvider(
          this.networkSecurity,
        );

      const result =
        await provider.testConnection(
          params,
        );

      return {
        success: result.success,
        latencyMs: result.latencyMs,
        message: result.message,
        errorCode: result.errorCode,
        deviceInfo: result.deviceInfo,
        profiles: result.profiles,
      };
    }

    const provider =
      new RtspProvider(
        this.networkSecurity,
      );

    const result =
      await provider.testConnection(
        params,
      );

    return {
      success: result.success,
      latencyMs: result.latencyMs,
      message: result.message,
      errorCode: result.errorCode,
    };
  }

  // ---------------------------------------------------------------------------
  // DISCOVERY
  // ---------------------------------------------------------------------------

  async discoverCameras(
    organizationId: string,
    data: DiscoverCamerasApiDto,
  ) {
    this.assertOrganizationId(organizationId);

    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_CAMERA_DISCOVERY !== 'true'
    ) {
      throw new BadRequestException(
        'Camera discovery is disabled in production',
      );
    }

    this.orgLimiter.assert(
      organizationId,
      'discover:minute',
      3,
      60_000,
    );

    this.orgLimiter.assert(
      organizationId,
      'discover:hourly',
      10,
      3_600_000,
    );

    if (data.subnet) {
      await this.validateDiscoveryTarget(
        data.subnet,
      );
    }

    const { OnvifProvider } =
      await import('@medu/camera-engine');

    const provider =
      new OnvifProvider(
        this.networkSecurity,
      );

    const timeoutMs =
      data.timeoutMs ?? 5_000;

    const devices =
      await provider.discover(
        timeoutMs,
        data.subnet,
      );

    return devices.map(
      (device: DiscoveredDevice) => ({
        host: device.host,
        port: device.port,
        protocol: device.protocol,
        vendor: device.vendor,
        model: device.model,
        name: device.name,
        xAddr: device.xAddr,
        profiles: device.profiles,
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // HEALTH
  // ---------------------------------------------------------------------------

  async getCameraHealth(
    organizationId: string,
    cameraId: string,
  ) {
    this.assertOrganizationId(organizationId);
    this.assertCameraId(cameraId);

    const camera =
      await this.findCamera(
        organizationId,
        cameraId,
      );

    return {
      cameraId: camera.id,
      name: camera.name,
      status: camera.status,

      host: camera.host,
      port: camera.port,
      protocol: camera.protocol,

      lastSeenAt:
        camera.lastSeenAt?.toISOString() ??
        null,

      lastErrorAt:
        camera.lastErrorAt?.toISOString() ??
        null,

      lastErrorCode:
        camera.lastErrorCode,

      lastErrorMessage:
        camera.lastErrorMessage,

      reconnectCount:
        camera.reconnectCount,

      processingFps:
        Number(camera.processingFps),

      enabled:
        camera.enabled,

      recognitionEnabled:
        camera.recognitionEnabled,

      attendanceEnabled:
        camera.attendanceEnabled,
    };
  }

  // ---------------------------------------------------------------------------
  // EVENTS
  // ---------------------------------------------------------------------------

  async getCameraEvents(
    organizationId: string,
    cameraId: string,
    query: CameraEventQuery,
  ) {
    this.assertOrganizationId(organizationId);
    this.assertCameraId(cameraId);

    await this.findCamera(
      organizationId,
      cameraId,
    );

    const {
      page,
      limit,
      skip,
    } = parsePagination(query, {
      limit: 50,
    });

    const where: Prisma.CameraAttendanceEventWhereInput = {
      organizationId,
      cameraId,
    };

    if (query.dateFrom || query.dateTo) {
      where.recognizedAt = {};

      if (query.dateFrom) {
        const dateFrom =
          new Date(query.dateFrom);

        if (Number.isNaN(dateFrom.getTime())) {
          throw new BadRequestException(
            'Invalid dateFrom',
          );
        }

        where.recognizedAt.gte =
          dateFrom;
      }

      if (query.dateTo) {
        const dateTo =
          new Date(query.dateTo);

        if (Number.isNaN(dateTo.getTime())) {
          throw new BadRequestException(
            'Invalid dateTo',
          );
        }

        where.recognizedAt.lte =
          dateTo;
      }
    }

    const [
      items,
      total,
    ] = await Promise.all([
      this.prisma.cameraAttendanceEvent.findMany(
        {
          where,

          include: {
            student: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },

            group: {
              select: {
                id: true,
                name: true,
              },
            },

            camera: {
              select: {
                id: true,
                name: true,
              },
            },
          },

          orderBy: {
            recognizedAt: 'desc',
          },

          skip,
          take: limit,
        },
      ),

      this.prisma.cameraAttendanceEvent.count({
        where,
      }),
    ]);

    return {
      items: items.map(
        (event: CameraEventWithRelations) =>
          this.serializeCameraEvent(event),
      ),

      total,
      page,
      limit,
      totalPages: Math.ceil(
        total / limit,
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------

  async updateCameraConfig(
    organizationId: string,
    cameraId: string,
    config: UpdateCameraConfigDto,
  ) {
    this.assertOrganizationId(organizationId);
    this.assertCameraId(cameraId);

    await this.findCamera(
      organizationId,
      cameraId,
    );

    const updateData: Prisma.CameraUpdateInput =
      {};

    if (
      config.processingFps !== undefined
    ) {
      updateData.processingFps =
        this.normalizeProcessingFps(
          config.processingFps,
        );
    }

    if (
      config.recognitionEnabled !==
      undefined
    ) {
      updateData.recognitionEnabled =
        config.recognitionEnabled;
    }

    if (
      config.attendanceEnabled !==
      undefined
    ) {
      updateData.attendanceEnabled =
        config.attendanceEnabled;
    }

    if (
      Object.keys(updateData).length === 0
    ) {
      throw new BadRequestException(
        'No camera configuration fields were provided',
      );
    }

    const updated =
      await this.prisma.camera.update({
        where: {
          id: cameraId,
          organizationId,
        },
        data: updateData,
      });

    this.logger.info(
      'Camera configuration updated',
      {
        cameraId,
        organizationId,
        fields:
          Object.keys(updateData),
      },
    );

    return this.serializeCamera(
      updated,
    );
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — CAMERA LOOKUP
  // ---------------------------------------------------------------------------

  private async findCamera(
    organizationId: string,
    cameraId: string,
  ): Promise<Camera> {
    const camera =
      await this.prisma.camera.findFirst({
        where: {
          id: cameraId,
          organizationId,
        },
      });

    if (!camera) {
      throw new NotFoundException(
        'Camera not found',
      );
    }

    return camera;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — WHERE
  // ---------------------------------------------------------------------------

  private buildCameraWhere(
    organizationId: string,
    query: CameraQueryApiDto,
  ): Prisma.CameraWhereInput {
    const where: Prisma.CameraWhereInput = {
      organizationId,
    };

    if (query.status !== undefined) {
      where.status =
        query.status;
    }

    if (query.enabled !== undefined) {
      where.enabled =
        query.enabled;
    }

    if (query.location !== undefined) {
      where.location =
        query.location;
    }

    const search =
      query.search?.trim();

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          host: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          vendor: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          model: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    return where;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — VALIDATION
  // ---------------------------------------------------------------------------

  private async validateCameraHost(
    host: string,
  ): Promise<string> {
    try {
      return await this.networkSecurity.validateHost(
        host,
      );
    } catch (error: unknown) {
      throw new BadRequestException(
        getErrorMessage(error) ||
          'Camera host is not allowed',
      );
    }
  }

  private async validateDiscoveryTarget(
    subnet: string,
  ): Promise<void> {
    try {
      await this.networkSecurity.validateHost(
        subnet,
      );
    } catch (error: unknown) {
      throw new BadRequestException(
        getErrorMessage(error) ||
          'Discovery subnet is not allowed',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — METADATA (SSRF destination pin)
  // ---------------------------------------------------------------------------

  /**
   * Server-owned `Camera.metadata` keys. They hold the destination the SSRF
   * check approved, and they are the ONLY thing the streaming worker is allowed
   * to connect to, so clients can never write them.
   */
  private static readonly SERVER_METADATA_KEYS = [
    'validatedIp',
    'validatedHost',
  ] as const;

  private sanitizeClientMetadata(
    input: unknown,
  ): Record<string, unknown> {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      return {};
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(
      input as Record<string, unknown>,
    )) {
      if (
        (CameraService.SERVER_METADATA_KEYS as readonly string[]).includes(
          key,
        )
      ) {
        continue;
      }
      result[key] = value;
    }

    return result;
  }

  private readAddressPin(
    metadata: unknown,
  ): { validatedIp: string; validatedHost: string } | null {
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      Array.isArray(metadata)
    ) {
      return null;
    }

    const record = metadata as Record<string, unknown>;
    const validatedIp =
      typeof record.validatedIp === 'string'
        ? record.validatedIp.trim()
        : '';

    if (!validatedIp) {
      return null;
    }

    return {
      validatedIp,
      validatedHost:
        typeof record.validatedHost === 'string'
          ? record.validatedHost.trim()
          : '',
    };
  }

  /**
   * Build the `metadata` JSON to persist.
   *
   * - Client keys are preserved (minus the server-owned ones).
   * - When a host is written in this call, the pin is replaced with the IP that
   *   `validateHost()` just approved for that exact host. If validation did not
   *   produce an IP, any stale pin is dropped so the worker re-resolves at start
   *   time instead of trusting an address that belongs to the old host.
   * - When the host is untouched, the existing pin is carried over untouched.
   */
  private buildCameraMetadata(args: {
    client: unknown;
    previous: unknown;
    host?: string;
    validatedIp?: string;
  }): Prisma.InputJsonValue {
    const merged = {
      ...this.sanitizeClientMetadata(args.previous),
      ...this.sanitizeClientMetadata(args.client),
    };

    const pin =
      args.host !== undefined
        ? args.validatedIp
          ? {
              validatedIp: args.validatedIp,
              validatedHost: args.host.trim(),
            }
          : null
        : this.readAddressPin(args.previous);

    if (pin) {
      merged.validatedIp = pin.validatedIp;
      merged.validatedHost = pin.validatedHost;
    } else {
      delete merged.validatedIp;
      delete merged.validatedHost;
    }

    return merged as Prisma.InputJsonValue;
  }

  private normalizeProcessingFps(
    value: number | undefined,
  ): number {
    const fps =
      value ??
      CameraService.DEFAULT_PROCESSING_FPS;

    if (
      !Number.isFinite(fps) ||
      fps <
        CameraService.MIN_PROCESSING_FPS ||
      fps >
        CameraService.MAX_PROCESSING_FPS
    ) {
      throw new BadRequestException(
        `processingFps must be between ${CameraService.MIN_PROCESSING_FPS} and ${CameraService.MAX_PROCESSING_FPS}`,
      );
    }

    return fps;
  }

  private resolvePort(
    protocol: string,
    port?: number,
  ): number {
    if (port !== undefined) {
      return port;
    }

    return protocol === 'ONVIF'
      ? CameraService.DEFAULT_ONVIF_PORT
      : CameraService.DEFAULT_RTSP_PORT;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — CREDENTIALS
  // ---------------------------------------------------------------------------

  private hasCompleteCredentials(
    username?: string,
    password?: string,
  ): boolean {
    return Boolean(
      username?.trim() &&
        password !== undefined &&
        password.length > 0,
    );
  }

  private async encryptCredentials(
    username: string,
    password: string,
  ) {
    return this.credentialVault.encrypt({
      username,
      password,
    });
  }

  private async applyCredentialUpdate(
    updateData: Prisma.CameraUpdateInput,
    username?: string,
    password?: string,
  ): Promise<void> {
    const usernameProvided =
      username !== undefined;

    const passwordProvided =
      password !== undefined;

    if (
      !usernameProvided &&
      !passwordProvided
    ) {
      return;
    }

    /*
     * Credentials must be updated atomically as a pair.
     * Accepting only one side would create ambiguous state.
     */
    if (
      !this.hasCompleteCredentials(
        username,
        password,
      )
    ) {
      throw new BadRequestException(
        'Both username and password are required when updating camera credentials',
      );
    }

    updateData.encryptedCredentials =
      await this.encryptCredentials(
        username!,
        password!,
      );

    updateData.credentialConfigured =
      true;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — SERIALIZATION
  // ---------------------------------------------------------------------------

  private serializeCamera(
    camera: Camera,
  ) {
    return {
      id: camera.id,
      organizationId:
        camera.organizationId,

      name: camera.name,
      vendor: camera.vendor,
      model: camera.model,

      protocol: camera.protocol,
      host: camera.host,
      port: camera.port,

      location: camera.location,
      streamPath: camera.streamPath,
      rtspTransport:
        camera.rtspTransport,

      credentialConfigured:
        camera.credentialConfigured,

      processingFps:
        Number(camera.processingFps),

      enabled: camera.enabled,
      recognitionEnabled:
        camera.recognitionEnabled,
      attendanceEnabled:
        camera.attendanceEnabled,

      status: camera.status,

      lastSeenAt:
        camera.lastSeenAt?.toISOString() ??
        null,

      lastErrorAt:
        camera.lastErrorAt?.toISOString() ??
        null,

      lastErrorCode:
        camera.lastErrorCode,

      lastErrorMessage:
        camera.lastErrorMessage,

      reconnectCount:
        camera.reconnectCount,

      metadata: ((typeof camera.metadata === "object" && camera.metadata !== null) ? (({ validatedIp, validatedHost, ...rest }) => rest)(camera.metadata as any) : camera.metadata),

      createdAt:
        camera.createdAt.toISOString(),

      updatedAt:
        camera.updatedAt.toISOString(),
    };
  }

  private serializeCameraEvent(
    event: CameraEventWithRelations,
  ) {
    const firstName =
      event.student.user.firstName?.trim() ??
      '';

    const lastName =
      event.student.user.lastName?.trim() ??
      '';

    const studentName =
      [firstName, lastName]
        .filter(Boolean)
        .join(' ') ||
      'Unknown student';

    return {
      id: event.id,

      organizationId:
        event.organizationId,

      cameraId:
        event.camera.id,

      cameraName:
        event.camera.name,

      studentId:
        event.studentId,

      studentName,

      groupId:
        event.groupId,

      groupName:
        event.group?.name ??
        null,

      recognizedAt:
        event.recognizedAt.toISOString(),

      confidence:
        event.confidence?.toNumber() ??
        null,

      faceQuality:
        event.faceQuality?.toNumber() ??
        null,

      decision:
        event.decision,

      attendanceId:
        event.attendanceId,
    };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE — SECURITY / CONFIG
  // ---------------------------------------------------------------------------

  private createCredentialVault(): CredentialVault {
    const encryptionKey =
      process.env.BIOMETRIC_ENCRYPTION_KEY ??
      process.env.CAMERA_ENCRYPTION_KEY;

    // Fail-closed: biometric and camera credentials must never be stored
    // under a hardcoded fallback key regardless of NODE_ENV. The previous guard
    // used a non-strict check that allowed the well-known development key to
    // be used whenever NODE_ENV was not exactly 'production'.
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error(
        'BIOMETRIC_ENCRYPTION_KEY or CAMERA_ENCRYPTION_KEY must be ' +
          'configured with at least 32 characters in all non-test environments.',
      );
    }

    return new CredentialVault(encryptionKey);
  }

  private createNetworkSecurity(): NetworkSecurity {
    const isProduction =
      process.env.NODE_ENV ===
      'production';

    const allowLocalCameras =
      process.env.ALLOW_LOCAL_CAMERAS ===
      'true';

    return new NetworkSecurity({
      allowPrivateIps:
        allowLocalCameras ||
        !isProduction,

      allowLoopback:
        allowLocalCameras ||
        process.env.NODE_ENV ===
          'test',
    });
  }

  private assertOrganizationId(
    organizationId: string,
  ): void {
    if (!organizationId?.trim()) {
      throw new BadRequestException(
        'Organization ID is required',
      );
    }
  }

  private assertCameraId(
    cameraId: string,
  ): void {
    if (!cameraId?.trim()) {
      throw new BadRequestException(
        'Camera ID is required',
      );
    }
  }

  private isForeignKeyConstraintError(
    error: unknown,
  ): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    );
  }
}
