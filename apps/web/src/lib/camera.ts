/**
 * ============================================================================
 * M-EDU · CAMERA PLATFORM LAYER
 * ============================================================================
 *
 * Single source of truth for "can this browser use a camera, may we use it,
 * and how do we obtain a stream without breaking on mobile".
 *
 * WHY THIS FILE EXISTS (root cause of the phone regression):
 *
 *   The previous acquisition path did:
 *     1. `navigator.mediaDevices?.getUserMedia` missing  → reported
 *        "No camera was found on this device." (wrong: the API can be absent
 *        because the page is not a secure context, or the browser is old).
 *     2. `{ deviceId: { exact: <id from localStorage> } }` — a device id saved
 *        on a DESKTOP (e.g. a Logitech webcam) is guaranteed to be absent on a
 *        phone, so `getUserMedia` rejected with `OverconstrainedError`, which
 *        was ALSO mapped to "No camera was found on this device."
 *     3. No permission state — a rejection was surfaced as the primary UI.
 *
 *   Contract implemented here (browser semantics, not wishful thinking):
 *     A.  capability check           → is the API even there?
 *     B.  secure-context check       → http:// on a LAN IP has no camera API
 *     C.  permission state probe     → Permissions API, best effort
 *     D.  `getUserMedia()` request   → the ONLY way to know a camera exists
 *     E.  attach stream to <video>   → after success, never before
 *     F.  wait for real frames       → never report "ready" before frames
 *     G.  stop every track          → on stop/unmount/route change
 *
 *   `enumerateDevices()` is used ONLY to build the camera picker AFTER a
 *   stream exists. It is never used to decide whether a camera exists —
 *   before permission, browsers intentionally hide device labels, and some
 *   Android browsers return an EMPTY list until permission is granted.
 *
 * Constraints are expressed with `ideal` (never `exact`) so that a stale or
 * foreign device id degrades to "use the default camera" instead of failing.
 */

/* ============================================================================
   TYPES
   ========================================================================== */

/** Why camera access is blocked. Drives copy, settings guidance and retry. */
export type CameraBlockReason =
  | 'unsupported' // no navigator.mediaDevices / getUserMedia in this browser
  | 'insecure-context' // API withheld because the page is not HTTPS/localhost
  | 'permission-denied' // user or browser policy said no
  | 'no-device' // genuinely no camera hardware
  | 'in-use' // hardware busy / OS-level failure
  | 'constraints' // no camera matched the requested settings (last-resort rung)
  | 'aborted' // start was interrupted (navigation, permission UI dismissed)
  | 'unknown';

export interface CameraEnvironment {
  isBrowser: boolean;
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
}

export type CameraPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface CameraFailure {
  reason: CameraBlockReason;
  /** i18n key; every dictionary has an English fallback. */
  messageKey: string;
  /** English fallback text — used when a dictionary entry is missing. */
  message: string;
  /** A plain retry can plausibly succeed. */
  retryable: boolean;
  /** The user must change a browser/OS setting; retrying changes nothing. */
  requiresSettings: boolean;
}

export interface CameraAcquireOptions {
  /** Preferred camera id. Always applied as `ideal`, never `exact`. */
  deviceId?: string | null;
  facingMode?: 'user' | 'environment';
  idealWidth?: number;
  idealHeight?: number;
}

export interface CameraAcquireResult {
  stream: MediaStream;
  constraints: MediaStreamConstraints;
  /** How many ladder rungs were consumed (1 = first attempt worked). */
  attempts: number;
}

/** Raw DOMException name → our reason. */
const REASON_BY_ERROR_NAME: Record<string, CameraBlockReason> = {
  NotAllowedError: 'permission-denied',
  PermissionDeniedError: 'permission-denied',
  SecurityError: 'permission-denied',
  NotFoundError: 'no-device',
  DevicesNotFoundError: 'no-device',
  NotReadableError: 'in-use',
  TrackStartError: 'in-use',
  AbortError: 'aborted',
  OverconstrainedError: 'constraints',
  ConstraintNotSatisfiedError: 'constraints',
  NotSupportedError: 'constraints', // unsupported constraint set → try a simpler rung
  TypeError: 'constraints', // malformed/unsupported constraint dict
};

/**
 * Errors that mean "loosening the constraints cannot help" — the acquisition
 * loop stops immediately and reports the failure instead of hammering the
 * hardware with three more `getUserMedia` calls (which on Android shows the
 * permission prompt/busy indicator repeatedly).
 */
