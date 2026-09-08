/**
 * Camera engine shared types.
 */

/** A single decoded video frame. */
export interface VideoFrame {
  /** Raw JPEG/raw pixel bytes */
  buffer: Buffer;
  /** Monotonic timestamp in ms when the frame was captured */
  timestamp: number;
}

/** Credentials for a camera stream (never logged). */
export interface CameraCredentials {
  username?: string;
  password?: string;
}

/** Connection probe result for RTSP/ONVIF providers. */
export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  errorCode?: string;
  deviceInfo?: Record<string, unknown>;
  profiles?: unknown[];
}

/** Discovered ONVIF device. */
export interface DiscoveredDevice {
  host: string;
  port: number;
  protocol: string;
  vendor?: string;
  model?: string;
  name?: string;
  xAddr?: string;
  profiles?: unknown[];
}

/** Ingester configuration. */
export interface StreamIngesterConfig {
  cameraId: string;
  streamUri: string;
  fps: number;
  transport: 'tcp' | 'udp';
}
