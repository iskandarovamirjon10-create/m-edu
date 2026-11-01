/**
 * M-EDU Turnstile Hardware Hub (`turnstileHardware.ts`)
 *
 * Enterprise Multi-Protocol Turnstile Physical Controller:
 * 1. Cloud / Local NestJS Backend Relay API (`POST /devices/turnstile/open`)
 * 2. Direct LAN IP Dry-Contact Relay (Shelly, Sonoff, ESP-Home, Wiegand-IP)
 * 3. Physical USB Serial Relay via WebSerial API (`navigator.serial`)
 * 4. Emergency Evacuation (doors open) & Lockdown (doors secured) state management
 */

import { turnstileApi } from '@/lib/api';

export type TurnstileSecurityMode = 'NORMAL' | 'EVACUATION' | 'LOCKDOWN';

export interface GatePulseOptions {
  deviceId?: string;
  durationMs?: number;
  direction?: 'IN' | 'OUT';
  reason?: string;
  studentId?: string;
}

export interface GatePulseResult {
  success: boolean;
  source: 'backend_api' | 'web_serial' | 'direct_lan';
  message?: string;
  error?: string;
}

/** Known USB Relay Hex Command Byte Sequences */
const USB_RELAY_COMMANDS = {
  // Common CH340 / LCUS-1 USB Relay Module
  CH340_OPEN: new Uint8Array([0xA0, 0x01, 0x01, 0xA2]),
  CH340_CLOSE: new Uint8Array([0xA0, 0x01, 0x00, 0xA1]),
  // Modbus RTU Relay 1 ON (Address 1, Function 5, Coil 0, FF 00, CRC)
  MODBUS_OPEN: new Uint8Array([0x01, 0x05, 0x00, 0x00, 0xFF, 0x00, 0x8C, 0x3A]),
  MODBUS_CLOSE: new Uint8Array([0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0xCD, 0xCA]),
};

let activeSerialPort: any = null;
let serialWriter: any = null;

export class TurnstileHardwareManager {
  private static instance: TurnstileHardwareManager;

  private constructor() {}

  public static getInstance(): TurnstileHardwareManager {
    if (!TurnstileHardwareManager.instance) {
      TurnstileHardwareManager.instance = new TurnstileHardwareManager();
    }
    return TurnstileHardwareManager.instance;
  }

  /**
   * Check if WebSerial API is supported in this browser runtime
   */
  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /**
   * Requests user permission to connect to a physical USB turnstile relay
   */
  public async requestUsbRelayConnection(): Promise<{ connected: boolean; info?: string; error?: string }> {
    if (!this.isWebSerialSupported()) {
      return { connected: false, error: 'WebSerial API ushbu brauzerda qo‘llab-quvvatlanmaydi' };
    }

    try {
      const serial = (navigator as any).serial;
      const port = await serial.requestPort();
      await port.open({ baudRate: 9600 });
      activeSerialPort = port;
      serialWriter = port.writable.getWriter();

      const info = port.getInfo?.();
      const usbVendor = info?.usbVendorId ? `0x${info.usbVendorId.toString(16)}` : 'USB';
      const usbProduct = info?.usbProductId ? `0x${info.usbProductId.toString(16)}` : 'Relay';

      return {
        connected: true,
        info: `USB Rele ulangan (${usbVendor}:${usbProduct})`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, error: msg };
    }
  }

  /**
   * Checks if USB Serial Relay is currently open and ready
   */
  public isUsbRelayConnected(): boolean {
    return Boolean(activeSerialPort && serialWriter);
  }