const TERMINAL_REASONS = new Set<CameraBlockReason>([
  'permission-denied',
  'no-device',
  'in-use',
  'aborted',
]);

/* ============================================================================
   ERROR
   ========================================================================== */

export class CameraError extends Error {
  readonly reason: CameraBlockReason;
  readonly originalError?: unknown;

  constructor(reason: CameraBlockReason, message: string, originalError?: unknown) {
    super(message);
    this.name = 'CameraError';
    this.reason = reason;
    this.originalError = originalError;
  }
}

/* ============================================================================
   A. CAPABILITY / B. SECURE CONTEXT
   ========================================================================== */

/**
 * Inspect, without side effects, whether the platform can even attempt a
 * camera. Never calls `getUserMedia`, never triggers a prompt.
 *
 * NOTE: `isSecureContext === false` + a missing `mediaDevices` is the classic
 * "works on my laptop, fails on my phone" case — a dev/staging build served
 * from `http://192.168.x.x` is not a secure context on mobile, so the browser
 * removes the whole API. Reporting that as "no camera found" is a lie.
 */
export function getCameraEnvironment(): CameraEnvironment {
  const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
  if (!isBrowser) {
    return {
      isBrowser: false,
      isSecureContext: false,
      hasMediaDevices: false,
      hasGetUserMedia: false,
    };
  }
  const mediaDevices = navigator.mediaDevices as MediaDevices | undefined;
  const secure = (window as Window & { isSecureContext?: boolean }).isSecureContext !== false;
  return {
    isBrowser: true,
    isSecureContext: secure,
    hasMediaDevices: Boolean(mediaDevices),
    hasGetUserMedia: Boolean(mediaDevices && typeof mediaDevices.getUserMedia === 'function'),
  };
}

/** Cheap boolean for callers that only need "can we try?". */
export function canAttemptCamera(): boolean {
  const env = getCameraEnvironment();
  return env.isBrowser && env.isSecureContext && env.hasGetUserMedia;
}

/**
 * Classify the environment into a user-facing failure, or `null` when the
 * platform is capable and we are allowed to call `getUserMedia`.
 *
 * Order matters: the secure-context check runs FIRST. Browsers normally hide
 * `mediaDevices` entirely on an insecure origin, so checking the API presence
 * first would report "unsupported browser" for what is really "this URL needs
 * HTTPS" — the single most common mobile deployment mistake for M-EDU.
 */
export function describeCameraEnvironment(): CameraFailure | null {
  const env = getCameraEnvironment();
  if (!env.isBrowser) return describeCameraFailure('unsupported');
  if (!env.isSecureContext) return describeCameraFailure('insecure-context');
  if (env.hasGetUserMedia) return null;
  return describeCameraFailure('unsupported');
}

/* ============================================================================
   C. PERMISSION STATE (best effort — Safari has no 'camera' permission name)
   ========================================================================== */

export async function queryCameraPermission(): Promise<CameraPermissionState> {
  if (typeof navigator === 'undefined') return 'unknown';
  const permissions = navigator.permissions as Permissions | undefined;
  if (!permissions || typeof permissions.query !== 'function') return 'unknown';
  try {
    // TS's PermissionName union predates 'camera' in some lib versions.
    const status = await permissions.query({
      name: 'camera' as PermissionName,
    });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unknown';
  } catch {
    // TypeError on Safari/Firefox without the 'camera' descriptor, or a
    // SecurityError in a cross-origin iframe. Fall back to asking.
    return 'unknown';
  }
}

/* ============================================================================
   CONSTRAINT LADDER — graceful degradation instead of OverconstrainedError
   ========================================================================== */

/**
 * Ordered constraint sets, most specific → always-works.
 *
 * Rung 4 (`{ video: true }`) is the one that cannot fail for constraint
 * reasons: the browser picks any camera it has. That is what makes a stale
 * `localStorage` device id harmless on a phone.
 */
export function buildCameraConstraintLadder(
  options: CameraAcquireOptions = {},
): MediaStreamConstraints[] {
  const facingMode = options.facingMode ?? 'user';
  const idealWidth = options.idealWidth ?? 1280;
  const idealHeight = options.idealHeight ?? 720;
  const device = options.deviceId ? { ideal: options.deviceId } : undefined;

  return [
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
        ...(device ? { deviceId: device } : {}),
      },
    },
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        ...(device ? { deviceId: device } : {}),
      },
    },
    {
      audio: false,
      video: device ? { deviceId: device } : { facingMode: { ideal: facingMode } },
    },
    { audio: false, video: true },
  ];
}

