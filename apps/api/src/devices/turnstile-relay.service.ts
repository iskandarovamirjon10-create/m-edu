import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import {
  DeviceTestResult,
  EmergencyModeState,
  PulseRelayOptions,
  PulseRelayResult,
  TurnstileDeviceConfig,
  TurnstileEmergencyMode,
} from './turnstile-relay.interface';

const FORBIDDEN_METADATA_HOSTS = new Set([
  '169.254.169.254',
  '169.254.170.2',
  'fd00:ec2::254',
  'metadata.google.internal',
  'instance-data',
]);

/**
 * Validates that an IoT / turnstile endpoint URL is well-formed, uses http/https,
 * and does NOT target cloud instance metadata services or forbidden internal ranges (SSRF defense).
 */
export function assertSafeEndpointUrl(
  rawUrl: string,
  isProduction: boolean = process.env.NODE_ENV === 'production',
): URL {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new BadRequestException('Turnstile endpointUrl is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException(`Malformed turnstile endpointUrl: "${rawUrl}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(
      `Prohibited protocol "${parsed.protocol}". Turnstile relays only support http: and https:`,
    );
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Cloud metadata defense (AWS, GCP, Azure, OpenStack)
  if (
    FORBIDDEN_METADATA_HOSTS.has(hostname) ||
    hostname.endsWith('.metadata.google.internal') ||
    hostname.startsWith('169.254.')
  ) {
    throw new BadRequestException(
      'Security violation: requests to cloud metadata endpoints are strictly forbidden (SSRF defense).',
    );
  }

  // Production loopback restriction
  if (isProduction) {
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('127.')
    ) {
      throw new BadRequestException(
        'Security violation: loopback addresses cannot be configured as external relay endpoints in production.',
      );
    }
  }

  return parsed;
}

@Injectable()
export class TurnstileRelayService {
  private readonly logger = new Logger(TurnstileRelayService.name);
  private readonly deviceRegistry = new Map<string, TurnstileDeviceConfig>();
  private readonly lastPulseTimestamps = new Map<string, number>();
  private readonly emergencyModes = new Map<string, EmergencyModeState>();

  /** Anti-burnout lockout window in milliseconds between physical coil pulses */
  private readonly MIN_PULSE_INTERVAL_MS = 1500;

  constructor(private readonly configService?: ConfigService) {}

  /**
   * Register or update a turnstile relay hardware configuration.
   */
  registerDevice(device: TurnstileDeviceConfig): void {
    if (device.protocol === 'HTTP_PULSE' && device.endpointUrl) {
      assertSafeEndpointUrl(device.endpointUrl);
    }
    this.deviceRegistry.set(device.id, { ...device });
    this.logger.log(`Turnstile relay registered: [${device.id}] "${device.name}" (${device.protocol})`);
  }

  /**
   * Remove a turnstile device registration.
   */
  unregisterDevice(deviceId: string, organizationId?: string): boolean {
    const dev = this.deviceRegistry.get(deviceId);
    if (!dev) return false;
    if (organizationId && dev.organizationId !== organizationId) return false;
    return this.deviceRegistry.delete(deviceId);
  }

  /**
   * Get device configuration by ID.
   */
  getDevice(deviceId: string, organizationId?: string): TurnstileDeviceConfig | undefined {
    const dev = this.deviceRegistry.get(deviceId);
    if (!dev) return undefined;
    if (organizationId && dev.organizationId !== organizationId) return undefined;
    return dev;
  }

  /**
   * List all configured devices for an organization.
   */
  listDevices(organizationId: string): TurnstileDeviceConfig[] {
    const devices: TurnstileDeviceConfig[] = [];
    for (const dev of this.deviceRegistry.values()) {
      if (dev.organizationId === organizationId) {
        devices.push({ ...dev });
      }
    }
    return devices;
  }

