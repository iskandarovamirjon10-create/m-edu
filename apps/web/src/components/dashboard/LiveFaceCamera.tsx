/**
 * LiveFaceCamera — live webcam console for biometric attendance.
 *
 * The camera lifecycle (getUserMedia, track teardown, unmount cleanup) is
 * preserved. The old unreachable "recognized" confirmation card was removed.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Camera,
  Video,
  VideoOff,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import { useI18n } from '@/i18n/I18nProvider';

type CameraStatus = 'STANDBY' | 'CONNECTING' | 'STREAMING' | 'ERROR';

interface RecentAttendanceRecord {
  id: string;
  name: string;
  group: string;
  time: string;
}

const STATUS_META: Record<
  CameraStatus,
  { label: string; chip: string; dot: string | null; spin?: boolean }
> = {
  STREAMING: { label: 'Jonli', chip: 'bg-apple-green/10 text-apple-green', dot: 'bg-apple-green' },
  CONNECTING: { label: 'Ulanmoqda', chip: 'bg-apple-orange/10 text-apple-orange', dot: null, spin: true },
  ERROR: { label: 'Xatolik', chip: 'bg-apple-red/10 text-apple-red', dot: null },
  STANDBY: {
    label: 'Kutish',
    chip: 'bg-black/[0.05] text-secondary dark:bg-white/[0.08]',
    dot: 'bg-surface-400',
  },
};

export function LiveFaceCamera() {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [status, setStatus] = useState<CameraStatus>('STANDBY');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentAttendee, setRecentAttendee] = useState<RecentAttendanceRecord | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen to global attendance event bus (fired by FaceRecognition kiosk or WebSocket)
  useEffect(() => {
    const handleDetection = (event: Event) => {
      const custom = event as CustomEvent<RecentAttendanceRecord>;
      if (custom.detail) {
        setRecentAttendee(custom.detail);

        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => {
          setRecentAttendee(null);
        }, 6000);
      }
    };

    window.addEventListener('medu:attendance-logged', handleDetection);
    return () => {
      window.removeEventListener('medu:attendance-logged', handleDetection);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const startWebcam = useCallback(async () => {
    setStatus('CONNECTING');
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          t('face.cameraUnsupported') || 'Brauzeringiz kamerani qo\'llab-quvvatlamaydi',
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('STREAMING');
      }
    } catch (err: unknown) {
      setStatus('ERROR');
      const name = (err as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setErrorMessage(
          t('face.cameraPermissionDenied') ||
            'Kameradan foydalanishga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.',
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setErrorMessage(t('face.cameraNotFound') || 'Qurilmada kamera topilmadi.');
      } else {
        setErrorMessage(t('face.cameraError') || 'Kamerani yoqishda xatolik yuz berdi.');
      }
    }
  }, [t]);

  const stopWebcam = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStatus('STANDBY');
    setErrorMessage(null);
  }, []);

  const toggleWebcam = useCallback(() => {
    if (status === 'STREAMING') stopWebcam();
    else void startWebcam();
  }, [status, startWebcam, stopWebcam]);

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const badge = STATUS_META[status];

  return (
    <div className="flex h-full flex-col rounded-xl border border-subtle bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-subtle pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
            <Camera className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-primary">Jonli kamera · Face ID</h3>
            <p className="text-xs text-tertiary">Yuzni aniqlash va monitoring</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
              badge.chip,
            )}
          >
            {badge.dot && <span className={cn('h-1.5 w-1.5 rounded-full', badge.dot)} />}
            {badge.spin && <RefreshCw className="h-3 w-3 animate-spin" strokeWidth={1.75} aria-hidden />}
            {badge.label}
          </span>
          <button
            type="button"
            onClick={toggleWebcam}
            aria-label={status === 'STREAMING' ? 'Kamerani to\'xtatish' : 'Kamerani yoqish'}
            title={status === 'STREAMING' ? 'Kamerani to\'xtatish' : 'Kamerani yoqish'}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-150',
              status === 'STREAMING'
                ? 'border-apple-red/20 bg-apple-red/10 text-apple-red hover:bg-apple-red/15'
                : 'border-subtle bg-black/[0.02] text-secondary hover:text-primary dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
            )}
          >
            {status === 'STREAMING' ? (
              <VideoOff className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <Video className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div className="relative mt-3.5 aspect-[4/3] w-full overflow-hidden rounded-lg border border-subtle bg-surface-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            status === 'STREAMING' ? 'opacity-100' : 'opacity-0',
          )}
        />

        {status === 'STREAMING' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[11px] font-medium text-white/90 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-apple-green" />
                CAM · 01
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white/80 backdrop-blur-sm">
                <ShieldCheck className="h-3 w-3 text-apple-green" strokeWidth={1.75} aria-hidden />
                Himoyalangan
              </span>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-36 rounded-xl border border-dashed border-white/50" />
            </div>

            <div className="flex items-center justify-between">
              <span className="rounded bg-black/50 px-2 py-0.5 text-[11px] text-white/70 backdrop-blur-sm">
                Yuzni ramka markazida tuting
              </span>
            </div>
          </div>
        )}

        {/* Real-time attendee detection toast */}
        <AnimatePresence>
          {recentAttendee && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 rounded-xl border border-white/25 bg-neutral-900/90 p-2.5 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/25 text-emerald-400 shadow-[0_0_12px_rgba(52,199,89,0.4)]">
                  <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-white">
                      {recentAttendee.name}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      <Sparkles className="h-2.5 w-2.5" />
                      Qayd etildi
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-white/70">
                    {recentAttendee.group} · {recentAttendee.time}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRecentAttendee(null)}
                className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                Yopish
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'STANDBY' && (
            <motion.div
              key="standby"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-surface-950/90 p-5 text-center"
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80">
                <Camera className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </span>
              <h4 className="text-sm font-medium text-white">Kamera kutish rejimida</h4>
              <p className="mt-1 max-w-[230px] text-xs leading-relaxed text-white/60">
                Yuz orqali avtomatik davomat olish uchun kamerani ishga tushiring
              </p>
              <button
                type="button"
                onClick={startWebcam}
                className="mt-3.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-brand-600"
              >
                <Video className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Kamerani yoqish
              </button>
            </motion.div>
          )}

          {status === 'CONNECTING' && (
            <motion.div
              key="connecting"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-surface-950/95 p-4 text-center"
            >
              <RefreshCw className="mb-3 h-6 w-6 animate-spin text-white/80" strokeWidth={1.75} aria-hidden />
              <span className="text-sm font-medium text-white">Kamera ulanmoqda...</span>
              <span className="mt-1 text-xs text-white/60">Qurilma drayverlari tekshirilmoqda</span>
            </motion.div>
          )}

          {status === 'ERROR' && (
            <motion.div
              key="error"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-surface-950/95 p-5 text-center"
            >
              <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg bg-apple-red/20 text-apple-red">
                <AlertCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h4 className="text-sm font-medium text-white">Kameraga ulanishda xatolik</h4>
              <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-white/60">
                {errorMessage || 'Kamerani ishga tushirib bo\'lmadi.'}
              </p>
              <button
                type="button"
                onClick={startWebcam}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/15"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Qayta urinish
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3 rounded-lg border border-subtle bg-black/[0.02] p-2.5 dark:bg-white/[0.03]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
            <UserCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-primary">Biometrik davomat</div>
            <div className="truncate text-xs text-tertiary">
              Yuz aniqlanganda davomat shu yerda qayd etiladi
            </div>
          </div>
        </div>
        <Link
          to="/face"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-subtle bg-card px-2.5 text-xs font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          Boshqaruv
          <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export default LiveFaceCamera;
