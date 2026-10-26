export type RelayProtocol = 'HTTP_PULSE' | 'TCP_SOCKET' | 'MQTT' | 'MOCK';

export interface TurnstileDeviceConfig {
  id: string;
  name: string;
  organizationId: string;
  protocol: RelayProtocol;
  endpointUrl?: string;
  host?: string;
  port?: number;
  authToken?: string;
  defaultPulseMs?: number;
  enabled: boolean;
}

export interface PulseRelayOptions {
  deviceId?: string;
  organizationId: string;
  studentId?: string;
  direction?: 'IN' | 'OUT';
  pulseMs?: number;
  reason?: string;
}

export interface PulseRelayResult {
  success: boolean;
  deviceId?: string;
  durationMs: number;
  executedAt: Date;
  status: 'PULSED' | 'RATE_LIMITED' | 'DISABLED' | 'FAILED' | 'NO_DEVICE';
  error?: string;
}
