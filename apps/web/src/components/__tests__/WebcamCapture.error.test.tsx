/**
 * Regression tests for WebcamCapture (F-CAM-001 / F-CAM-002 / F-ERR-001).
 *
 * CONTRACT UNDER TEST (mobile camera repair):
 *  1. A camera failure NEVER renders raw exception text (e.g. "Cannot read
 *     properties of undefined (reading 'getUserMedia')") — only safe,
 *     actionable messages.
 *  2. "No camera was found" is reserved for actual hardware absence. A missing
 *     MediaDevices API (old browser) and an insecure origin (http:// on a
 *     phone) must be reported as *those* problems — this was the exact
 *     false-negative users saw on mobile.
 *  3. `getUserMedia` is never called before the user grants consent: the UI
 *     shows a permission panel with an explicit "Allow camera" action first.
 *  4. A device id saved on another device (e.g. a desktop webcam) must never
 *     fail the flow — constraints are `ideal`, so the browser degrades to the
 *     default camera instead of throwing OverconstrainedError.
 *  5. A stream that resolves after unmount/mode-switch has its tracks stopped.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebcamCapture } from '../WebcamCapture';

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

/** A stream whose video track behaves like a real MediaStreamTrack. */
function fakeStream() {
  const stop = vi.fn();
  const track = {
    kind: 'video',
    readyState: 'live' as MediaStreamTrackState,
    stop,
    onended: null as null | (() => void),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track, stop };
}

/** DOMException-shaped OverconstrainedError (jsdom has no such constructor). */
function overconstrained(constraint = 'deviceId'): Error {
  const error = new Error(`Constraint not satisfied: ${constraint}`);
  error.name = 'OverconstrainedError';
  return error;
}

describe('WebcamCapture — camera failure safety (mobile contract)', () => {
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
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  function setMediaDevices(value: unknown) {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value,
      writable: true,
    });
  }

  it('reports a missing MediaDevices API as browser support — never as missing hardware', async () => {
    setMediaDevices(undefined);

    render(<WebcamCapture onCapture={vi.fn()} />);

    const alert = await screen.findByText(/does not support camera access/i);
    // The old behaviour claimed "No camera was found on this device." here,
    // which is what phone users saw before the browser was ever asked.
    expect(alert.textContent).not.toMatch(/no camera was found/i);
    expect(alert.textContent).not.toMatch(/cannot read properties/i);
    expect(alert.textContent).not.toMatch(/undefined/i);
  });

  it('reports an insecure origin as an HTTPS problem — never as missing hardware', async () => {
    setMediaDevices(undefined);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
      writable: true,
    });

    render(<WebcamCapture onCapture={vi.fn()} />);

    const alert = await screen.findByText(/secure connection \(HTTPS\)/i);
    expect(alert.textContent).not.toMatch(/no camera was found/i);
    expect(alert.textContent).not.toMatch(/undefined/i);
  });

  it('does not call getUserMedia until the user grants consent, then reports denial accurately', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    setMediaDevices({ getUserMedia });

    render(<WebcamCapture onCapture={vi.fn()} />);

    // 1. Permission-first UI — no browser prompt before an explicit gesture.
    const allow = await screen.findByRole('button', { name: /allow camera/i });
    expect(getUserMedia).not.toHaveBeenCalled();

    // 2. The tap is what triggers the browser permission request.
    await userEvent.click(allow);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    // 3. Denial is explained with settings guidance, not "not found".
    const alert = await screen.findByText(/camera access was denied/i);
    expect(alert.textContent).not.toMatch(/no camera was found/i);
    expect(alert.textContent).not.toMatch(/undefined/i);
    expect(await screen.findByText(/browser site settings/i)).toBeInTheDocument();
  });

  it('recovers from a stale saved device id instead of failing with "camera not found"', async () => {
    // Simulates a phone where localStorage still holds a DESKTOP camera id.
    window.localStorage.setItem('medu_face_camera_device', 'desktop-webcam-id');
    const { stream } = fakeStream();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(overconstrained('deviceId'))
      .mockResolvedValueOnce(stream);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    render(<WebcamCapture onCapture={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /allow camera/i }));

    // The constraint ladder retried with looser constraints…
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));

    // …and no attempt ever required an exact device match.
    for (const call of getUserMedia.mock.calls) {
      const video = (call[0] as MediaStreamConstraints).video;
      expect(video).not.toEqual({ deviceId: { exact: 'desktop-webcam-id' } });
      expect(JSON.stringify(video)).not.toContain('"exact"');
    }

    expect(screen.queryByText(/no camera was found/i)).not.toBeInTheDocument();
  });

  it('explains a busy camera with retry instead of a bogus hardware message', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('busy'), { name: 'NotReadableError' }));
    setMediaDevices({ getUserMedia });

    render(<WebcamCapture onCapture={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /allow camera/i }));

    const alert = await screen.findByText(/already in use by another application/i);
    expect(alert.textContent).not.toMatch(/no camera was found/i);
    expect(screen.getByRole('button', { name: /retry|qayta urinish/i })).toBeInTheDocument();
  });

  it('stops a stream that resolves after unmount (camera must not stay on)', async () => {
    const d = deferred();
    const getUserMedia = vi.fn().mockReturnValue(d.promise);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const { unmount } = render(<WebcamCapture onCapture={vi.fn()} />);

    // Consent, then unmount while the browser prompt is still open.
    await userEvent.click(await screen.findByRole('button', { name: /allow camera/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    unmount();

    const { stream, stop } = fakeStream();
    await act(async () => {
      d.resolve(stream); // late resolution AFTER unmount
      await d.promise.catch(() => undefined);
    });

    expect(stop).toHaveBeenCalled();
  });

  it('stops a stream that resolves after the user switches to file upload', async () => {
    const d = deferred();
    const getUserMedia = vi.fn().mockReturnValue(d.promise);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    render(<WebcamCapture onCapture={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: /allow camera/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

    // Leaving camera mode must release the hardware immediately.
    await userEvent.click(screen.getByRole('button', { name: /upload file|fayl yuklash/i }));

    const { stream, stop } = fakeStream();
    await act(async () => {
      d.resolve(stream);
      await d.promise.catch(() => undefined);
    });

    expect(stop).toHaveBeenCalled();
  });

  it('survives StrictMode double-mount without leaking a second camera', async () => {
    const { stream, stop } = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const { unmount } = render(
      <StrictMode>
        <WebcamCapture onCapture={vi.fn()} />
      </StrictMode>,
    );

    await userEvent.click(await screen.findByRole('button', { name: /allow camera/i }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    unmount();

    // Every stream obtained during the StrictMode cycle is released.
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });
});
