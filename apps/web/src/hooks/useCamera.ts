/**
 * ============================================================================
 * M-EDU · useCamera — mobile-first camera lifecycle hook
 * ============================================================================
 *
 * Owns the full contract for a `<video>`-backed camera:
 *
 *   probe environment → probe permission → (explicit tap) getUserMedia →
 *   attach stream → wait for real frames → ready → capture → stop/cleanup
 *
 * Guarantees
 *   · Never reports "no camera" without first attempting permission.
 *   · Never silently starts a stream the user did not consent to.
 *   · Never leaves two live cameras (old stream stopped before a new one).
 *   · Never leaves a camera on after stop/unmount/route change.
 *   · Stable `start`/`stop` identities → safe in effect dependency arrays.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireCameraStream,
  describeCameraEnvironment,
  describeCameraFailure,
  listVideoInputs,
  pickCameraId,
  queryCameraPermission,
  safePlay,
  stopStream,
  waitForVideoReady,
  type CameraAcquireOptions,
  type CameraFailure,
  type CameraPermissionState,
} from '@/lib/camera';

export type CameraStatus =
  /** Nothing requested yet. */
  | 'idle'
  /** Inspecting capability + permission state (no prompt yet). */
  | 'probing'
  /** Platform is fine, the user must grant access — show "Allow camera". */
  | 'needs-permission'
  /** The user tapped allow and `getUserMedia` is in flight. */
  | 'requesting'
  /** Stream acquired; waiting for the first real frames. */
  | 'starting'
  /** Frames are flowing — capture is safe. */
  | 'ready'
  /** Blocked or failed; `failure` explains why and whether retry helps. */
  | 'error';

export interface CaptureFrameOptions {
  mirrored?: boolean;
  quality?: number;
  /** Downscale the long edge before encoding (mobile bandwidth). */
  maxEdge?: number;
}

export interface CapturedFrame {
  base64: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface UseCameraOptions {
  /** Probe and auto-start only when permission is ALREADY granted. */
  autoStart?: boolean;
  facingMode?: 'user' | 'environment';
  /** localStorage key holding the preferred camera id. */
  storageKey?: string;
}

export interface UseCameraResult {
  status: CameraStatus;
  failure: CameraFailure | null;
  permission: CameraPermissionState;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  canSwitchCamera: boolean;
  /** True while frames are flowing. */
  isActive: boolean;
  /** Begin probing + (when permitted) acquiring. */
  start: () => void;
  /** Explicit user gesture — requests permission and acquires. */
  requestPermission: () => void;
  /** Stop tracks and detach from the video element. */
  stop: () => void;
  /** Retry after a failure. */
  retry: () => void;
  selectDevice: (deviceId: string) => void;
  switchCamera: () => void;
  /** Callback ref for the `<video>` element. */
  setVideoElement: (el: HTMLVideoElement | null) => void;
  /** Grab a JPEG frame from the live stream (null when not ready). */
  captureFrame: (options?: CaptureFrameOptions) => CapturedFrame | null;
}

function readStoredDeviceId(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStoredDeviceId(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode / storage disabled — the picker still works this session */
  }
}

/**
 * "We already obtained a stream on this device" hint.
 *
 * Safari has no `camera` permission descriptor, so the Permissions API always
 * answers 'unknown'. Without this hint iOS users would have to tap "Allow
 * camera" on every single visit. A silent retry is safe: if permission was
 * revoked, `getUserMedia` rejects immediately and the browser shows no prompt.
 */
function readGrantedHint(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`${key}.granted`) === '1';
  } catch {
    return false;
  }
}

function writeGrantedHint(key: string, granted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (granted) window.localStorage.setItem(`${key}.granted`, '1');
    else window.localStorage.removeItem(`${key}.granted`);
  } catch {
    /* ignore */
  }
}