  /**
   * Dispatches a pulse via WebSerial direct to physical hardware
   */
  public async pulseUsbRelay(durationMs = 1200): Promise<boolean> {
    if (!this.isUsbRelayConnected()) return false;

    try {
      // 1. Send relay energize command
      await serialWriter.write(USB_RELAY_COMMANDS.CH340_OPEN);

      // 2. Wait pulse duration
      await new Promise((res) => setTimeout(res, durationMs));

      // 3. Send relay de-energize command
      await serialWriter.write(USB_RELAY_COMMANDS.CH340_CLOSE);
      return true;
    } catch (err) {
      console.warn('[TurnstileHardwareManager] USB Serial pulse error', err);
      return false;
    }
  }

  /**
   * Main gate release dispatcher. Dispatches pulse to:
   * 1. Physical USB Relay (if connected locally)
   * 2. Backend Turnstile API (which controls networked TCP/IPC/HTTP gates)
   * 3. Local direct LAN relay URL (if stored in kiosk preferences)
   */
  public async triggerGateRelease(options: GatePulseOptions = {}): Promise<GatePulseResult> {
    const pulseDuration = options.durationMs || 1000;
    let anySuccess = false;
    const errors: string[] = [];

    // Protocol 1: Physical WebSerial USB Relay
    if (this.isUsbRelayConnected()) {
      const usbOk = await this.pulseUsbRelay(pulseDuration);
      if (usbOk) {
        anySuccess = true;
      }
    }

    // Protocol 2: Backend Cloud / Edge Turnstile API
    try {
      const apiRes = (await turnstileApi.openGate({
        deviceId: options.deviceId,
        durationMs: pulseDuration,
        direction: options.direction ?? 'IN',
        reason: options.reason || 'Kiosk Biometric Attendance Verification',
      })) as { success?: boolean; status?: string; error?: string };

      if (apiRes?.success) {
        return {
          success: true,
          source: 'backend_api',
          message: 'Turniket qulfi muvaffaqiyatli ochildi',
        };
      } else if (apiRes?.status === 'EMERGENCY_LOCKDOWN') {
        return {
          success: false,
          source: 'backend_api',
          error: apiRes?.error || 'Turniket qulflangan (Xavfsizlik rejimi faol)',
        };
      }
    } catch (apiErr: unknown) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      errors.push(`API: ${msg}`);
    }

    // Protocol 3: Local Network LAN Relay fallback (e.g. Shelly / ESP8266 direct IP)
    if (typeof window !== 'undefined') {
      const localRelayUrl = localStorage.getItem('m_edu_turnstile_relay_url');
      if (localRelayUrl && /^https?:\/\//i.test(localRelayUrl)) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2000);
          await fetch(localRelayUrl, {
            method: 'POST',
            mode: 'no-cors',
            signal: controller.signal,
          });
          clearTimeout(timer);
          anySuccess = true;
        } catch {
          // Local IP fallback
        }
      }
    }

    if (anySuccess) {
      return {
        success: true,
        source: this.isUsbRelayConnected() ? 'web_serial' : 'direct_lan',
        message: 'Mahalliy apparat qulfi ochildi',
      };
    }

    return {
      success: false,
      source: 'backend_api',
      error: errors.join('; ') || 'Turniket signali yetib bormadi',
    };
  }

  /**
   * Set physical emergency lockdown or evacuation mode across all network turnstiles
   */
  public async setEmergencyMode(
    mode: TurnstileSecurityMode,
    reason?: string,
  ): Promise<{ success: boolean; mode: TurnstileSecurityMode; error?: string }> {
    try {
      const res = (await turnstileApi.setEmergencyMode({ mode, reason })) as {
        mode?: TurnstileSecurityMode;
      };
      return { success: true, mode: res?.mode || mode };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, mode, error: msg };
    }
  }

  /**
   * Fetch live emergency state from backend
   */
  public async getEmergencyMode(): Promise<TurnstileSecurityMode> {
    try {
      const res = (await turnstileApi.getEmergencyMode()) as {
        mode?: TurnstileSecurityMode;
      };
      return res?.mode || 'NORMAL';
    } catch {
      return 'NORMAL';
    }
  }
}

export const turnstileHardware = TurnstileHardwareManager.getInstance();
