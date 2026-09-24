/**
 * FIX-4: Real-time alerting for camera offline / error states.
 *
 * Listens to CameraWorkerSession events ('camera-offline',
 * 'camera-recovered', 'frozen-frame-detected') and writes
 * Notification rows with a 15-minute per-camera debounce.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecureLogger } from '@medu/face-security';

/** 15 minutes = 900_000 ms */
const ALERT_DEBOUNCE_MS = 15 * 60 * 1000;

/** Per-camera last-alert timestamp. */
interface DebounceEntry {
  lastAlertAt: number;
  alertType: 'offline' | 'recovered' | 'frozen';
}

@Injectable()
export class CameraAlertingService implements OnModuleInit {
  private readonly logger = new SecureLogger('info');
  private readonly debounce = new Map<
    string,
    DebounceEntry
  >();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.logger.info('CameraAlertingService initialized with 15-min debounce');
  }

  /**
   * Call this when a worker emits 'camera-offline'.
   * Writes a Notification for the org's ORG_ADMIN users.
   * Suppresses duplicate alerts within ALERT_DEBOUNCE_MS.
   */
  async sendOfflineAlert(params: {
    cameraId: string;
    organizationId: string;
    error: string;
    cameraName?: string;
    cameraLocation?: string | null;
  }): Promise<{ alerted: boolean; suppressed: boolean }> {
    const key = `${params.organizationId}:${params.cameraId}:offline`;
    const now = Date.now();
    const prev = this.debounce.get(key);

    if (prev && now - prev.lastAlertAt < ALERT_DEBOUNCE_MS) {
      return { alerted: false, suppressed: true };
    }

    // Find ORG_ADMIN users in the organization
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId: params.organizationId,
        role: Role.ORG_ADMIN,
        isActive: true,
      },
      select: { id: true },
    });

    const messages = admins.map((a) => ({
      userId: a.id,
      organizationId: params.organizationId,
      title: `Camera offline — ${params.cameraName ?? params.cameraId}`,
      message: `Camera ${params.cameraName ?? params.cameraId}` +
        (params.cameraLocation ? ` (${params.cameraLocation})` : '') +
        ` reported an error: ${params.error}`,
      type: 'camera-alert',
    }));

    if (messages.length > 0) {
      await this.prisma.notification.createMany({
        data: messages,
        skipDuplicates: false,
      });
    }

    this.debounce.set(key, {
      lastAlertAt: now,
      alertType: 'offline',
    });

    if (Math.random() < 0.1) {
      const expiration = Date.now() - ALERT_DEBOUNCE_MS;
      for (const [k, v] of this.debounce.entries()) {
        if (v.lastAlertAt < expiration) {
          this.debounce.delete(k);
        }
      }
    }

    this.logger.info('Camera offline alert sent', {
      cameraId: params.cameraId,
      organizationId: params.organizationId,
      adminCount: admins.length,
      suppressed: false,
    });

    return { alerted: true, suppressed: false };
  }

  /**
   * Call this when a worker emits 'camera-recovered'.
   * Clears the debounce entry so the next failure can
   * trigger a new alert immediately.
   */
  async sendRecoveredAlert(params: {
    cameraId: string;
    organizationId: string;
    cameraName?: string;
  }): Promise<{ cleared: boolean }> {
    const key = `${params.organizationId}:${params.cameraId}:offline`;
    this.debounce.delete(key);

    this.logger.info('Camera recovered — debounce cleared', {
      cameraId: params.cameraId,
      organizationId: params.organizationId,
    });

    return { cleared: true };
  }

  /**
   * Optional: frozen-frame notification (separate category,
   * not debounced with offline — frozen is a hardware state).
   */
  async sendFrozenAlert(params: {
    cameraId: string;
    organizationId: string;
    cameraName?: string;
  }): Promise<{ alerted: boolean; suppressed: boolean }> {
    const key = `${params.organizationId}:${params.cameraId}:frozen`;
    const now = Date.now();
    const prev = this.debounce.get(key);

    if (prev && now - prev.lastAlertAt < ALERT_DEBOUNCE_MS) {
      return { alerted: false, suppressed: true };
    }

    const admins = await this.prisma.user.findMany({
      where: {
        organizationId: params.organizationId,
        role: Role.ORG_ADMIN,
        isActive: true,
      },
      select: { id: true },
    });

    if (admins.length > 0) {
      await this.prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          organizationId: params.organizationId,
          title: `Camera frozen — ${params.cameraName ?? params.cameraId}`,
          message: `Camera feed appears stalled (frozen frame detected). Check lens/network.`,
          type: 'camera-alert',
        })),
      });
    }

    this.debounce.set(key, { lastAlertAt: now, alertType: 'frozen' });

    if (Math.random() < 0.1) {
      const expiration = Date.now() - ALERT_DEBOUNCE_MS;
      for (const [k, v] of this.debounce.entries()) {
        if (v.lastAlertAt < expiration) {
          this.debounce.delete(k);
        }
      }
    }
    return { alerted: true, suppressed: false };
  }
}
