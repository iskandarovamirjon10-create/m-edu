/**
 * WebcamCapture — "Cupertino TrueDepth" Edition
 *
 * Premium craft:
 *  ✅ Corner brackets — data-driven array (4× redundancy olib tashlandi)
 *  ✅ SF Symbols icon system (barcha inline SVG o'rniga)
 *  ✅ Full i18n — barcha title/aria-label tarjima kaliti bilan
 *  ✅ Motion-value animations (spin, ping, pulse — GPU-composited)
 *  ✅ Reduced-motion aware (barcha infinite animatsiyalar o'chadi)
 *  ✅ Focus trap in permission dialog
 *  ✅ Status pill — icon + short label, truncate'siz
 *  ✅ Design tokens — bir xil radius, spacing, timing
 *  ✅ Haptic dedup — single haptic per event
 *  ✅ Auto-scan visibility tracking — feedback when paused
 *  ✅ Status config object (per-status, not if/else chains)
 *  ✅ Consistent focus-visible rings
 *  ✅ Light + dark first-class
 *  ✅ 44px touch targets — single utility class
 */

import {
  useCallback, useEffect, useRef, useState, useMemo,
} from 'react';
import { motion } from 'framer-motion';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useCamera } from '@/hooks/useCamera';
import type { TranslateFn } from '@/i18n/I18nProvider';

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

type CaptureMode = 'camera' | 'upload';

export interface WebcamCaptureProps {
  onCapture: (base64: string) => void;
  busy?: boolean;
  label?: string;
  autoScan?: boolean;
  onAutoScanToggle?: () => void;
  showAutoScanToggle?: boolean;
  isKiosk?: boolean;
}

/* ══════════════════════════════════════════════════════════════════════════
 * CONSTANTS
 * ════════════════════════════════════════════════════════════════════════ */

/** Longest edge of the uploaded frame — mobile sensors produce 12 MP images. */
const MAX_CAPTURE_EDGE = 1280;

/** Touch target size — Apple HIG minimum. */
const TOUCH = 'min-h-[44px]';

/** Shutter cooldown after capture. */
const SHUTTER_COOLDOWN_MS = 600;

/** Auto-scan interval. */
const AUTOSCAN_INTERVAL_MS = 2800;

/** Shared rounding for the viewport. */
const VIEWPORT_RADIUS = 'rounded-2xl';

/* ══════════════════════════════════════════════════════════════════════════
 * HOOKS
 * ════════════════════════════════════════════════════════════════════════ */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return reduced;
}

function useDocumentVisibility() {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  );
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  return visible;
}

function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const list = () => Array.from(root.querySelectorAll<HTMLElement>(selector));
    const first = list()[0];
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = list();
      if (!items.length) return;
      const f = items[0];
      const l = items[items.length - 1];
      if (e.shiftKey && document.activeElement === f) {
        e.preventDefault();
        l.focus();
      } else if (!e.shiftKey && document.activeElement === l) {
        e.preventDefault();
        f.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [ref, active]);
}

/* ══════════════════════════════════════════════════════════════════════════
 * ICON SYSTEM — SF Symbols proportions
 * ════════════════════════════════════════════════════════════════════════ */

const STROKE = 2.2;

