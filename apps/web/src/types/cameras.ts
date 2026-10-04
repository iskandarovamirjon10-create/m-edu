/**
 * Camera module domain models.
 */

export type CameraProtocol = 'RTSP' | 'ONVIF';

export type CameraStatus =
  | 'CONFIGURED'
  | 'CONNECTING'
  | 'ONLINE'
  | 'ERROR'
  | 'DISABLED'
  | 'RECONNECTING';

export interface Camera {
  id: string;
  organizationId: string;
  name: string;
  vendor?: string | null;
  model?: string | null;
  protocol: CameraProtocol;
  host: string;
  port: number;
  streamPath?: string | null;
  location?: string | null;
  enabled: boolean;
  recognitionEnabled: boolean;
  attendanceEnabled: boolean;
  status: string;
  lastSeenAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  /** Security notice: credentials are kept server-side in CredentialVault; only a boolean flag is returned. */
  credentialConfigured: boolean;
}