/* ============================================================================
   D. ACQUISITION
   ========================================================================== */

function reasonForError(error: unknown): CameraBlockReason {
  const name = (error as { name?: string } | null | undefined)?.name;
  if (typeof name === 'string' && REASON_BY_ERROR_NAME[name]) {
    return REASON_BY_ERROR_NAME[name];
  }
  return 'unknown';
}

/**
 * Obtain a live camera stream.
 *
 * Walks the constraint ladder, stopping early on failures that loosening
 * constraints cannot fix (denied permission, no hardware, busy hardware).
 * Resolves only with a stream that has at least one live video track.
 */
export async function acquireCameraStream(
  options: CameraAcquireOptions = {},
): Promise<CameraAcquireResult> {
  const envFailure = describeCameraEnvironment();
  if (envFailure) {
    throw new CameraError(envFailure.reason, envFailure.message);
  }

  const ladder = buildCameraConstraintLadder(options);
  let firstError: unknown;
  let firstReason: CameraBlockReason = 'unknown';

  for (let i = 0; i < ladder.length; i += 1) {
    const constraints = ladder[i];
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // A stream with no live video track is not usable — some Android
      // browsers resolve before the camera is actually delivering.
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        stopStream(stream);
        firstError = firstError ?? new CameraError('no-device', 'No video track in stream');
        firstReason = firstReason === 'unknown' ? 'no-device' : firstReason;
        continue;
      }

      return { stream, constraints, attempts: i + 1 };
    } catch (error) {
      if (firstError === undefined) {
        firstError = error;
        firstReason = reasonForError(error);
      }
      const reason = reasonForError(error);
      if (TERMINAL_REASONS.has(reason)) {
        throw new CameraError(reason, `Camera acquisition failed: ${reason}`, error);
      }
      // constraints / unsupported-constraint → try the next, simpler rung.
    }
  }

  throw new CameraError(firstReason, `Camera acquisition failed: ${firstReason}`, firstError);
}

/* ============================================================================
   E/F. STREAM ↔ <video> BINDING
   ========================================================================== */

/** Stop every track. Safe with null and never throws (iOS Safari quirks). */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  } catch {
    /* the stream may already be dead — nothing to release */
  }
}

/**
 * Wait until the `<video>` has actually painted camera frames.
 *
 * `HAVE_CURRENT_DATA` (2) is the first state where `drawImage()` yields a real
 * frame. Mobile Safari can report `HAVE_METADATA` for a long time while the
 * camera warms up, so waiting on metadata alone produces blank captures.
 */
export function waitForVideoReady(
  video: HTMLVideoElement,
  timeoutMs = 8_000,
  signal?: AbortSignal,
): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      settled = true;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('playing', onReady);
      video.removeEventListener('timeupdate', onReady);
      video.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      window.clearTimeout(timer);
    };

    const onAbort = () => {
      if (settled) return;
      cleanup();
      reject(new CameraError('aborted', 'Camera start was cancelled'));
    };
    signal?.addEventListener('abort', onAbort);

    const succeed = () => {
      if (settled) return;
      cleanup();
      resolve();
    };

    // Metadata alone is not proof of frames; nudge once via rAF for Safari,
    // which sometimes only reports dimensions on the next frame.
    const onMeta = () => {
      if (video.paused) {
        void safePlay(video);
      }
      requestAnimationFrame(() => {
        if (settled) return;
        if (video.readyState >= 2 && video.videoWidth > 0) succeed();
      });
    };

    const onReady = () => {
      if (video.videoWidth > 0) succeed();
      else onMeta();
    };

    const onError = () => {
      if (settled) return;
      cleanup();
      reject(new CameraError('in-use', 'Video element failed to start'));
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      cleanup();
      reject(new CameraError('unknown', 'Timed out waiting for camera frames'));
    }, timeoutMs);

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('playing', onReady);
    video.addEventListener('timeupdate', onReady);
    video.addEventListener('error', onError);

    if (video.paused) {
      void safePlay(video);
    }

    if (signal?.aborted) onAbort();
  });
}

/**
 * Play the video element, tolerating the mobile autoplay rejection.
 * A muted + playsInline video is normally allowed to autoplay; if the browser
 * still refuses, the caller's "tap to start" affordance recovers it.
 */
export async function safePlay(video: HTMLVideoElement): Promise<void> {
  try {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    await video.play();
  } catch {
    /* autoplay policy — frames may still arrive once the user interacts */
  }
}

