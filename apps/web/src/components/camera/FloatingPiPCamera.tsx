/**
 * ============================================================================
 * M-EDU Apple visionOS Floating PiP (Picture-in-Picture) Live Camera
 * ============================================================================
 *
 * Draggable, multi-size ambient camera monitor that persists across all routes:
 *  - Real-time webcam stream via getUserMedia with active Face ID reticle
 *  - Minimalist traffic lights, compact pill mode, standard PiP, and expanded mode
 *  - Magnetic drag bounds, tactile audio ticks, and specular Liquid Glass chassis
 *  - Live attendance detection ticker and quick actions
 * ============================================================================
 */

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Maximize2,
  Minimize2,
  X,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useFloatingCameraOpen, closeFloatingCamera } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { cn } from '@/lib/design';
import { GlassSurface } from '@/components/ui';

type PiPSize = 'compact' | 'standard' | 'expanded';

interface RecentAttendanceRecord {
  id: string;
  name: string;
  group: string;
  time: string;
}

export const FloatingPiPCamera = memo(function FloatingPiPCamera() {
  const isOpen = useFloatingCameraOpen();
  const sound = usePremiumSound();

  const [pipSize, setPipSize] = useState<PiPSize>('standard');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [recentAttendee, setRecentAttendee] = useState<RecentAttendanceRecord | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Start webcam when opened
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Kamera brauzerda qo\'llab-quvvatlanmaydi');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        sound.playFaceIdMatch();
      }
    } catch {
      // Fallback demo simulation mode so UI is always functional
      setIsCameraActive(false);
      setCameraError('Kamera ulanmadi (Demo monitoring rejimida)');
    }
  }, [sound]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Real-time Face ID attendance monitoring via global event bus
  useEffect(() => {
    if (!isOpen) return;
    const handleDetection = (event: Event) => {
      const custom = event as CustomEvent<RecentAttendanceRecord>;
      if (custom.detail) {
        setRecentAttendee(custom.detail);
        if (!isMuted) {
          sound.playFaceIdMatch();
        }
      }
    };
    window.addEventListener('medu:attendance-logged', handleDetection);
    return () => {
      window.removeEventListener('medu:attendance-logged', handleDetection);
    };
  }, [isOpen, isMuted, sound]);

  const handleClose = useCallback(() => {
    sound.playPop();
    closeFloatingCamera();
  }, [sound]);

  const handleToggleSize = useCallback(() => {
    sound.playTick();
    setPipSize((curr) => {
      if (curr === 'compact') return 'standard';
      if (curr === 'standard') return 'expanded';
      return 'compact';
    });
  }, [sound]);

  const handleToggleMute = useCallback(() => {
    sound.playTick();
    setIsMuted((prev) => !prev);
  }, [sound]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={{ left: -window.innerWidth + 360, right: 0, top: -window.innerHeight + 260, bottom: 0 }}
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 30 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="fixed bottom-6 right-6 z-[9980] select-none"
      >
        <GlassSurface
          tone="frost"
          elevation="floating"
          className={cn(
            'overflow-hidden shadow-2xl border border-white/60 dark:border-white/[0.14] rounded-3xl transition-all duration-300',
            pipSize === 'compact' && 'w-72 h-36',
            pipSize === 'standard' && 'w-80 h-64 sm:w-96 sm:h-72',
            pipSize === 'expanded' && 'w-96 h-80 sm:w-[28rem] sm:h-96',
          )}
        >
          {/* Top Traffic Light Bar & Drag Handle */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-black/[0.03] dark:bg-white/[0.04] border-b border-black/[0.05] dark:border-white/[0.08] cursor-move">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors flex items-center justify-center text-white/90"
                title="Yopish"
              >
                <X className="w-2 h-2 opacity-0 hover:opacity-100" />
              </button>
              <button
                type="button"
                onClick={handleToggleSize}
                className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors flex items-center justify-center text-white/90"
                title="O'lchamni almashtirish"
              >
                <Minimize2 className="w-2 h-2 opacity-0 hover:opacity-100" />
              </button>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />

              <span className="ml-1 text-[11px] font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-apple-blue" />
                Live Face PiP
              </span>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleMute}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title={isMuted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleToggleSize}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="O'lcham"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Camera Viewport & Overlay */}
          <div className="relative w-full h-[calc(100%-42px)] bg-black/90 overflow-hidden flex items-center justify-center">
            {/* Live HTML5 Video Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'absolute inset-0 w-full h-full object-cover',
                !isCameraActive && 'opacity-0 pointer-events-none',
              )}
            />

            {/* Simulated Frame Fallback when webcam is unavailable */}
            {!isCameraActive && (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-apple-blue/20 flex items-center justify-center text-apple-blue mb-2 animate-pulse">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-white/90">
                  Avtomatik Davomat Monitoringi
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {cameraError || 'Kamera kutish holatida'}
                </p>
              </div>
            )}

            {/* Face ID Reticle Overlay */}
            <div className="pointer-events-none absolute inset-4 border border-white/20 rounded-xl">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-apple-blue" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-apple-blue" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-apple-blue" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-apple-blue" />

              {/* Laser scanning line */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-apple-blue to-transparent animate-pulse" style={{ top: '45%' }} />
            </div>

            {/* Live Attendee Notification Pill (Bottom bar) */}
            <div className="absolute bottom-2 inset-x-2 z-10">
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px]">
                <div className="flex items-center gap-2 truncate">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {recentAttendee ? (
                    <>
                      <span className="font-semibold truncate">{recentAttendee.name}</span>
                      {recentAttendee.group && <span className="text-white/60">({recentAttendee.group})</span>}
                    </>
                  ) : (
                    <span className="text-white/80 font-medium">Face ID monitoring faol</span>
                  )}
                </div>
                <span className="text-[10px] text-emerald-400 font-mono shrink-0">
                  {recentAttendee ? recentAttendee.time : 'Jonli'}
                </span>
              </div>
            </div>
          </div>
        </GlassSurface>
      </motion.div>
    </AnimatePresence>
  );
});