export function useCamera(options: UseCameraOptions = {}): UseCameraResult {
  const { autoStart = true, facingMode = 'user', storageKey = 'medu_face_camera_device' } = options;

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [failure, setFailure] = useState<CameraFailure | null>(null);
  const [permission, setPermission] = useState<CameraPermissionState>('unknown');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() =>
    readStoredDeviceId(storageKey),
  );
  const [streamVersion, setStreamVersion] = useState(0);

  const [videoElement, setVideoElementState] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Monotonic token: any in-flight acquisition with a stale token is dropped. */
  const generationRef = useRef(0);
  const deviceIdRef = useRef<string>(selectedDeviceId);
  const facingRef = useRef<'user' | 'environment'>(facingMode);
  const statusRef = useRef<CameraStatus>('idle');
  const intentionalStopRef = useRef(false);

  statusRef.current = status;

  /* ── Device list (post-permission only) ───────────────────────────────── */

  const refreshDevices = useCallback(async () => {
    const list = await listVideoInputs();
    setDevices(list);

    // A device id saved on another device (e.g. a desktop webcam) is not a
    // failure — it simply is not here. Forget it so the next start is clean.
    const stored = deviceIdRef.current;
    if (stored && !list.some((device) => device.deviceId === stored)) {
      deviceIdRef.current = '';
      setSelectedDeviceId('');
      writeStoredDeviceId(storageKey, '');
    }
  }, [storageKey]);

  /* ── stop: release everything ─────────────────────────────────────────── */

  const stop = useCallback(() => {
    generationRef.current += 1; // invalidate any in-flight acquisition
    intentionalStopRef.current = true;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        /* restricted browsers / jsdom */
      }
    }
    setStatus('idle');
    setFailure(null);
  }, []);

  /* ── start: acquire + attach (no prompt when permission is not granted) ─ */

  const begin = useCallback(
    (announced: boolean) => {
      const token = (generationRef.current += 1);
      const isStale = () => generationRef.current !== token;

      setFailure(null);
      if (announced) setStatus('requesting');
      else setStatus('starting');
      intentionalStopRef.current = false;

      void (async () => {
        // A. capability + B. secure context — no prompt is possible if these fail.
        const envFailure = describeCameraEnvironment();
        if (envFailure) {
          if (isStale()) return;
          setFailure(envFailure);
          setStatus('error');
          return;
        }

        try {
          const acquireOptions: CameraAcquireOptions = {
            deviceId: deviceIdRef.current || null,
            facingMode: facingRef.current,
          };
          const { stream } = await acquireCameraStream(acquireOptions);

          if (isStale()) {
            // Unmounted / superseded while the prompt was open — release it.
            stopStream(stream);
            return;
          }

          // Exactly one live camera, ever.
          stopStream(streamRef.current);
          streamRef.current = stream;
          setStatus('starting');
          setStreamVersion((version) => version + 1);
          writeGrantedHint(storageKey, true);

          void refreshDevices();
          void queryCameraPermission().then((state) => {
            if (!isStale()) setPermission(state);
          });
        } catch (error) {
          if (isStale()) return;
          const described = describeCameraFailure(error);
          setFailure(described);
          setStatus('error');
          if (described.reason === 'permission-denied') {
            setPermission('denied');
            writeGrantedHint(storageKey, false);
          }
          if (described.reason === 'insecure-context') setPermission('unknown');
        }
      })();
    },
    [refreshDevices, storageKey],
  );

  /**
   * Probe without prompting: if the browser tells us permission is already
   * granted we start immediately; otherwise the UI shows a "Allow camera"
   * action so `getUserMedia` is called from a real user gesture (which is also
   * what iOS Safari prefers).
   */
  const start = useCallback(() => {
    const token = (generationRef.current += 1);
    const isStale = () => generationRef.current !== token;

    setFailure(null);
    setStatus('probing');

    void (async () => {
      const envFailure = describeCameraEnvironment();
      if (isStale()) return;
      if (envFailure) {
        setFailure(envFailure);
        setStatus('error');
        return;
      }

      const state = await queryCameraPermission();
      if (isStale()) return;
      setPermission(state);

      if (state === 'denied') {
        setFailure(describeCameraFailure('permission-denied'));
        setStatus('error');
        return;
      }

      if (state === 'granted') {
        begin(false);
        return;
      }

      if (state === 'unknown' && readGrantedHint(storageKey)) {
        // Permissions API cannot tell us (Safari) but we have succeeded here
        // before — attempt silently. A revoked permission rejects immediately
        // without showing a prompt, and the error state explains it.
        begin(false);
        return;
      }

      // 'prompt' | 'unknown' — ask the user for consent explicitly.
      setStatus('needs-permission');
    })();
  }, [begin, storageKey]);

  const requestPermission = useCallback(() => {
    setPermission('prompt');
    begin(true);
  }, [begin]);

  const retry = useCallback(() => {
    begin(false);
  }, [begin]);

  /* ── Attach stream → video element, wait for real frames ──────────────── */

  useEffect(() => {
    if (streamVersion === 0) return;
    const video = videoElement;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    const controller = new AbortController();
    try {
      if (video.srcObject !== stream) video.srcObject = stream;
    } catch {
      /* some environments expose a read-only srcObject */
    }
    void safePlay(video);

    const track = stream.getVideoTracks()[0];
    const onEnded = () => {
      if (cancelled || intentionalStopRef.current) return;
      // The OS/browser revoked the camera (backgrounded tab, another app
      // grabbed it, permission revoked). Surface it accurately — the user can
      // retry without a new prompt.
      setFailure(describeCameraFailure('in-use'));
      setStatus('error');
      stopStream(streamRef.current);
      streamRef.current = null;
    };
    track?.addEventListener('ended', onEnded);

    waitForVideoReady(video, 8_000, controller.signal)
      .then(() => {
        if (cancelled || streamRef.current !== stream) return;
        setStatus('ready');
        setFailure(null);
      })
      .catch((error: unknown) => {
        // An abort is our own cleanup (unmount / stream switch) — not a fault.
        if (cancelled || streamRef.current !== stream || controller.signal.aborted) return;
        setFailure(describeCameraFailure(error));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
      track?.removeEventListener('ended', onEnded);
    };
  }, [streamVersion, videoElement]);

  /* ── Callback ref: attach as soon as the element exists ───────────────── */

  const setVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideoElementState(el);
  }, []);

  /* ── Auto probe on mount / when autoStart flips on ────────────────────
   *
   * This effect is deliberately RE-RUNNABLE rather than guarded by a one-shot
   * ref. React 18 StrictMode (and any future offscreen/remount) runs
   * mount → cleanup → mount: a one-shot guard would swallow the second run
   * while the cleanup had already invalidated the in-flight probe, leaving the
   * UI stuck on "checking camera…" forever.
   */
  useEffect(() => {
    if (!autoStart) return;
    start();
  }, [autoStart, start]);

  /* ── Recover when the tab returns and the track died meanwhile ────────── */

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (statusRef.current !== 'ready' && statusRef.current !== 'starting') return;
      const stream = streamRef.current;
      const track = stream?.getVideoTracks()[0];
      if (!stream || !track || track.readyState === 'ended') {
        begin(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [begin]);

  /* ── Unmount (and StrictMode's simulated unmount): release the camera ──
   *
   * Bumping the generation invalidates any in-flight `getUserMedia` promise so
   * a stream that resolves after teardown is stopped immediately instead of
   * leaving the phone camera light on.
   */
  useEffect(
    () => () => {
      generationRef.current += 1;
      stopStream(streamRef.current);
      streamRef.current = null;
    },
    [],
  );

  /* ── Device switching ────────────────────────────────────────────────── */

  const selectDevice = useCallback(
    (nextDeviceId: string) => {
      deviceIdRef.current = nextDeviceId;
      setSelectedDeviceId(nextDeviceId);
      writeStoredDeviceId(storageKey, nextDeviceId);
      // Restart in place only if we already had a live camera.
      if (streamRef.current || statusRef.current === 'ready' || statusRef.current === 'starting') {
        begin(false);
      }
    },
    [begin, storageKey],
  );

  const switchCamera = useCallback(() => {
    const next = pickCameraId(devices, 'different-from', deviceIdRef.current || null);
    if (devices.length > 1 && next) {
      deviceIdRef.current = next;
      setSelectedDeviceId(next);
      writeStoredDeviceId(storageKey, next);
    } else {
      // Single-camera device: flip facingMode so the browser can pick another
      // physical camera if it has one.
      facingRef.current = facingRef.current === 'user' ? 'environment' : 'user';
      deviceIdRef.current = '';
      setSelectedDeviceId('');
      writeStoredDeviceId(storageKey, '');
    }
    begin(false);
  }, [begin, devices, storageKey]);

  /* ── Frame capture ───────────────────────────────────────────────────── */

  const captureFrame = useCallback((captureOptions: CaptureFrameOptions = {}): CapturedFrame | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

    const { mirrored = false, quality = 0.92, maxEdge } = captureOptions;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (maxEdge && Math.max(width, height) > maxEdge) {
      const scale = maxEdge / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (mirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const comma = dataUrl.indexOf(',');
    return {
      dataUrl,
      base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
      width,
      height,
    };
  }, []);

  return {
    status,
    failure,
    permission,
    devices,
    selectedDeviceId,
    canSwitchCamera: devices.length > 1,
    isActive: status === 'ready',
    start,
    requestPermission,
    stop,
    retry,
    selectDevice,
    switchCamera,
    setVideoElement,
    captureFrame,
  };
}
