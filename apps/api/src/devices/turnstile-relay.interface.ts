export type RelayProtocol = 'HTTP_PULSE' | 'TCP_SOCKET' | 'IPC_SOCKET' | 'MQTT' | 'MOCK';

export type TurnstileEmergencyMode = 'NORMAL' | 'EVACUATION' | 'LOCKDOWN';

export interface EmergencyModeState {
  mode: TurnstileEmergencyMode;
  reason?: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface DeviceTestResult {
  deviceId: string;
  online: boolean;
  latencyMs: number;
  protocol: RelayProtocol;
  message?: string;
}

export interface TurnstileDeviceConfig {
  id: string;
  name: string;
  organizationId: string;
  protocol: RelayProtocol;
  endpointUrl?: string;
  host?: string;
  port?: number;
  ipcPath?: string;
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
  status: 'PULSED' | 'RATE_LIMITED' | 'DISABLED' | 'FAILED' | 'NO_DEVICE' | 'EMERGENCY_LOCKDOWN';
  error?: string;
}
