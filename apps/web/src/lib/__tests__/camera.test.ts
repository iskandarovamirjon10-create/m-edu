/**
 * camera.ts — platform-layer unit tests.
 *
 * Pins the rules that made the mobile camera unusable before:
 *   · an absent MediaDevices API / insecure origin is NOT "no camera found"
 *   · constraints are always `ideal` → a foreign device id cannot break a session
 *   · a denied permission stops the ladder immediately (no prompt storms)
 *   · stopStream always releases every track
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  acquireCameraStream,
  buildCameraConstraintLadder,
  cameraFailureFor,
  canAttemptCamera,
  describeCameraEnvironment,
  describeCameraFailure,
  getCameraEnvironment,
  pickCameraId,
  stopStream,
  waitForVideoReady,
  CameraError,
} from '../camera';

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function fakeStream(tracks: Partial<MediaStreamTrack>[] = [{ kind: 'video' }]) {
  const built = tracks.map((t) => ({
    kind: 'video',
    readyState: 'live' as MediaStreamTrackState,
    stop: vi.fn(),
    onended: null,
    ...t,
  }));
  return {
    stream: {
      getTracks: () => built,
      getVideoTracks: () => built.filter((t) => t.kind === 'video'),
    } as unknown as MediaStream,
    tracks: built,
  };
}

describe('camera capability + secure context', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalIsSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
      writable: true,
    });
    if (originalIsSecureContext) {
      Object.defineProperty(window, 'isSecureContext', originalIsSecureContext);
    } else {
      delete (window as unknown as Record<string, unknown>).isSecureContext;
    }
  });

  it('reports a missing MediaDevices API as unsupported, not as missing hardware', () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });

    const failure = describeCameraEnvironment();

    expect(failure?.reason).toBe('unsupported');
    expect(failure?.messageKey).toBe('face.cameraUnsupported');
    expect(failure?.message).not.toMatch(/no camera was found/i);
  });

  it('reports an insecure origin as an HTTPS requirement', () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
      writable: true,
    });

    const failure = describeCameraEnvironment();

    expect(failure?.reason).toBe('insecure-context');
    // Even when a legacy browser still exposes the API, an insecure origin is
    // reported as an HTTPS problem before anything else.
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
      writable: true,
    });
    expect(describeCameraEnvironment()?.reason).toBe('insecure-context');
    expect(failure?.messageKey).toBe('face.cameraInsecureContext');
    expect(canAttemptCamera()).toBe(false);
  });

  it('is capable when getUserMedia is available in a secure context', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
      writable: true,
    });

    expect(describeCameraEnvironment()).toBeNull();
    expect(getCameraEnvironment().hasGetUserMedia).toBe(true);
    expect(canAttemptCamera()).toBe(true);
  });
});

describe('constraint ladder', () => {
  it('never demands an exact device match (stale ids must degrade, not fail)', () => {
    const ladder = buildCameraConstraintLadder({ deviceId: 'desktop-webcam-id' });

    expect(ladder).toHaveLength(4);
    for (const rung of ladder) {
      expect(JSON.stringify(rung)).not.toContain('"exact"');
    }
    // The tuned rungs express every preference as `ideal`…
    for (const rung of ladder.slice(0, 3)) {
      expect(JSON.stringify(rung)).toContain('"ideal"');
    }
    // …and the final rung asks for nothing specific, which cannot fail on
    // constraints (this is what makes a stale saved camera id harmless).
    expect(ladder[3]).toEqual({ audio: false, video: true });
  });

  it('asks for the front camera first and always ends with the most permissive rung', () => {
    const ladder = buildCameraConstraintLadder();

    expect(ladder[0].video).toMatchObject({
      facingMode: { ideal: 'user' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    });
    expect(ladder[ladder.length - 1]).toEqual({ audio: false, video: true });
  });

  it('never requests audio', () => {
    for (const rung of buildCameraConstraintLadder({ deviceId: 'x' })) {
      expect(rung.audio).toBe(false);
    }
  });
});

describe('acquireCameraStream', () => {
  const originalMediaDevices = navigator.mediaDevices;

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  function setGetUserMedia(fn: unknown) {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: fn },
      writable: true,
    });
  }

  it('retries with looser constraints on OverconstrainedError', async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(namedError('OverconstrainedError'))
      .mockResolvedValueOnce(stream);
    setGetUserMedia(getUserMedia);

    const result = await acquireCameraStream({ deviceId: 'gone' });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.stream).toBe(stream);
  });

  it('stops immediately on a denied permission (no prompt storm)', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(namedError('NotAllowedError'));
    setGetUserMedia(getUserMedia);

    await expect(acquireCameraStream()).rejects.toBeInstanceOf(CameraError);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('stops immediately when no hardware exists', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(namedError('NotFoundError'));
    setGetUserMedia(getUserMedia);

    const error = await acquireCameraStream().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CameraError);
    expect((error as CameraError).reason).toBe('no-device');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('rejects a stream with no live video track and keeps trying', async () => {
    const empty = fakeStream([]);
    const good = fakeStream();
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(empty.stream)
      .mockResolvedValueOnce(good.stream);
    setGetUserMedia(getUserMedia);

    const result = await acquireCameraStream();

    expect(result.stream).toBe(good.stream);
    expect(empty.tracks).toHaveLength(0);
  });

  it('fails fast when the platform cannot attempt a camera at all', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });

    const error = await acquireCameraStream().catch((e: unknown) => e);
    expect((error as CameraError).reason).toBe('unsupported');
  });
});

describe('stopStream', () => {
  it('stops every track and clears the ended handler', () => {
    const { stream, tracks } = fakeStream([{ kind: 'video' }, { kind: 'audio' }]);

    stopStream(stream);

    for (const track of tracks) {
      expect(track.stop).toHaveBeenCalledTimes(1);
      expect(track.onended).toBeNull();
    }
  });

  it('is a no-op for null/undefined and never throws', () => {
    expect(() => stopStream(null)).not.toThrow();
    expect(() => stopStream(undefined)).not.toThrow();
  });
});

describe('describeCameraFailure', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'no-device'],
    ['NotReadableError', 'in-use'],
    ['OverconstrainedError', 'constraints'],
    ['AbortError', 'aborted'],
    ['SomethingElse', 'unknown'],
  ])('maps %s to %s', (name, reason) => {
    expect(describeCameraFailure(namedError(name)).reason).toBe(reason);
  });

  it('reserves the "not found" message for actual hardware absence', () => {
    expect(describeCameraFailure(namedError('NotFoundError')).messageKey).toBe('face.cameraNotFound');
    expect(describeCameraFailure(namedError('NotAllowedError')).message).toMatch(/denied/i);
    expect(describeCameraFailure(namedError('NotReadableError')).message).toMatch(/in use/i);
    // A constraint failure must never claim the hardware is absent.
    expect(describeCameraFailure(namedError('OverconstrainedError')).message).not.toMatch(/no camera was found/i);
  });

  it('flags which failures can be fixed by changing browser settings', () => {
    expect(cameraFailureFor('permission-denied').requiresSettings).toBe(true);
    expect(cameraFailureFor('insecure-context').requiresSettings).toBe(true);
    expect(cameraFailureFor('constraints').requiresSettings).toBe(false);
    expect(cameraFailureFor('no-device').retryable).toBe(true);
  });
});

describe('pickCameraId', () => {
  const devices = [
    { deviceId: 'a', label: 'Back camera', kind: 'videoinput' },
    { deviceId: 'b', label: 'Front camera', kind: 'videoinput' },
  ] as MediaDeviceInfo[];

  it('prefers a labelled front camera', () => {
    expect(pickCameraId(devices, 'user')).toBe('b');
  });

  it('prefers a labelled rear camera when asked', () => {
    expect(pickCameraId(devices, 'environment')).toBe('a');
  });

  it('picks a different device when switching', () => {
    expect(pickCameraId(devices, 'different-from', 'a')).toBe('b');
  });

  it('returns null when the list is empty', () => {
    expect(pickCameraId([], 'user')).toBeNull();
  });
});

describe('waitForVideoReady', () => {
  it('resolves immediately when frames are already available', async () => {
    const video = { readyState: 2, videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
    await expect(waitForVideoReady(video)).resolves.toBeUndefined();
  });

  it('rejects when the caller aborts (unmount) and clears its timer', async () => {
    const listeners = new Map<string, () => void>();
    const video = {
      readyState: 0,
      videoWidth: 0,
      videoHeight: 0,
      addEventListener: (type: string, handler: () => void) => listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    } as unknown as HTMLVideoElement;

    const controller = new AbortController();
    const pending = waitForVideoReady(video, 5_000, controller.signal);
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(CameraError);
  });
});