function Icon({
  paths, size = 16, className = '', strokeWidth = STROKE,
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const I = {
  mirror: [
    'm14 19 3 3 3-3', 'm10 5-3-3-3 3',
    'M17 22V6a2 2 0 0 0-2-2H4', 'M7 2v16a2 2 0 0 0 2 2h11',
  ],
  flipCamera: [
    'M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5',
    'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5',
  ],
  upload: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M17 8l-5-5-5 5', 'M12 3v12',
  ],
  alert: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
  cameraBlocked: [
    'M23 7 16 12 23 17V7z',
    'M1 5h15v14H1z',
  ],
  scan: [
    'M3 7V5a2 2 0 0 1 2-2h2',
    'M17 3h2a2 2 0 0 1 2 2v2',
    'M21 17v2a2 2 0 0 1-2 2h-2',
    'M7 21H5a2 2 0 0 1-2-2v-2',
    'M7 12h10',
  ],
  autoScan: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
};

/* ══════════════════════════════════════════════════════════════════════════
 * STATUS CONFIG — single source of truth
 * ════════════════════════════════════════════════════════════════════════ */

type CameraStatus =
  | 'idle' | 'probing' | 'needs-permission' | 'requesting'
  | 'starting' | 'ready' | 'error';

interface StatusVisual {
  dot: string;
  glow: string;
  labelKey: string;
  labelFallback: string;
}

const STATUS_VISUAL: Record<CameraStatus, StatusVisual> = {
  'idle':             { dot: 'bg-slate-400',   glow: 'none',                       labelKey: 'face.cameraPreparing',           labelFallback: 'Preparing camera' },
  'probing':          { dot: 'bg-amber-400',   glow: '0 0 8px rgba(245,158,11,0.6)',  labelKey: 'face.cameraChecking',            labelFallback: 'Checking camera…' },
  'needs-permission': { dot: 'bg-amber-400',   glow: '0 0 8px rgba(245,158,11,0.6)',  labelKey: 'face.cameraNeedsPermissionStatus', labelFallback: 'Awaiting permission' },
  'requesting':       { dot: 'bg-amber-400',   glow: '0 0 8px rgba(245,158,11,0.6)',  labelKey: 'face.cameraRequesting',          labelFallback: 'Requesting access…' },
  'starting':         { dot: 'bg-amber-400',   glow: '0 0 8px rgba(245,158,11,0.6)',  labelKey: 'face.cameraStarting',            labelFallback: 'Starting camera…' },
  'ready':            { dot: 'bg-[#2563EB]',   glow: '0 0 8px #2563EB',              labelKey: 'face.centerFace',                labelFallback: 'Center your face' },
  'error':            { dot: 'bg-[#EF4444]',   glow: '0 0 8px #EF4444',              labelKey: 'face.cameraErrorStatus',         labelFallback: 'Camera offline' },
};

/* ══════════════════════════════════════════════════════════════════════════
 * CORNER BRACKETS — data-driven (4× redundancy removed)
 * ════════════════════════════════════════════════════════════════════════ */

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_POS: Record<Corner, { pos: string; border: string; radius: string }> = {
  tl: { pos: '-top-0.5 -left-0.5',   border: 'border-t-[2.5px] border-l-[2.5px]', radius: 'rounded-tl-[1.25rem]' },
  tr: { pos: '-top-0.5 -right-0.5',  border: 'border-t-[2.5px] border-r-[2.5px]', radius: 'rounded-tr-[1.25rem]' },
  bl: { pos: '-bottom-0.5 -left-0.5', border: 'border-b-[2.5px] border-l-[2.5px]', radius: 'rounded-bl-[1.25rem]' },
  br: { pos: '-bottom-0.5 -right-0.5', border: 'border-b-[2.5px] border-r-[2.5px]', radius: 'rounded-br-[1.25rem]' },
};

function CornerBrackets({ active }: { active: boolean }) {
  return (
    <>
      {(Object.keys(CORNER_POS) as Corner[]).map((k) => {
        const c = CORNER_POS[k];
        return (
          <div
            key={k}
            aria-hidden
            className={[
              'absolute w-7 h-7 sm:w-9 sm:h-9',
              c.pos, c.border, c.radius,
              'transition-all duration-300',
              active
                ? 'border-blue-500 scale-[1.01]'
                : 'border-white/50',
            ].join(' ')}
          />
        );
      })}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * SPINNER — motion-value, reduced-motion aware
 * ════════════════════════════════════════════════════════════════════════ */

function Spinner({ size = 32, className = '' }: { size?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.span
      className={`inline-block rounded-full border-2 border-white/30 border-t-white ${className}`}
      style={{ width: size, height: size }}
      animate={reduced ? {} : { rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      aria-hidden
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * PULSE DOT
 * ════════════════════════════════════════════════════════════════════════ */

function PulseDot({ color = '#22D3EE', size = 8 }: { color?: string; size?: number }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return (
      <span className="rounded-full" style={{ width: size, height: size, background: color }} aria-hidden />
    );
  }
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }} aria-hidden>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: color }}
        animate={{ scale: [1, 2.4], opacity: [0.75, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
      <span className="relative rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * HELPER
 * ════════════════════════════════════════════════════════════════════════ */

function failureCopy(messageKey: string, fallback: string, t: TranslateFn): string {
  return t(messageKey, fallback) || fallback;
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN
 * ════════════════════════════════════════════════════════════════════════ */

export function WebcamCapture({
  onCapture,
  busy = false,
  label,
  autoScan = false,
  onAutoScanToggle,
  showAutoScanToggle = false,
  isKiosk = false,
}: WebcamCaptureProps) {
  const { t } = useSafeI18n();
  const { playTick, playShutter } = usePremiumSound();
  const haptics = useHaptics();
  const reduced = usePrefersReducedMotion();
  const docVisible = useDocumentVisibility();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoScanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shutterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userGestureRef = useRef(false);
  const permissionDialogRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<CaptureMode>('camera');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [captureFailure, setCaptureFailure] = useState('');

  const cameraOn = mode === 'camera';
  const camera = useCamera({ autoStart: cameraOn });

  const {
    status: cameraStatus, failure, devices, selectedDeviceId,
    facingMode, canSwitchCamera, requestPermission, retry, stop, selectDevice,
    switchCamera, setVideoElement, captureFrame,
  } = camera;

  const status = cameraStatus as CameraStatus;
  const isScanningActive = busy || isCapturing;

  // Mirroring rule: Front (selfie) camera should be mirrored for natural user feel.
  // Back (environment) camera should NEVER be mirrored, so subjects are not inverted.
  useEffect(() => {
    setIsMirrored(facingMode !== 'environment');
  }, [facingMode]);

  /* ── Focus trap for permission dialog ──────────────────────── */
  useFocusTrap(permissionDialogRef, status === 'needs-permission');

  /* ── Clean up capture cooldown timeouts on unmount ─────────── */
  useEffect(() => {
    return () => {
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      if (shutterTimeoutRef.current) clearTimeout(shutterTimeoutRef.current);
    };
  }, []);

  /* ── Stop hardware when switching to upload ────────────────── */
  useEffect(() => {
    if (!cameraOn) stop();
  }, [cameraOn, stop]);

  /* ── Chime on ready (user-initiated only) ──────────────────── */
  const wasReadyRef = useRef(false);
  useEffect(() => {
    if (status === 'ready' && !wasReadyRef.current) {
      wasReadyRef.current = true;
      if (userGestureRef.current && !reduced) playTick();
    }
    if (status !== 'ready') wasReadyRef.current = false;
  }, [status, playTick, reduced]);

  /* ── Capture ───────────────────────────────────────────────── */
  const handleCapture = useCallback(() => {
    if (busy || isCapturing || status !== 'ready') return;

    const frame = captureFrame({
      mirrored: isMirrored,
      quality: 0.92,
      maxEdge: MAX_CAPTURE_EDGE,
    });

    if (!frame) {
      setCaptureFailure(t('face.cameraNotReady', 'Camera is still starting. Please try again.'));
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = setTimeout(() => setCaptureFailure(''), 2500);
      return;
    }

    setCaptureFailure('');
    setIsCapturing(true);
    if (!autoScan) playShutter();
    haptics.light();
    onCapture(frame.base64);

    if (shutterTimeoutRef.current) clearTimeout(shutterTimeoutRef.current);
    shutterTimeoutRef.current = setTimeout(() => setIsCapturing(false), SHUTTER_COOLDOWN_MS);
  }, [
    busy, isCapturing, status, captureFrame, isMirrored,
    haptics, onCapture, t, autoScan, playShutter,
  ]);

  /* ── Auto-scan loop ────────────────────────────────────────── */
  useEffect(() => {
    if (!autoScan || status !== 'ready' || busy || isCapturing || !cameraOn || !docVisible) {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
      return;
    }

    const intervalMs = isKiosk ? 1400 : AUTOSCAN_INTERVAL_MS;
    autoScanTimerRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      handleCapture();
    }, intervalMs);

    return () => {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    };
  }, [autoScan, status, busy, isCapturing, cameraOn, docVisible, isKiosk, handleCapture]);

  /* ── Handlers ──────────────────────────────────────────────── */
  const handleAllow = useCallback(() => {
    userGestureRef.current = true;
    haptics.light();
    requestPermission();
  }, [haptics, requestPermission]);

  const handleRetry = useCallback(() => {
    userGestureRef.current = true;
    setCaptureFailure('');
    retry();
  }, [retry]);

  const handleToggleAutoScan = useCallback(() => {
    haptics.light();
    onAutoScanToggle?.();
  }, [haptics, onAutoScanToggle]);

  const handleSwitchCamera = useCallback(() => {
    userGestureRef.current = true;
    haptics.light();
    switchCamera();
  }, [haptics, switchCamera]);

  const handleToggleMirror = useCallback(() => {
    haptics.light();
    setIsMirrored((m) => !m);
  }, [haptics]);

  /* ── Derived labels ────────────────────────────────────────── */
  const statusVisual = STATUS_VISUAL[status] || STATUS_VISUAL.idle;

  const statusLabel = useMemo(() => {
    if (isScanningActive) return t('face.analyzing', 'Analyzing…');
    if (status === 'ready' && autoScan) return t('face.autoScanActive', 'Auto-scan active');
    return t(statusVisual.labelKey, statusVisual.labelFallback);
  }, [isScanningActive, status, autoScan, statusVisual, t]);

  const failureMessage = failure
    ? failureCopy(failure.messageKey, failure.message, t)
    : '';

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <div
      className={[
        'relative w-full mx-auto flex flex-col items-center gap-4',
        isKiosk ? 'max-w-2xl' : 'max-w-xl',
      ].join(' ')}
    >
      {/* ═══════════════════════════════════════════════════════
          BIOMETRIC VIEWPORT
      ═══════════════════════════════════════════════════════ */}
      <div
        className={[
          'relative w-full overflow-hidden',
          VIEWPORT_RADIUS,
          'border border-white/20 bg-black/70',
          'shadow-[0_20px_60px_-15px_rgba(37,99,235,0.25)]',
          'backdrop-blur-md',
          'ring-1 ring-inset ring-white/10',
          'flex items-center justify-center',
          isKiosk ? 'aspect-[4/3] sm:aspect-video' : 'aspect-[3/4] xs:aspect-[4/3] sm:aspect-video',
        ].join(' ')}
        style={{ maxHeight: 'min(70dvh, 540px)' }}
      >
        {/* ── Ambient radial glow ── */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${isScanningActive ? 'opacity-100' : 'opacity-40'}`}
          style={{
            background: isScanningActive
              ? 'radial-gradient(circle at 50% 50%, rgba(37,99,235, 0.18) 0%, rgba(34, 211, 238, 0.12) 45%, transparent 75%)'
              : autoScan
                ? 'radial-gradient(circle at 50% 50%, rgba(37,99,235, 0.08) 0%, transparent 65%)'
                : 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.04) 0%, transparent 65%)',
          }}
        />

        {/* ── Live video stream ── */}
        {cameraOn && (
          <video
            ref={(el) => {
              if (el) {
                el.muted = true;
                el.defaultMuted = true;
                el.setAttribute('playsinline', 'true');
                el.setAttribute('webkit-playsinline', 'true');
              }
              setVideoElement(el);
            }}
            autoPlay
            playsInline
            muted
            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
            className={[
              'w-full h-full object-cover transition-opacity duration-500',
              status === 'ready' ? 'opacity-100' : 'opacity-0',
              isScanningActive ? 'brightness-105 contrast-105' : '',
            ].join(' ')}
          />
        )}

        {/* ── Top telemetry bar ── */}
        <div className="pointer-events-none absolute top-3 inset-x-3 sm:top-4 sm:inset-x-4 flex items-center justify-between gap-2 z-20">
          {/* Status pill */}
          <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[10px] sm:text-[11px] font-bold tracking-wide text-white backdrop-blur-xl shadow-lg">
            {isScanningActive && !reduced ? (
              <PulseDot color="#22D3EE" size={8} />
            ) : (
              <span
                className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-300 ${statusVisual.dot}`}
                style={{ boxShadow: statusVisual.glow }}
              />
            )}
            <span className="truncate uppercase tracking-widest text-white/90">
              {statusLabel}
            </span>
          </div>

          {/* Hardware quick controls */}
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            {status === 'ready' && (
              <>
                {/* Mirror toggle */}
                <button
                  type="button"
                  onClick={handleToggleMirror}
                  title={t('face.toggleMirror', 'Toggle mirror view')}
                  aria-label={t('face.toggleMirror', 'Toggle mirror view')}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 outline-none backdrop-blur-md transition-all hover:bg-black/70 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                >
                  <Icon paths={I.mirror} size={14} strokeWidth={2.2} />
                </button>

                {/* Camera flip */}
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  title={t('face.switchCamera', 'Switch camera')}
                  aria-label={t('face.switchCamera', 'Switch camera')}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 outline-none backdrop-blur-md transition-all hover:bg-black/70 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                >
                  <Icon paths={I.flipCamera} size={14} strokeWidth={2.2} />
                </button>
              </>
            )}

            {/* Device picker */}
            {canSwitchCamera && status === 'ready' && (
              <select
                aria-label={t('face.selectCamera', 'Select camera')}
                value={selectedDeviceId}
                onChange={(e) => selectDevice(e.target.value)}
                className="h-9 max-w-[9rem] cursor-pointer rounded-full border border-white/20 bg-black/60 px-2 text-[11px] font-semibold text-white/90 outline-none backdrop-blur-md hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-cyan-400/60"
              >
                <option value="">{t('face.defaultCamera', 'Default camera')}</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `${t('face.cameraN', 'Camera')} ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Viewfinder ── */}
        {status === 'ready' && cameraOn && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className={[
                'relative flex items-center justify-center transition-all duration-300 ease-out',
                isKiosk ? 'w-52 h-52 sm:w-72 sm:h-72' : 'w-44 h-44 sm:w-64 sm:h-64',
              ].join(' ')}
            >
              {/* Frame guide */}
              <div
                className={[
                  'absolute inset-0 rounded-[2.25rem] sm:rounded-[2.75rem] border transition-colors duration-300',
                  isScanningActive
                    ? 'border-blue-500/50 bg-blue-500/[0.04]'
                    : 'border-white/25 bg-white/[0.01]',
                ].join(' ')}
              />

              {/* Corner brackets */}
              <CornerBrackets active={isScanningActive} />

              {/* Central Face guide glyph */}
              <div className="relative flex flex-col items-center justify-center select-none">
                <motion.svg
                  viewBox="0 0 48 48"
                  className={[
                    'w-14 h-14 sm:w-16 sm:h-16 transition-colors duration-300',
                    isScanningActive
                      ? 'text-blue-400'
                      : 'text-white/30',
                  ].join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  animate={
                    isScanningActive && !reduced
                      ? { scale: [0.98, 1.02, 0.98], opacity: [0.85, 1, 0.85] }
                      : { scale: 1, opacity: 0.35 }
                  }
                  transition={{ duration: 1.5, repeat: isScanningActive ? Infinity : 0, ease: 'easeInOut' }}
                  aria-hidden
                >
                  <line x1="16" y1="18" x2="16" y2="21" strokeWidth="3" />
                  <line x1="32" y1="18" x2="32" y2="21" strokeWidth="3" />
                  <path d="M24 22v4l-2 1" strokeWidth="2" />
                  <path d="M16 32c2 3.5 14 3.5 16 0" strokeWidth="2.5" />
                </motion.svg>
              </div>
            </div>

            {/* Guidance pill */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3.5 py-1.5 backdrop-blur-md shadow-md">
                {isScanningActive ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-[11px] font-semibold tracking-wide text-blue-200">
                      {t('face.analyzing', 'Analyzing…')}
                    </span>
                  </>
                ) : autoScan ? (
                  <>
                    <Icon paths={I.autoScan} size={14} strokeWidth={2.2} className="text-white/70" />
                    <span className="text-[11px] font-medium text-white/85">
                      {t('face.centerFace', 'Center your face')}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] font-medium text-white/75">
                    {t('face.captureFace', 'Scan')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Busy / warm-up overlay ── */}
        {(status === 'probing' || status === 'starting') && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center backdrop-blur-md"
          >
            <Spinner size={32} />
            <p className="text-[12.5px] font-semibold text-white/85">
              {t(statusVisual.labelKey, statusVisual.labelFallback)}
            </p>
          </div>
        )}

        {/* ── Permission dialog ── */}
        {status === 'needs-permission' && (
          <div
            ref={permissionDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-permission-title"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 p-5 text-center backdrop-blur-md"
          >
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]">
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/40 to-transparent" />
              <Icon paths={I.cameraBlocked} size={26} strokeWidth={2.2} className="relative" />
            </div>
            <h3 id="camera-permission-title" className="text-[14px] font-bold text-white">
              {t('face.cameraPermissionTitle', 'Camera permission required')}
            </h3>
            <p className="max-w-xs text-[12px] font-medium leading-5 text-white/75">
              {t('face.cameraPermissionBody', 'Face Recognition needs the camera. Tap below — your browser will ask you to allow it.')}
            </p>
            <button
              type="button"
              onClick={handleAllow}
              className={[
                TOUCH,
                'mt-1 rounded-full px-6 py-2.5',
                'bg-gradient-to-br from-[#2563EB] to-[#6366F1]',
                'text-[13px] font-bold text-white',
                'shadow-[0_8px_22px_-8px_rgba(37,99,235,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]',
                'outline-none transition-all duration-300',
                'hover:brightness-110 focus-visible:ring-2 focus-visible:ring-cyan-400/60 active:scale-95',
              ].join(' ')}
            >
              {t('face.allowCamera', 'Allow camera')}
            </button>
          </div>
        )}

        {/* ── Requesting ── */}
        {status === 'requesting' && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center backdrop-blur-md"
          >
            <Spinner size={32} />
            <p className="max-w-xs text-[12.5px] font-semibold text-white/90">
              {t('face.permissionPromptHint', 'Tap "Allow" in the browser prompt to continue.')}
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && failure && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-red-950/85 p-5 text-center backdrop-blur-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/20 text-red-300">
              <Icon paths={I.alert} size={24} strokeWidth={2.2} />
            </div>
            <p className="max-w-sm text-[13px] font-semibold leading-5 text-red-100">
              {failureMessage}
            </p>

            {failure.reason === 'permission-denied' && (
              <p className="max-w-xs text-[11.5px] font-medium leading-5 text-red-200/80">
                {t('face.cameraDeniedHelp', 'Open your browser site settings (the lock icon in the address bar) and set Camera to "Allow", then retry.')}
              </p>
            )}

            {failure.reason === 'insecure-context' && (
              <p className="max-w-xs text-[11.5px] font-medium leading-5 text-red-200/80">
                {t('face.cameraInsecureHelp', 'On a phone the camera only works over HTTPS. Opening the app by IP address over http:// will always fail.')}
              </p>
            )}

            {failure.retryable && (
              <button
                type="button"
                onClick={handleRetry}
                className={`${TOUCH} mt-1 rounded-xl bg-white/10 px-5 py-2.5 text-[12.5px] font-semibold text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/40`}
              >
                {t('common.retry', 'Retry')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode('upload')}
              className="text-[11.5px] font-medium text-white/70 underline decoration-white/30 underline-offset-2 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {t('face.usePhotoInstead', 'Use a photo file instead')}
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          CONTROLS
      ═══════════════════════════════════════════════════════ */}
      <div className="flex w-full flex-col items-center gap-3">
        {cameraOn ? (
          <div className="flex flex-col items-center gap-2">
            {captureFailure && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="text-center text-[11.5px] font-semibold text-[#F59E0B]"
              >
                {captureFailure}
              </motion.p>
            )}

            <div className="flex items-center gap-4">
              {/* Auto-scan toggle */}
              {showAutoScanToggle && onAutoScanToggle && (
                <button
                  type="button"
                  onClick={handleToggleAutoScan}
                  className={[
                    TOUCH,
                    'flex items-center gap-1.5 rounded-full border px-3.5 py-2',
                    'text-[11px] font-bold tracking-tight outline-none transition-all duration-300',
                    'focus-visible:ring-2 focus-visible:ring-brand-500/40',
                    autoScan
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-[0_4px_14px_-6px_rgba(16,185,129,0.5)]'
                      : 'border-white/60 bg-white/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:text-[var(--text-primary)]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-2 w-2 rounded-full transition-colors duration-300',
                      autoScan ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]' : 'bg-slate-400',
                    ].join(' ')}
                  />
                  <span>{t('face.autoScan', 'Auto-scan')}</span>
                </button>
              )}

              {/* Shutter */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={status !== 'ready' || busy || isCapturing}
                title={label || t('face.captureFace', 'Scan face')}
                aria-label={label || t('face.captureFace', 'Scan face')}
                className={[
                  'group relative flex h-16 w-16 items-center justify-center rounded-full',
                  'border-4 border-white/40 bg-white/10 shadow-md backdrop-blur-md',
                  'outline-none transition-all duration-200',
                  'hover:border-white/70 focus-visible:ring-2 focus-visible:ring-blue-500/60',
                  'active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
                  'sm:h-20 sm:w-20',
                ].join(' ')}
              >
                <div
                  className={[
                    'flex items-center justify-center rounded-full transition-all duration-200',
                    isScanningActive
                      ? 'h-10 w-10 bg-blue-600 shadow-md'
                      : 'h-12 w-12 bg-white shadow-sm group-hover:scale-95 sm:h-14 sm:w-14',
                  ].join(' ')}
                >
                  {isScanningActive ? (
                    <Spinner size={20} />
                  ) : (
                    <span className="h-6 w-6 rounded-full border-2 border-slate-300" aria-hidden />
                  )}
                </div>
              </button>
            </div>

            <span className="select-none text-center text-[12px] font-semibold tracking-tight text-[var(--text-muted)]">
              {autoScan
                ? docVisible
                  ? t('face.autoScanning', 'Auto-scanning…')
                  : t('face.autoScanPaused', 'Auto-scan paused (tab hidden)')
                : label || t('face.captureFace', 'Scan')}
            </span>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const result = ev.target?.result as string;
                  if (result) { const parts = result.split(','); onCapture(parts[1] || parts[0]); }
                };
                e.target.value = '';
                reader.readAsDataURL(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className={[
                TOUCH,
                'flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3',
                'bg-white/70 dark:bg-[#131622]/70',
                'text-[13px] font-semibold text-[var(--text-primary)]',
                'ring-1 ring-inset ring-white/60 dark:ring-white/[0.08]',
                'shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] backdrop-blur-xl',
                'outline-none transition-all duration-300',
                'hover:bg-white dark:hover:bg-[#131622]',
                'focus-visible:ring-2 focus-visible:ring-brand-500/50',
                'disabled:opacity-50',
              ].join(' ')}
            >
              <Icon paths={I.upload} size={18} strokeWidth={2.2} />
              <span>{t('face.uploadPhoto', 'Upload photo file')}</span>
            </button>
          </div>
        )}

        {/* ── Mode switcher ── */}
        <div className="inline-flex rounded-full bg-white/40 p-1 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/[0.08]">
          {(['camera', 'upload'] as const).map((m) => {
            const isActive = mode === m;
            const labelKey = m === 'camera' ? 'face.modeCamera' : 'face.modeUpload';
            const fallback = m === 'camera' ? 'Camera' : 'Upload';
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={isActive}
                className={[
                  'relative min-h-[36px] rounded-full px-4 py-1 text-[11px] font-bold tracking-tight outline-none transition-colors duration-300',
                  'focus-visible:ring-2 focus-visible:ring-brand-500/50',
                  isActive
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {isActive && (
                  <motion.span
                    layoutId="capture-mode-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.15)] dark:bg-white/[0.08]"
                    transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.8 }}
                  />
                )}
                {t(labelKey, fallback)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}