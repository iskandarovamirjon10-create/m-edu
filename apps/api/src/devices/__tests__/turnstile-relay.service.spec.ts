import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TurnstileRelayService } from '../turnstile-relay.service';
import { TurnstileDeviceConfig } from '../turnstile-relay.interface';

describe('TurnstileRelayService', () => {
  let service: TurnstileRelayService;

  beforeEach(() => {
    service = new TurnstileRelayService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registers and retrieves devices correctly by organization', () => {
    const device1: TurnstileDeviceConfig = {
      id: 'gate-in-1',
      name: 'Main Entrance Turnstile',
      organizationId: 'org-1',
      protocol: 'MOCK',
      enabled: true,
      defaultPulseMs: 1200,
    };
    const device2: TurnstileDeviceConfig = {
      id: 'gate-out-1',
      name: 'Exit Turnstile',
      organizationId: 'org-2',
      protocol: 'MOCK',
      enabled: true,
    };

    service.registerDevice(device1);
    service.registerDevice(device2);

    expect(service.getDevice('gate-in-1')).toEqual(device1);
    expect(service.listDevices('org-1')).toEqual([device1]);
    expect(service.listDevices('org-2')).toEqual([device2]);
  });

  it('returns NO_DEVICE when no device is configured for organization', async () => {
    const result = await service.triggerPulse({
      organizationId: 'org-empty',
      direction: 'IN',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('NO_DEVICE');
    expect(result.error).toContain('No active turnstile relay device configured');
  });

  it('returns DISABLED when the target device is disabled', async () => {
    service.registerDevice({
      id: 'gate-disabled',
      name: 'Disabled Gate',
      organizationId: 'org-1',
      protocol: 'MOCK',
      enabled: false,
    });

    const result = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'gate-disabled',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('DISABLED');
    expect(result.error).toContain('disabled');
  });

  it('successfully executes a MOCK pulse', async () => {
    service.registerDevice({
      id: 'gate-mock-1',
      name: 'Mock Gate',
      organizationId: 'org-1',
      protocol: 'MOCK',
      enabled: true,
      defaultPulseMs: 1500,
    });

    const result = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'gate-mock-1',
      studentId: 'student-123',
      direction: 'IN',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PULSED');
    expect(result.deviceId).toBe('gate-mock-1');
  });

  it('enforces anti-burnout rate limiting when pulses arrive in quick succession', async () => {
    service.registerDevice({
      id: 'gate-rapid',
      name: 'Rapid Pulse Gate',
      organizationId: 'org-1',
      protocol: 'MOCK',
      enabled: true,
    });

    // First pulse succeeds
    const firstResult = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'gate-rapid',
    });
    expect(firstResult.success).toBe(true);
    expect(firstResult.status).toBe('PULSED');

    // Immediate second pulse must be rate-limited to protect the mechanical coil
    const secondResult = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'gate-rapid',
    });
    expect(secondResult.success).toBe(false);
    expect(secondResult.status).toBe('RATE_LIMITED');
    expect(secondResult.error).toContain('Rate limit active: minimum 1500ms interval');
  });

  it('successfully executes an HTTP_PULSE request to physical relay', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ison: true }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    service.registerDevice({
      id: 'shelly-relay-1',
      name: 'Shelly Pro 1 Gate',
      organizationId: 'org-1',
      protocol: 'HTTP_PULSE',
      endpointUrl: 'http://192.168.1.50/relay/0',
      authToken: 'secret-token-123',
      enabled: true,
      defaultPulseMs: 1000,
    });

    const result = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'shelly-relay-1',
      direction: 'IN',
      studentId: 'student-999',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('PULSED');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = fetchSpy.mock.calls[0];
    expect(calledUrl).toContain('http://192.168.1.50/relay/0?timer=1');
    expect(calledOptions.headers['Authorization']).toBe('Bearer secret-token-123');
    expect(JSON.parse(calledOptions.body)).toMatchObject({
      action: 'open',
      durationMs: 1000,
      direction: 'IN',
      studentId: 'student-999',
    });
  });

  it('handles HTTP error status safely without throwing', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });
    vi.stubGlobal('fetch', fetchSpy);

    service.registerDevice({
      id: 'shelly-failing',
      name: 'Offline Relay',
      organizationId: 'org-1',
      protocol: 'HTTP_PULSE',
      endpointUrl: 'http://192.168.1.55/relay/0',
      enabled: true,
    });

    const result = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'shelly-failing',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('503');
  });

  it('prevents cross-tenant device pulse (tenant boundary enforcement)', async () => {
    service.registerDevice({
      id: 'foreign-gate',
      name: 'Tenant B Gate',
      organizationId: 'org-2',
      protocol: 'MOCK',
      enabled: true,
    });

    const result = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'foreign-gate',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('NO_DEVICE');
    expect(result.error).toContain('No active turnstile relay device configured');
  });

  it('handles timeout when relay controller does not respond within deadline', async () => {
    const fetchSpy = vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    vi.stubGlobal('fetch', fetchSpy);

    service.registerDevice({
      id: 'relay-timeout',
      name: 'Laggy Relay',
      organizationId: 'org-1',
      protocol: 'HTTP_PULSE',
      endpointUrl: 'http://192.168.1.99/pulse',
      enabled: true,
    });

    const result = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'relay-timeout',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('timed out after 3000ms');
  });

  it('handles connection failures and resets lock to allow retries', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchSpy);

    service.registerDevice({
      id: 'relay-conn-refused',
      name: 'Unreachable Relay',
      organizationId: 'org-1',
      protocol: 'HTTP_PULSE',
      endpointUrl: 'http://192.168.1.105/pulse',
      enabled: true,
    });

    const result1 = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'relay-conn-refused',
    });

    expect(result1.success).toBe(false);
    expect(result1.status).toBe('FAILED');

    // Immediate second call should attempt again rather than being RATE_LIMITED
    const result2 = await service.triggerPulse({
      organizationId: 'org-1',
      deviceId: 'relay-conn-refused',
    });

    expect(result2.status).toBe('FAILED');
    expect(result2.status).not.toBe('RATE_LIMITED');
  });

  it('manages emergency modes: blocks pulses in LOCKDOWN mode', async () => {
    service.registerDevice({
      id: 'gate-lockdown',
      name: 'Security Gate',
      organizationId: 'org-lock',
      protocol: 'MOCK',
      enabled: true,
    });

    expect(service.getEmergencyMode('org-lock').mode).toBe('NORMAL');

    await service.setEmergencyMode('org-lock', 'LOCKDOWN', 'Code Red Intruder Alert', 'user-admin-1');
    expect(service.getEmergencyMode('org-lock').mode).toBe('LOCKDOWN');
    expect(service.getEmergencyMode('org-lock').reason).toBe('Code Red Intruder Alert');

    const result = await service.triggerPulse({
      organizationId: 'org-lock',
      deviceId: 'gate-lockdown',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('EMERGENCY_LOCKDOWN');
    expect(result.error).toContain('Physical gate locked: security lockdown');

    // Reverting to NORMAL re-enables pulses
    await service.setEmergencyMode('org-lock', 'NORMAL', 'Threat Cleared', 'user-admin-1');
    expect(service.getEmergencyMode('org-lock').mode).toBe('NORMAL');

    const normalResult = await service.triggerPulse({
      organizationId: 'org-lock',
      deviceId: 'gate-lockdown',
    });
    expect(normalResult.success).toBe(true);
    expect(normalResult.status).toBe('PULSED');
  });

  it('triggers evacuation pulse to all devices during EVACUATION', async () => {
    const pulseSpy = vi.spyOn(service, 'triggerPulse');

    service.registerDevice({
      id: 'gate-evac-1',
      name: 'Exit Gate 1',
      organizationId: 'org-evac',
      protocol: 'MOCK',
      enabled: true,
    });
    service.registerDevice({
      id: 'gate-evac-2',
      name: 'Exit Gate 2',
      organizationId: 'org-evac',
      protocol: 'MOCK',
      enabled: true,
    });

    await service.setEmergencyMode('org-evac', 'EVACUATION', 'Fire alarm triggered');

    expect(service.getEmergencyMode('org-evac').mode).toBe('EVACUATION');
    expect(pulseSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-evac',
        direction: 'OUT',
        pulseMs: 15000,
      }),
    );
  });

  it('diagnoses and tests hardware relay connection', async () => {
    service.registerDevice({
      id: 'test-mock-gate',
      name: 'Diagnose Gate',
      organizationId: 'org-diag',
      protocol: 'MOCK',
      enabled: true,
    });

    const result = await service.testDevice('test-mock-gate', 'org-diag');
    expect(result.online).toBe(true);
    expect(result.protocol).toBe('MOCK');
    expect(result.message).toContain('Mock relay controller ready');

    const notFound = await service.testDevice('non-existent', 'org-diag');
    expect(notFound.online).toBe(false);
  });
});
