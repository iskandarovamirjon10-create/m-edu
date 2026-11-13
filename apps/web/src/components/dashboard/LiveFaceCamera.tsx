/**
 * LiveFaceCamera — live webcam console for biometric attendance.
 * Elevated with iOS 27 / Apple Vision Pro Liquid Glass and Tactile Sound.
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
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { DashboardGlassLayers, useDashboardGlassCard } from './DashboardGlass';

type CameraStatus = 'STANDBY' | 'CONNECTING' | 'STREAMING' | 'ERROR';

interface RecentAttendanceRecord {
  id: string;
  name: string;
  group: string;
  time: string;
}

const STATUS_META: Record<
  CameraStatus,
  { label: string; jewelClass: string; dot: string | null; spin?: boolean }
> = {
  STREAMING: { label: 'Jonli', jewelClass: 'jewel-emerald', dot: 'bg-emerald-500' },
  CONNECTING: { label: 'Ulanmoqda', jewelClass: 'jewel-amber', dot: null, spin: true },
  ERROR: { label: 'Xatolik', jewelClass: 'jewel-rose', dot: null },
  STANDBY: {
    label: 'Kutish',
    jewelClass: 'jewel-slate',
    dot: 'bg-slate-400',
  },
};

export function LiveFaceCamera() {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  const reduced = usePrefersReducedMotion();
  const cardRef = useDashboardGlassCard<HTMLDivElement>({ dispersion: 3 });
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
        sound.playFaceIdMatch();

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
  }, [sound]);

  const startWebcam = useCallback(async () => {
    sound.playTick();
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
        sound.playSuccess();
      }
    } catch (err: unknown) {
      setStatus('ERROR');
      sound.playError();
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
  }, [t, sound]);

  const stopWebcam = useCallback(() => {
    sound.playTick();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStatus('STANDBY');
    setErrorMessage(null);
  }, [sound]);

  const toggleWebcam = useCallback(() => {
    if (status === 'STREAMING') stopWebcam();
    else void startWebcam();
  }, [status, startWebcam, stopWebcam]);

  useEffect(() => {
    // Cleanup paytida ref o‘zgargan bo‘lishi mumkin — streamni effect ichida ushlab qolamiz.
    const videoEl = videoRef.current;
    return () => {
      const stream = videoEl?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const badge = STATUS_META[status];

  return (
    <div
      ref={cardRef}
      className="lgx lgx--clear relative isolate flex h-full flex-col rounded-[2rem] p-5 sm:p-6"
    >
      <DashboardGlassLayers />

      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] pb-3.5 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A84FF] to-[#34C759] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_10px_rgba(10,132,255,0.4)]">
            <Camera className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
              Jonli kamera · Face ID
            </h3>
            <p className="text-xs text-[var(--text-secondary,#86868B)]">
              Yuzni aniqlash va monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'jewel-pill text-[11px] font-bold uppercase tracking-wider py-0.5 px-2.5',
              badge.jewelClass,
            )}
          >
            {badge.dot && (
              <span className={cn('relative flex h-2 w-2 shrink-0')}>
                {status === 'STREAMING' && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', badge.dot)} />
              </span>
            )}
            {badge.spin && <RefreshCw className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden />}
            {badge.label}
          </span>
          <button
            type="button"
            onClick={toggleWebcam}
            aria-label={status === 'STREAMING' ? 'Kamerani to\'xtatish' : 'Kamerani yoqish'}
            title={status === 'STREAMING' ? 'Kamerani to\'xtatish' : 'Kamerani yoqish'}
            className={cn(
              'inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-all duration-150 active:scale-95',
              status === 'STREAMING'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400'
                : 'border-black/[0.08] bg-white/70 text-slate-700 hover:bg-white hover:text-black dark:border-white/[0.12] dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.15]',
            )}
          >
            {status === 'STREAMING' ? (
              <VideoOff className="h-4 w-4" strokeWidth={2} aria-hidden />
            ) : (
              <Video className="h-4 w-4" strokeWidth={2} aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div className="relative mt-3.5 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-black/[0.1] bg-slate-950 shadow-inner dark:border-white/[0.1]">
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
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-white/95 backdrop-blur-md border border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CAM · 01
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-0.5 text-[10.5px] font-bold text-white/90 backdrop-blur-md border border-white/10">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.2} aria-hidden />
                Himoyalangan
              </span>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-44 w-36 rounded-2xl border-2 border-dashed border-sky-400/60 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                <div className="absolute -inset-1 rounded-2xl border border-sky-400/20 animate-pulse" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="rounded-full bg-black/60 px-3 py-0.5 text-[10.5px] font-medium text-white/80 backdrop-blur-md border border-white/10">
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
              className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 rounded-2xl border border-white/30 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/25 text-emerald-400 shadow-[0_0_14px_rgba(52,199,89,0.5)]">
                  <CheckCircle2 className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-white">
                      {recentAttendee.name}
                    </span>
                    <span className="jewel-pill jewel-emerald text-[9px] py-0.2 px-1.5 uppercase font-bold tracking-wider">
                      <Sparkles className="h-2.5 w-2.5" />
                      Qayd etildi
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-white/70 font-medium">
                    {recentAttendee.group} · {recentAttendee.time}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setRecentAttendee(null);
                }}
                className="shrink-0 rounded-xl bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/80 transition-colors hover:bg-white/20 hover:text-white"
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
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-5 text-center"
            >
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 shadow-inner">
                <Camera className="h-7 w-7" strokeWidth={1.8} aria-hidden />
              </span>
              <h4 className="text-sm font-bold text-white">Kamera kutish rejimida</h4>
              <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-white/60">
                Yuz orqali avtomatik davomat olish uchun kamerani ishga tushiring
              </p>
              <button
                type="button"
                onClick={startWebcam}
                className="btn-glow-primary mt-3.5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-sky-500 px-5 text-xs font-bold text-white transition hover:bg-sky-400 active:scale-95 shadow-md"
              >
                <Video className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
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
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-4 text-center"
            >
              <RefreshCw className="mb-3 h-7 w-7 animate-spin text-sky-400" strokeWidth={2} aria-hidden />
              <span className="text-sm font-bold text-white">Kamera ulanmoqda...</span>
              <span className="mt-1 text-xs text-white/60">Qurilma drayverlari tekshirilmoqda</span>
            </motion.div>
          )}

          {status === 'ERROR' && (
            <motion.div
              key="error"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-5 text-center"
            >
              <span className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 shadow-md">
                <AlertCircle className="h-6 w-6" strokeWidth={2} aria-hidden />
              </span>
              <h4 className="text-sm font-bold text-white">Kameraga ulanishda xatolik</h4>
              <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-white/60">
                {errorMessage || "Kamerani ishga tushirib bo'lmadi."}
              </p>
              <button
                type="button"
                onClick={startWebcam}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Qayta urinish
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white/40 p-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <UserCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-[var(--text-primary,#1D1D1F)] dark:text-white">
              Biometrik davomat
            </div>
            <div className="truncate text-[11px] text-[var(--text-secondary,#86868B)]">
              Yuz aniqlanganda davomat real vaqtda qayd etiladi
            </div>
          </div>
        </div>
        <Link
          to="/face"
          onClick={() => sound.playTick()}
          className="jewel-pill jewel-blue text-xs font-bold py-1 px-3 flex items-center gap-1"
        >
          Boshqaruv
          <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export default LiveFaceCamera;