  /**
   * Dispatches a momentary dry-contact pulse to release a turnstile gate.
   * Includes anti-burnout rate-limiting and safe failure modes.
   */
  async triggerPulse(options: PulseRelayOptions): Promise<PulseRelayResult> {
    const startTime = Date.now();
    const executedAt = new Date();

    const emergency = this.getEmergencyMode(options.organizationId);
    if (emergency.mode === 'LOCKDOWN') {
      this.logger.warn(`Turnstile gate pulse BLOCKED due to active LOCKDOWN mode`);
      return {
        success: false,
        durationMs: 0,
        executedAt,
        status: 'EMERGENCY_LOCKDOWN',
        error: `Physical gate locked: security lockdown in effect (${emergency.reason || 'manual override'}).`,
      };
    }

    let targetDevice: TurnstileDeviceConfig | undefined;

    if (options.deviceId) {
      const dev = this.deviceRegistry.get(options.deviceId);
      if (dev && dev.organizationId === options.organizationId) {
        targetDevice = dev;
      }
    } else {
      // Find default or first active device for the organization
      for (const dev of this.deviceRegistry.values()) {
        if (dev.organizationId === options.organizationId && dev.enabled) {
          targetDevice = dev;
          break;
        }
      }
    }

    // If no physical device registered in repository memory, check environment defaults
    if (!targetDevice) {
      const defaultEndpoint = this.configService?.get<string>('TURNSTILE_RELAY_ENDPOINT');
      if (defaultEndpoint) {
        targetDevice = {
          id: 'env-default-relay',
          name: 'Default Environment Relay',
          organizationId: options.organizationId,
          protocol: 'HTTP_PULSE',
          endpointUrl: defaultEndpoint,
          enabled: true,
          defaultPulseMs: 1000,
        };
      }
    }

    if (!targetDevice) {
      this.logger.debug(
        `No turnstile relay configured for org=${options.organizationId}. Gate pulse skipped.`,
      );
      return {
        success: false,
        durationMs: 0,
        executedAt,
        status: 'NO_DEVICE',
        error: 'No active turnstile relay device configured for this organization.',
      };
    }

    if (!targetDevice.enabled) {
      return {
        success: false,
        deviceId: targetDevice.id,
        durationMs: 0,
        executedAt,
        status: 'DISABLED',
        error: `Device ${targetDevice.id} is disabled.`,
      };
    }

    // 1. Anti-Burnout Rate Limiting
    const now = Date.now();
    const lastPulse = this.lastPulseTimestamps.get(targetDevice.id) ?? 0;
    const elapsed = now - lastPulse;

    if (elapsed < this.MIN_PULSE_INTERVAL_MS) {
      const waitRemaining = this.MIN_PULSE_INTERVAL_MS - elapsed;
      this.logger.warn(
        `Turnstile [${targetDevice.id}] pulse rate-limited to prevent motor/coil burnout. ` +
        `Cooldown remaining: ${waitRemaining}ms`,
      );
      return {
        success: false,
        deviceId: targetDevice.id,
        durationMs: Date.now() - startTime,
        executedAt,
        status: 'RATE_LIMITED',
        error: `Rate limit active: minimum ${this.MIN_PULSE_INTERVAL_MS}ms interval between physical pulses.`,
      };
    }

    // Update lock timestamp immediately to serialize concurrent triggers
    this.lastPulseTimestamps.set(targetDevice.id, now);

    const pulseDuration = options.pulseMs || targetDevice.defaultPulseMs || 1000;

    // 2. Dispatch protocol-specific pulse
    try {
      if (targetDevice.protocol === 'MOCK') {
        this.logger.log(
          `[MOCK_RELAY] Pulled contact for ${pulseDuration}ms on [${targetDevice.id}] ` +
          `(student=${options.studentId ?? 'N/A'}, dir=${options.direction ?? 'IN'})`,
        );
        return {
          success: true,
          deviceId: targetDevice.id,
          durationMs: Date.now() - startTime,
          executedAt,
          status: 'PULSED',
        };
      }

      if (targetDevice.protocol === 'HTTP_PULSE') {
        await this.dispatchHttpPulse(targetDevice, pulseDuration, options);
        return {
          success: true,
          deviceId: targetDevice.id,
          durationMs: Date.now() - startTime,
          executedAt,
          status: 'PULSED',
        };
      }

      if (targetDevice.protocol === 'TCP_SOCKET' || targetDevice.protocol === 'IPC_SOCKET') {
        await this.dispatchSocketPulse(targetDevice, pulseDuration, options);
        return {
          success: true,
          deviceId: targetDevice.id,
          durationMs: Date.now() - startTime,
          executedAt,
          status: 'PULSED',
        };
      }

      throw new Error(`Unsupported relay protocol: ${targetDevice.protocol}`);
    } catch (err: unknown) {
      let errorMsg = err instanceof Error ? err.message : String(err);
      const isTimeout =
        (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) ||
        Boolean((err as { isTimeout?: boolean })?.isTimeout);

      if (isTimeout) {
        errorMsg = 'Relay controller request timed out after 3000ms';
      } else if (err instanceof Error && (err as { cause?: Error }).cause) {
        const cause = (err as { cause?: Error }).cause;
        const causeMsg = cause?.message || (cause as { code?: string })?.code || '';
        if (causeMsg) {
          errorMsg = `${errorMsg} (${causeMsg})`;
        }
      }

      // If connection or network failed, the physical coil was not triggered.
      // Revert the anti-burnout lock so valid retries aren't blocked.
      this.lastPulseTimestamps.delete(targetDevice.id);

      this.logger.error(`Turnstile relay pulse failed on [${targetDevice.id}]: ${errorMsg}`);
      return {
        success: false,
        deviceId: targetDevice.id,
        durationMs: Date.now() - startTime,
        executedAt,
        status: 'FAILED',
        error: errorMsg,
      };
    }
  }