/* ============================================================================
   DEVICE LIST (post-permission only) + SWITCHING HEURISTICS
   ========================================================================== */

/** Video inputs, tolerating browsers without `enumerateDevices`. */
export async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') return [];
  try {
    const devices = await mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  } catch {
    return [];
  }
}

/**
 * Best-effort front-camera detection for the "switch camera" action.
 * Labels are only populated AFTER permission, which is why this is never used
 * to decide whether a camera exists.
 */
export function pickCameraId(
  devices: MediaDeviceInfo[],
  prefer: 'user' | 'environment' | 'different-from',
  currentDeviceId?: string | null,
): string | null {
  if (devices.length === 0) return null;

  if (prefer === 'different-from') {
    if (!currentDeviceId && devices.length > 1) {
      // Current camera unknown (e.g. started via facingMode: 'user').
      // Prioritize an environment/back camera if available, otherwise the second device.
      const back = devices.find((device) => device.label && /back|rear|environment|world|arqa|orqa|задн|тыльн/i.test(device.label));
      return back ? back.deviceId : devices[1].deviceId;
    }
    const other = devices.find((device) => device.deviceId !== currentDeviceId);
    return other?.deviceId ?? devices[0].deviceId;
  }

  const frontHints = /front|user|face|selfie|old|передн|фронталь|frontale/i;
  const backHints = /back|rear|environment|world|arqa|orqa|задн|тыльн/i;
  const hints = prefer === 'user' ? frontHints : backHints;

  const labelled = devices.find((device) => device.label && hints.test(device.label));
  if (labelled) return labelled.deviceId;

  // Convention across Android/iOS: front camera is listed first.
  if (prefer === 'user') return devices[0].deviceId;
  return devices[devices.length - 1].deviceId;
}

/* ============================================================================
   ERROR → USER-FACING FAILURE
   ========================================================================== */

const FAILURES: Record<CameraBlockReason, CameraFailure> = {
  unsupported: {
    reason: 'unsupported',
    messageKey: 'face.cameraUnsupported',
    message:
      'This browser does not support camera access. Please use a recent version of Chrome, Safari or Firefox.',
    retryable: false,
    requiresSettings: true,
  },
  'insecure-context': {
    reason: 'insecure-context',
    messageKey: 'face.cameraInsecureContext',
    message:
      'Camera access requires a secure connection (HTTPS). Ask your administrator to open M-EDU over https://.',
    retryable: false,
    requiresSettings: true,
  },
  'permission-denied': {
    reason: 'permission-denied',
    messageKey: 'face.cameraPermissionDenied',
    message:
      'Camera access was denied. Please allow camera permission in your browser settings.',
    retryable: true,
    requiresSettings: true,
  },
  'no-device': {
    reason: 'no-device',
    messageKey: 'face.cameraNotFound',
    message: 'No camera was found on this device.',
    retryable: true,
    requiresSettings: false,
  },
  'in-use': {
    reason: 'in-use',
    messageKey: 'face.cameraInUse',
    message: 'The camera is already in use by another application.',
    retryable: true,
    requiresSettings: false,
  },
  constraints: {
    reason: 'constraints',
    messageKey: 'face.cameraConstraints',
    message:
      'The camera could not start with the requested settings. Please tap retry — M-EDU will use simpler settings.',
    retryable: true,
    requiresSettings: false,
  },
  aborted: {
    reason: 'aborted',
    messageKey: 'face.cameraStartAborted',
    message: 'Camera start was interrupted. Please try again and keep this screen open.',
    retryable: true,
    requiresSettings: false,
  },
  unknown: {
    reason: 'unknown',
    messageKey: 'face.cameraError',
    message: 'The camera could not be started. Please try again.',
    retryable: true,
    requiresSettings: false,
  },
};

/**
 * Map any thrown value (DOMException, CameraError, or reason string) to a
 * user-facing failure. Raw browser strings are intentionally NOT surfaced as
 * the primary message — they are technical noise for operators and students.
 */
export function describeCameraFailure(error: unknown): CameraFailure {
  if (typeof error === 'string') {
    return FAILURES[error as CameraBlockReason] ?? FAILURES.unknown;
  }
  if (error instanceof CameraError) {
    return FAILURES[error.reason] ?? FAILURES.unknown;
  }
  return FAILURES[reasonForError(error)] ?? FAILURES.unknown;
}

/** All failure templates, for tests and diagnostics. */
export function cameraFailureFor(reason: CameraBlockReason): CameraFailure {
  return FAILURES[reason];
}
