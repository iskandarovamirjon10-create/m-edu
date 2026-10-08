/**
 * useCamera — lifecycle invariants that the WebcamCapture component tests
 * cannot drive deterministically (concurrent acquisitions, consent gating,
 * silent re-entry, device switching).
 *
 * These cover the resource-safety half of the mobile camera repair:
 *   · never two live cameras
 *   · never a prompt without an explicit user gesture (unless permission was
 *     already granted on this device)
 *   · every stream released on stop
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCamera } from '../useCamera';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Deferred = {
  promise: Promise<MediaStream>;
  resolve: (s: MediaStream) => void;
  reject: (e: unknown) => void;
};

function deferred(): Deferred {
  let resolve!: (s: MediaStream) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<MediaStream>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeStream(id = 'stream') {
  const stop = vi.fn();
  const track = {
    kind: 'video',
    readyState: 'live' as MediaStreamTrackState,
    stop,
    onended: null as null | (() => void),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    id,
  };
  const stream = {
    id,
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track, stop };
}

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value,
    writable: true,
  });
}

describe('useCamera — acquisition lifecycle', () => {
  const originalMediaDevices = navigator.mediaDevices;

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
      writable: true,
    });
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('requires explicit consent before asking the browser for a camera', async () => {
    const { stream } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const { result, unmount } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.status).toBe('needs-permission'));

    expect(getUserMedia).not.toHaveBeenCalled();

    await act(async () => {
      result.current.requestPermission();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('auto-starts silently when a stream was already granted on this device', async () => {
    // Safari has no Permissions API, so the granted hint is what keeps repeat
    // visits prompt-free.
    window.localStorage.setItem('medu_face_camera_device.granted', '1');
    const { stream } = fakeStream('a');
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const { result, unmount } = renderHook(() => useCamera());

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe('starting');
    unmount();
  });

  it('releases the superseded stream when two acquisitions overlap', async () => {
    const first = deferred();
    const second = deferred();
    const getUserMedia = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const { result, unmount } = renderHook(() => useCamera({ autoStart: false }));

    await act(async () => {
      result.current.requestPermission();
    });
    await act(async () => {
      result.current.requestPermission();
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);

    const current = fakeStream('current');
    const stale = fakeStream('stale');

    await act(async () => {
      second.resolve(current.stream);
      await second.promise.catch(() => undefined);
    });
    await act(async () => {
      first.resolve(stale.stream); // resolves AFTER it was superseded
      await first.promise.catch(() => undefined);
    });

    expect(stale.stop).toHaveBeenCalled();
    expect(current.stop).not.toHaveBeenCalled();
    unmount();
  });

  it('stops every track on stop() and returns to idle', async () => {
    const { stream, stop } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const { result, unmount } = renderHook(() => useCamera());
    await act(async () => {
      result.current.requestPermission();
    });
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

    act(() => {
      result.current.stop();
    });

    expect(stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.failure).toBeNull();
    unmount();
  });

  it('stops every track when the component unmounts with a live stream', async () => {
    const { stream, stop } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const { result, unmount } = renderHook(() => useCamera());
    await act(async () => {
      result.current.requestPermission();
    });
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('releases the previous camera before starting the requested one', async () => {
    const prev = fakeStream('prev');
    const next = fakeStream('next');
    const getUserMedia = vi.fn().mockResolvedValueOnce(prev.stream).mockResolvedValueOnce(next.stream);
    setMediaDevices({
      getUserMedia,
      enumerateDevices: vi
        .fn()
        .mockResolvedValue([
          { kind: 'videoinput', deviceId: 'cam-a', label: 'Front camera' },
          { kind: 'videoinput', deviceId: 'cam-b', label: 'Back camera' },
        ]),
    });

    const { result, unmount } = renderHook(() => useCamera());
    await act(async () => {
      result.current.requestPermission();
    });
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.devices.length).toBe(2));

    await act(async () => {
      result.current.selectDevice('cam-b');
    });

    expect(prev.stop).toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('reports an insecure origin without ever prompting', async () => {
    const getUserMedia = vi.fn();
    setMediaDevices({ getUserMedia });
    const original = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false, writable: true });

    const { result, unmount } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.failure?.reason).toBe('insecure-context');
    expect(getUserMedia).not.toHaveBeenCalled();

    if (original) Object.defineProperty(window, 'isSecureContext', original);
    unmount();
  });
});
