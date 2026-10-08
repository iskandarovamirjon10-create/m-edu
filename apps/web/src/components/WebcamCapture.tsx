import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useCamera } from '@/hooks/useCamera';
import type { TranslateFn } from '@/i18n/I18nProvider';

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

/** Longest edge of the uploaded frame — mobile sensors produce 12 MP images. */
const MAX_CAPTURE_EDGE = 1280;

/**
 * Resolve the localized failure copy, falling back to the English text from
 * the platform layer.
 */
function failureCopy(
  messageKey: string,
  fallback: string,
  t: TranslateFn,
): string {
  return t(messageKey, fallback) || fallback;
}

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
  const { playSuccess, playTick, playLaserScan } = usePremiumSound();
  const haptics = useHaptics();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoScanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Only emit UI sounds after a real user gesture (mobile autoplay policy). */
  const userGestureRef = useRef(false);

  const [mode, setMode] = useState<CaptureMode>('camera');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [captureFailure, setCaptureFailure] = useState('');

  const cameraOn = mode === 'camera';
  const camera = useCamera({ autoStart: cameraOn });

  const {
    status,
    failure,
    devices,
    selectedDeviceId,
    canSwitchCamera,
    requestPermission,
    retry,
    stop,
    selectDevice,
    switchCamera,
    setVideoElement,
    captureFrame,
  } = camera;

  const isScanningActive = busy || isCapturing;

  /* ── Stop the hardware when the user switches to file upload ─────────── */

  useEffect(() => {
    if (!cameraOn) stop();
  }, [cameraOn, stop]);

  /* ── Chime once frames are really flowing (user-initiated starts only) ── */

  const wasReadyRef = useRef(false);
  useEffect(() => {
    if (status === 'ready' && !wasReadyRef.current) {
      wasReadyRef.current = true;
      if (userGestureRef.current) playTick();
    }
    if (status !== 'ready') wasReadyRef.current = false;
  }, [status, playTick]);

  /* ── Capture ─────────────────────────────────────────────────────────── */

  const handleCapture = useCallback(() => {
    if (busy || isCapturing || status !== 'ready') return;

    const frame = captureFrame({
      mirrored: isMirrored,
      quality: 0.92,
      maxEdge: MAX_CAPTURE_EDGE,
    });

    if (!frame) {
      // Rare: the track is live but no frame is drawable yet.
      setCaptureFailure(t('face.cameraNotReady', 'Camera is still starting. Please try again.'));
      return;
    }

    setCaptureFailure('');
    setIsCapturing(true);
    haptics.medium();
    playLaserScan();
    playSuccess();
    haptics.heavy();
    onCapture(frame.base64);

    window.setTimeout(() => setIsCapturing(false), 600);
  }, [
    busy,
    isCapturing,
    status,
    captureFrame,
    isMirrored,
    haptics,
    playLaserScan,
    playSuccess,
    onCapture,
    t,
  ]);

  /* ── Hands-free auto-scan loop (throttled, pauses in background) ─────── */

  useEffect(() => {
    if (!autoScan || status !== 'ready' || busy || isCapturing || !cameraOn) {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
      return;
    }

    autoScanTimerRef.current = setInterval(() => {
      // Never capture from a hidden tab: mobile browsers freeze the track and
      // the capture would be a black frame while still burning CPU.
      if (typeof document !== 'undefined' && document.hidden) return;
      handleCapture();
    }, 2800);

    return () => {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    };
  }, [autoScan, status, busy, isCapturing, cameraOn, handleCapture]);

  /* ── Explicit consent ────────────────────────────────────────────────── */

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

  const failureMessage = failure
    ? failureCopy(failure.messageKey, failure.message, t)
    : '';

  const statusLabel = (() => {
    if (isScanningActive) return t('face.analyzing', 'Face ID: tahlil qilinmoqda…');
    switch (status) {
      case 'probing':
        return t('face.cameraChecking', 'Kamera tekshirilmoqda…');
      case 'needs-permission':
        return t('face.cameraNeedsPermissionStatus', 'Ruxsat kutilmoqda');
      case 'requesting':
        return t('face.cameraRequesting', 'Brauzer ruxsat so\u2018ramoqda…');
      case 'starting':
        return t('face.cameraStarting', 'Kamera yoqilmoqda…');
      case 'ready':
        return autoScan
          ? t('face.autoScanActive', 'Avto-Skan Faol')
          : t('face.centerFace', 'Yuzingizni markazga tuting');
      case 'error':
        return t('face.cameraErrorStatus', 'Kamera ishlamayapti');
      default:
        return t('face.cameraPreparing', 'Kamera tayyorlanmoqda');
    }
  })();

  return (
    <div
      className={`relative w-full mx-auto flex flex-col items-center gap-4 ${
        isKiosk ? 'max-w-2xl' : 'max-w-xl'
      }`}
    >
      {/* ── Apple Face ID Biometric Viewport ────────────────────── */}
      <div
        className={`relative w-full overflow-hidden rounded-[1.5rem] sm:rounded-[2.25rem] border border-white/20 bg-black/70 shadow-[0_20px_60px_-15px_rgba(0,122,255,0.25)] backdrop-blur-3xl ring-1 ring-white/10 flex items-center justify-center ${
          isKiosk ? 'aspect-[4/3] sm:aspect-video' : 'aspect-[3/4] xs:aspect-[4/3] sm:aspect-video'
        }`}
        style={{ maxHeight: 'min(70dvh, 540px)' }}
      >
        {/* Ambient Holographic Radial Glow */}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
            isScanningActive ? 'opacity-100' : 'opacity-40'
          }`}
          style={{
            background: isScanningActive
              ? 'radial-gradient(circle at 50% 50%, rgba(0, 122, 255, 0.28) 0%, rgba(52, 199, 89, 0.22) 50%, transparent 75%)'
              : autoScan
              ? 'radial-gradient(circle at 50% 50%, rgba(52, 199, 89, 0.15) 0%, transparent 65%)'
              : 'radial-gradient(circle at 50% 50%, rgba(0, 122, 255, 0.12) 0%, transparent 65%)',
          }}
        />

        {/* The Live Video Stream — muted + playsInline are required on iOS. */}
        {cameraOn && (
          <video
            ref={setVideoElement}
            autoPlay
            playsInline
            muted
            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              status === 'ready' ? 'opacity-100' : 'opacity-0'
            } ${isScanningActive ? 'brightness-105 contrast-105' : ''}`}
          />
        )}

        {/* Top Floating Telemetry & Quick Hardware Controls */}
        <div className="pointer-events-none absolute top-3 inset-x-3 sm:top-4 sm:inset-x-4 flex items-center justify-between gap-2 z-20">
          {/* Status Pill */}
          <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[10px] sm:text-[11px] font-bold tracking-wide text-white backdrop-blur-xl shadow-lg">
            <span
              className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-300 ${
                isScanningActive
                  ? 'bg-[#34C759] shadow-[0_0_10px_#34C759] animate-pulse'
                  : status === 'ready'
                  ? 'bg-[#007AFF] shadow-[0_0_8px_#007AFF]'
                  : status === 'error'
                  ? 'bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]'
                  : 'bg-amber-400'
              }`}
            />
            <span className="truncate uppercase text-[10px] tracking-widest text-white/90">
              {statusLabel}
            </span>
          </div>

          {/* Quick Controls: Mirror & Camera Switcher (Pointer-events-auto) */}
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            {status === 'ready' && (
              <button
                type="button"
                onClick={() => setIsMirrored((m) => !m)}
                title={isMirrored ? "Oynali ko'rinish o'chirish" : "Oynali ko'rinish yoqish"}
                aria-label={isMirrored ? 'Disable mirror view' : 'Enable mirror view'}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-all backdrop-blur-md"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m14 19 3 3 3-3" />
                  <path d="m10 5-3-3-3 3" />
                  <path d="M17 22V6a2 2 0 0 0-2-2H4" />
                  <path d="M7 2v16a2 2 0 0 0 2 2h11" />
                </svg>
              </button>
            )}

            {/* Front/back switch — available as soon as a stream exists */}
            {status === 'ready' && (
              <button
                type="button"
                onClick={() => {
                  userGestureRef.current = true;
                  switchCamera();
                }}
                title="Kamerani almashtirish"
                aria-label={t('face.switchCamera', 'Switch camera')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-all backdrop-blur-md"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
            )}

            {/* Device picker (only when the browser exposes more than one) */}
            {canSwitchCamera && status === 'ready' && (
              <select
                aria-label={t('face.selectCamera', 'Select camera')}
                value={selectedDeviceId}
                onChange={(e) => selectDevice(e.target.value)}
                className="h-9 max-w-[9rem] rounded-full border border-white/20 bg-black/60 px-2 text-[11px] font-semibold text-white/90 backdrop-blur-md outline-none cursor-pointer hover:bg-black/80"
              >
                <option value="">{t('face.defaultCamera', 'Standart kamera')}</option>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `${t('face.cameraN', 'Kamera')} ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Apple Face ID Biometric HUD Reticle ── */}
        {status === 'ready' && cameraOn && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className={`relative flex items-center justify-center transition-all duration-500 ${
                isKiosk ? 'w-48 h-48 sm:w-72 sm:h-72' : 'w-44 h-44 sm:w-64 sm:h-64'
              }`}
            >
              {/* 4 Precision Corner Brackets */}
              <div
                className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 rounded-tl-2xl transition-all duration-500 ${
                  isScanningActive
                    ? 'border-[#30D158] shadow-[0_0_15px_#30D158] scale-105'
                    : autoScan
                    ? 'border-[#34C759] shadow-[0_0_10px_#34C759]/60'
                    : 'border-[#007AFF] shadow-[0_0_10px_#007AFF]/60'
                }`}
              />
              <div
                className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 rounded-tr-2xl transition-all duration-500 ${
                  isScanningActive
                    ? 'border-[#30D158] shadow-[0_0_15px_#30D158] scale-105'
                    : autoScan
                    ? 'border-[#34C759] shadow-[0_0_10px_#34C759]/60'
                    : 'border-[#007AFF] shadow-[0_0_10px_#007AFF]/60'
                }`}
              />
              <div
                className={`absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 rounded-bl-2xl transition-all duration-500 ${
                  isScanningActive
                    ? 'border-[#30D158] shadow-[0_0_15px_#30D158] scale-105'
                    : autoScan
                    ? 'border-[#34C759] shadow-[0_0_10px_#34C759]/60'
                    : 'border-[#007AFF] shadow-[0_0_10px_#007AFF]/60'
                }`}
              />
              <div
                className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 rounded-br-2xl transition-all duration-500 ${
                  isScanningActive
                    ? 'border-[#30D158] shadow-[0_0_15px_#30D158] scale-105'
                    : autoScan
                    ? 'border-[#34C759] shadow-[0_0_10px_#34C759]/60'
                    : 'border-[#007AFF] shadow-[0_0_10px_#007AFF]/60'
                }`}
              />

              {/* Concentric Biometric Guides */}
              <div className="absolute inset-4 rounded-full border border-white/15 opacity-60" />
              <div className="hidden sm:block absolute inset-10 rounded-full border border-dashed border-white/20 animate-[spin_40s_linear_infinite]" />

              {/* Biometric Scanning Radar Sweep (only while scanning) */}
              <AnimatePresence>
                {isScanningActive && (
                  <>
                    <motion.div
                      className="absolute inset-x-0 h-1 z-20 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent 0%, #007AFF 20%, #30D158 50%, #007AFF 80%, transparent 100%)',
                        boxShadow: '0 0 25px 3px rgba(48,209,88,0.8), 0 0 45px 8px rgba(0,122,255,0.6)',
                      }}
                      initial={{ top: '10%' }}
                      animate={{ top: ['10%', '90%', '10%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      className="absolute inset-2 rounded-full border-2 border-transparent border-t-[#30D158] border-r-[#007AFF] pointer-events-none"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                      style={{ filter: 'drop-shadow(0 0 8px #30D158)' }}
                    />
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Corner HUD Telemetry Details */}
            <div className="absolute bottom-3 left-4 hidden text-[9.5px] font-mono font-medium tracking-wider text-white/60 sm:block">
              <span>FACE-ID: </span>
              <span className="text-[#30D158]">ONLINE</span>
            </div>
            <div className="absolute bottom-3 right-4 hidden text-[9.5px] font-mono font-medium tracking-wider text-white/60 sm:block">
              <span>MODE: </span>
              <span className={autoScan ? 'text-[#34C759]' : 'text-white/80'}>
                {autoScan ? 'HANDS-FREE KIOSK' : 'MANUAL SHUTTER'}
              </span>
            </div>
          </div>
        )}

        {/* ── Busy / warm-up overlay (no error, no action needed) ── */}
        {(status === 'probing' || status === 'starting') && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 p-6 text-center backdrop-blur-md"
            role="status"
            aria-live="polite"
          >
            <span className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <p className="text-[12.5px] font-semibold text-white/85">
              {status === 'probing'
                ? t('face.cameraChecking', 'Kamera tekshirilmoqda…')
                : t('face.cameraStarting', 'Kamera yoqilmoqda…')}
            </p>
          </div>
        )}

        {/* ── Permission state — the browser has NOT been asked yet ── */}
        {status === 'needs-permission' && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 p-5 text-center backdrop-blur-md"
            role="dialog"
            aria-label={t('face.cameraPermissionTitle', 'Camera permission required')}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white shadow-xl shadow-[#007AFF]/30">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M23 7 16 12 23 17V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <h3 className="text-[14px] font-bold text-white">
              {t('face.cameraPermissionTitle', 'Camera permission required')}
            </h3>
            <p className="max-w-xs text-[12px] font-medium leading-5 text-white/75">
              {t(
                'face.cameraPermissionBody',
                'Face Recognition needs the camera. Tap below — your browser will ask you to allow it.',
              )}
            </p>
            <button
              type="button"
              onClick={handleAllow}
              className="mt-1 min-h-[44px] rounded-full bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-6 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-[#007AFF]/30 transition-all hover:opacity-90 active:scale-95"
            >
              {t('face.allowCamera', 'Allow camera')}
            </button>
          </div>
        )}

        {/* ── Requesting — the browser prompt is on screen ── */}
        {status === 'requesting' && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center backdrop-blur-md"
            role="status"
            aria-live="polite"
          >
            <span className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <p className="max-w-xs text-[12.5px] font-semibold text-white/90">
              {t('face.permissionPromptHint', 'Please tap “Allow” in the browser prompt to continue.')}
            </p>
          </div>
        )}

        {/* ── Accurate failure state (denied / busy / no hardware / HTTP) ── */}
        {status === 'error' && failure && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-red-950/85 p-5 text-center backdrop-blur-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/20 text-red-300">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="max-w-sm text-[13px] font-semibold leading-5 text-red-100">{failureMessage}</p>

            {failure.reason === 'permission-denied' && (
              <p className="max-w-xs text-[11.5px] font-medium leading-5 text-red-200/80">
                {t(
                  'face.cameraDeniedHelp',
                  'Open your browser site settings (the lock icon in the address bar) and set Camera to “Allow”, then retry.',
                )}
              </p>
            )}

            {failure.reason === 'insecure-context' && (
              <p className="max-w-xs text-[11.5px] font-medium leading-5 text-red-200/80">
                {t(
                  'face.cameraInsecureHelp',
                  'On a phone the camera only works over HTTPS. Opening the app by IP address over http:// will always fail.',
                )}
              </p>
            )}

            {failure.retryable && (
              <button
                type="button"
                onClick={handleRetry}
                className="mt-1 min-h-[44px] rounded-xl bg-white/10 px-5 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/20"
              >
                {t('common.retry', 'Qayta urinish')}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode('upload')}
              className="text-[11.5px] font-medium text-white/70 underline decoration-white/30 underline-offset-2 hover:text-white"
            >
              {t('face.usePhotoInstead', 'Use a photo file instead')}
            </button>
          </div>
        )}
      </div>

      {/* ── Apple Pro Camera Shutter & Mode Controls ─────────────────────── */}
      <div className="flex w-full flex-col items-center gap-3">
        {cameraOn ? (
          <div className="flex flex-col items-center gap-2">
            {captureFailure && (
              <p className="text-center text-[11.5px] font-semibold text-[#FF9500]" role="alert">
                {captureFailure}
              </p>
            )}
            <div className="flex items-center gap-4">
              {/* Optional Auto-Scan Toggle */}
              {showAutoScanToggle && onAutoScanToggle && (
                <button
                  type="button"
                  onClick={onAutoScanToggle}
                  className={`flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-bold tracking-tight transition-all ${
                    autoScan
                      ? 'border-[#34C759]/40 bg-[#34C759]/15 text-[#34C759] shadow-sm shadow-[#34C759]/20'
                      : 'border-[#00000015] bg-[#00000006] text-[#86868B] hover:text-[#1D1D1F] dark:border-[#ffffff15] dark:bg-[#ffffff08] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      autoScan ? 'bg-[#34C759] animate-pulse' : 'bg-gray-400'
                    }`}
                  />
                  <span>{t('face.autoScan', 'Avto-Skan')}</span>
                </button>
              )}

              {/* Shutter Button */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={status !== 'ready' || busy || isCapturing}
                title={label || t('face.captureFace', 'Skanerlash')}
                aria-label={label || t('face.captureFace', 'Scan face')}
                className="group relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-white/30 bg-black/20 shadow-[0_8px_30px_rgba(0,122,255,0.25)] backdrop-blur-xl transition-all hover:border-white/50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-20 sm:w-20"
              >
                {isScanningActive && (
                  <span className="absolute inset-0 animate-ping rounded-full border-2 border-[#30D158] opacity-60" />
                )}

                <div
                  className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                    isScanningActive
                      ? 'h-10 w-10 bg-gradient-to-tr from-[#007AFF] to-[#30D158] shadow-[0_0_15px_#30D158]'
                      : 'h-12 w-12 bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)] group-hover:scale-95 sm:h-14 sm:w-14'
                  }`}
                >
                  {isScanningActive ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <span className="h-6 w-6 rounded-full border-2 border-black/10" />
                  )}
                </div>
              </button>
            </div>

            <span className="select-none text-center text-[12px] font-semibold tracking-tight text-[#86868B] dark:text-[#98989D]">
              {autoScan
                ? t('face.autoScanning', 'Avtomatik skanerlanmoqda…')
                : label || t('face.captureFace', 'Skanerlash')}
            </span>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const result = ev.target?.result as string;
                    onCapture(result.split(',')[1]);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[#00000015] bg-white/70 px-5 py-3 text-[13px] font-semibold text-[#1D1D1F] shadow-md backdrop-blur-xl transition-all hover:bg-white disabled:opacity-50 dark:border-[#ffffff15] dark:bg-[#1C1C1E]/70 dark:text-[#F5F5F7] dark:hover:bg-[#1C1C1E]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>{t('face.uploadPhoto', 'Rasm faylini yuklash')}</span>
            </button>
          </div>
        )}

        {/* Apple Segmented Mode Switcher (Kamera / Yuklash) */}
        <div className="inline-flex rounded-full border border-[#00000010] bg-[#00000006] p-1 dark:border-[#ffffff10] dark:bg-[#ffffff08]">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`min-h-[36px] rounded-full px-4 py-1 text-[11px] font-bold tracking-tight transition-all ${
              mode === 'camera'
                ? 'bg-white text-[#1D1D1F] shadow-sm dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
                : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
            }`}
          >
            {t('face.modeCamera', 'Kamera')}
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`min-h-[36px] rounded-full px-4 py-1 text-[11px] font-bold tracking-tight transition-all ${
              mode === 'upload'
                ? 'bg-white text-[#1D1D1F] shadow-sm dark:bg-[#2C2C2E] dark:text-[#F5F5F7]'
                : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
            }`}
          >
            {t('face.modeUpload', 'Fayl yuklash')}
          </button>
        </div>
      </div>
    </div>
  );
}