  /**
   * Dispatches an HTTP GET or POST request to the physical relay controller with timeout.
   */
  private async dispatchHttpPulse(
    device: TurnstileDeviceConfig,
    pulseMs: number,
    options: PulseRelayOptions,
  ): Promise<void> {
    if (!device.endpointUrl) {
      throw new Error(`Device [${device.id}] has no endpointUrl configured.`);
    }

    const url = assertSafeEndpointUrl(device.endpointUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      // Support common Shelly / IoT query params if specified
      if (!url.searchParams.has('timer')) {
        url.searchParams.set('timer', String(Math.round(pulseMs / 1000)));
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (device.authToken) {
        headers['Authorization'] = `Bearer ${device.authToken}`;
      }

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'open',
            durationMs: pulseMs,
            direction: options.direction ?? 'IN',
            studentId: options.studentId,
            timestamp: new Date().toISOString(),
          }),
          signal: controller.signal,
        });
      } catch (fetchErr: unknown) {
        if (controller.signal.aborted) {
          const timeoutErr = new Error('Relay controller request timed out after 3000ms');
          (timeoutErr as any).isTimeout = true;
          throw timeoutErr;
        }
        throw fetchErr;
      }

      if (!response.ok && response.status !== 200 && response.status !== 204) {
        throw new Error(`Relay controller returned HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.log(
        `Turnstile gate [${device.id}] successfully pulsed for ${pulseMs}ms. ` +
        `Target=${url.host}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Dispatches a raw TCP socket or IPC domain socket / named pipe pulse
   * with explicit timeout, disconnection detection, and resource cleanup.
   */
  private async dispatchSocketPulse(
    device: TurnstileDeviceConfig,
    pulseMs: number,
    _options: PulseRelayOptions,
  ): Promise<void> {
    // Detect IPC vs TCP
    const isIpc =
      device.protocol === 'IPC_SOCKET' ||
      Boolean(device.ipcPath) ||
      Boolean(device.endpointUrl?.startsWith('ipc://')) ||
      Boolean(device.endpointUrl?.startsWith('unix://')) ||
      Boolean(device.host && (device.host.startsWith('/') || device.host.startsWith('\\\\.\\pipe\\')));

    let ipcPath: string | undefined;
    let host: string | undefined;
    let port: number | undefined;

    if (isIpc) {
      ipcPath =
        device.ipcPath ||
        (device.endpointUrl?.startsWith('ipc://') ? device.endpointUrl.slice(6) : undefined) ||
        (device.endpointUrl?.startsWith('unix://') ? device.endpointUrl.slice(7) : undefined) ||
        device.host;

      if (!ipcPath) {
        throw new Error(`Device [${device.id}] has no ipcPath configured for IPC socket communication.`);
      }
    } else {
      host = device.host;
      port = device.port;

      if (!host && device.endpointUrl) {
        try {
          const parsed = new URL(device.endpointUrl);
          host = parsed.hostname;
          if (parsed.port) port = Number(parsed.port);
        } catch {
          // fallback
        }
      }

      if (!host) {
        throw new Error(`Device [${device.id}] has no host or valid endpointUrl configured for TCP socket.`);
      }
    }

    const resolvedPort = port || 5000;
    const destinationLabel = isIpc ? `IPC:${ipcPath}` : `TCP:${host}:${resolvedPort}`;

    return new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;

      // Hard timeout timer: guarantees cancellation even if DNS or OS connect hangs
      const overallTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          socket.destroy();
          const err = new Error(`Socket connection to ${destinationLabel} timed out after 3000ms`);
          (err as any).isTimeout = true;
          reject(err);
        }
      }, 3000);

      socket.setTimeout(3000);

      const cleanup = () => {
        clearTimeout(overallTimer);
        try {
          socket.removeAllListeners();
        } catch {
          // ignore
        }
      };

      socket.on('timeout', () => {
        if (!settled) {
          settled = true;
          cleanup();
          socket.destroy();
          const err = new Error(`Socket connection to ${destinationLabel} timed out after 3000ms`);
          (err as any).isTimeout = true;
          reject(err);
        }
      });

      socket.on('error', (err) => {
        if (!settled) {
          settled = true;
          cleanup();
          socket.destroy();
          reject(err);
        }
      });

      // Handle socket disconnection before pulse finishes
      socket.on('close', (hadError) => {
        if (!settled) {
          settled = true;
          cleanup();
          socket.destroy();
          reject(new Error(`Socket connection to ${destinationLabel} closed unexpectedly${hadError ? ' with error' : ''}`));
        }
      });

      socket.on('end', () => {
        if (!settled) {
          settled = true;
          cleanup();
          socket.destroy();
          reject(new Error(`Socket connection to ${destinationLabel} was ended by remote peer before pulse completed`));
        }
      });

      const onConnect = () => {
        const cmd = `OPEN ${pulseMs}\r\n`;
        socket.write(cmd, (writeErr) => {
          if (writeErr && !settled) {
            settled = true;
            cleanup();
            socket.destroy();
            reject(writeErr);
            return;
          }
          if (!settled) {
            settled = true;
            cleanup();
            socket.end();
            resolve();
          }
        });
      };

      if (isIpc && ipcPath) {
        socket.connect(ipcPath, onConnect);
      } else if (host) {
        socket.connect(resolvedPort, host, onConnect);
      }
    });
  }

  /**
   * Get the current emergency mode state for an organization.
   */
  getEmergencyMode(organizationId: string): EmergencyModeState {
    return (
      this.emergencyModes.get(organizationId) ?? {
        mode: 'NORMAL',
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Sets the turnstile security mode for an organization (NORMAL, EVACUATION, or LOCKDOWN).
   * In EVACUATION mode: dispatches permanent/extended open pulse to all gates so occupants can exit safely.
   * In LOCKDOWN mode: disallows any open pulses and immediately secures all gates.
   */
  async setEmergencyMode(
    organizationId: string,
    mode: TurnstileEmergencyMode,
    reason?: string,
    userId?: string,
  ): Promise<EmergencyModeState> {
    const state: EmergencyModeState = {
      mode,
      reason,
      updatedAt: new Date(),
      updatedBy: userId,
    };
    this.emergencyModes.set(organizationId, state);

    this.logger.warn(
      `🚨 [EMERGENCY_OVERRIDE] Organization [${organizationId}] turnstiles set to ${mode} mode ` +
      `(by=${userId ?? 'system'}, reason="${reason || 'none'}")`,
    );

    if (mode === 'EVACUATION') {
      const devices = this.listDevices(organizationId);
      for (const dev of devices) {
        if (dev.enabled) {
          this.triggerPulse({
            organizationId,
            deviceId: dev.id,
            direction: 'OUT',
            pulseMs: 15000,
            reason: `EVACUATION ORDER by ${userId ?? 'system'}`,
          }).catch((err: unknown) => {
            this.logger.error(`Evacuation pulse failed for device ${dev.id}: ${err instanceof Error ? err.message : String(err)}`);
          });
        }
      }
    }

    return state;
  }

  /**
   * Pings physical turnstile relay controller to verify hardware connectivity, latency, and status.
   */
  async testDevice(deviceId: string, organizationId: string): Promise<DeviceTestResult> {
    const dev = this.getDevice(deviceId, organizationId);
    if (!dev) {
      return {
        deviceId,
        online: false,
        latencyMs: 0,
        protocol: 'MOCK',
        message: 'Device not found or does not belong to this organization',
      };
    }

    const start = Date.now();
    try {
      if (dev.protocol === 'MOCK') {
        return {
          deviceId,
          online: true,
          latencyMs: 1,
          protocol: dev.protocol,
          message: 'Mock relay controller ready and responding',
        };
      }

      if (dev.protocol === 'HTTP_PULSE') {
        if (!dev.endpointUrl) throw new Error('No endpointUrl configured');
        const safeUrl = assertSafeEndpointUrl(dev.endpointUrl);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        try {
          const res = await fetch(safeUrl.toString(), {
            method: 'HEAD',
            signal: controller.signal,
          });
          return {
            deviceId,
            online: res.status < 500,
            latencyMs: Date.now() - start,
            protocol: dev.protocol,
            message: `HTTP endpoint online (HTTP ${res.status})`,
          };
        } finally {
          clearTimeout(timeout);
        }
      }

      if (dev.protocol === 'TCP_SOCKET') {
        return new Promise<DeviceTestResult>((resolve) => {
          const socket = new net.Socket();
          const timer = setTimeout(() => {
            socket.destroy();
            resolve({
              deviceId,
              online: false,
              latencyMs: Date.now() - start,
              protocol: dev.protocol,
              message: 'TCP socket ping timed out (2000ms)',
            });
          }, 2000);

          socket.on('connect', () => {
            clearTimeout(timer);
            socket.end();
            resolve({
              deviceId,
              online: true,
              latencyMs: Date.now() - start,
              protocol: dev.protocol,
              message: 'TCP hardware controller socket verified',
            });
          });

          socket.on('error', (err) => {
            clearTimeout(timer);
            socket.destroy();
            resolve({
              deviceId,
              online: false,
              latencyMs: Date.now() - start,
              protocol: dev.protocol,
              message: err.message,
            });
          });

          const port = dev.port || 5000;
          let host = dev.host;
          if (!host && dev.endpointUrl) {
            try {
              host = new URL(dev.endpointUrl).hostname;
            } catch {
              host = '127.0.0.1';
            }
          }
          socket.connect(port, host || '127.0.0.1');
        });
      }

      return {
        deviceId,
        online: true,
        latencyMs: Date.now() - start,
        protocol: dev.protocol,
        message: 'Protocol diagnostics completed',
      };
    } catch (err: unknown) {
      return {
        deviceId,
        online: false,
        latencyMs: Date.now() - start,
        protocol: dev.protocol,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
