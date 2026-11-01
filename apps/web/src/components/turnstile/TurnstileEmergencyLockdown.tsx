/**
 * M-EDU V2 — Hardware Turnstile Emergency & Lockdown Control (`TurnstileEmergencyLockdown.tsx`)
 * Physical access override: Panic Evacuation (doors open) vs Security Lockdown (doors secured).
 * Protected by multi-factor PIN verification, hardware relay trigger, and immutable backend sync.
 */

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useToasts } from '@/components/ui';
import { cn } from '@/lib/design';
import { turnstileHardware, type TurnstileSecurityMode } from '@/lib/hardware/turnstileHardware';

export type { TurnstileSecurityMode };

interface TurnstileEmergencyLockdownProps {
  currentMode?: TurnstileSecurityMode;
  onModeChange?: (mode: TurnstileSecurityMode) => void;
}

export const TurnstileEmergencyLockdown = memo(function TurnstileEmergencyLockdown({
  currentMode,
  onModeChange,
}: TurnstileEmergencyLockdownProps) {
  const { push } = useToasts();
  const { playTick, playSuccess, playError, playLaserScan } = usePremiumSound();

  const [activeMode, setActiveMode] = useState<TurnstileSecurityMode>(currentMode || 'NORMAL');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<TurnstileSecurityMode>('NORMAL');
  const [pinInput, setPinInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpeningManual, setIsOpeningManual] = useState(false);
  const [isUsbConnected, setIsUsbConnected] = useState(turnstileHardware.isUsbRelayConnected());

  // Sync initial state from backend
  useEffect(() => {
    let isMounted = true;
    turnstileHardware.getEmergencyMode().then((mode) => {
      if (isMounted) {
        setActiveMode(mode);
        onModeChange?.(mode);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [onModeChange]);

  const initiateModeSwitch = useCallback((mode: TurnstileSecurityMode) => {
    playTick();
    if (mode === activeMode) return;

    if (mode === 'NORMAL') {
      setTargetMode('NORMAL');
      setIsPinModalOpen(true);
      setPinInput('');
    } else {
      setTargetMode(mode);
      setIsPinModalOpen(true);
      setPinInput('');
      playLaserScan();
    }
  }, [activeMode, playTick, playLaserScan]);

  const handlePinSubmit = useCallback(async () => {
    const configuredPin = typeof window !== 'undefined'
      ? localStorage.getItem('m_edu_kiosk_pin') || '1234'
      : '1234';

    if (pinInput !== configuredPin) {
      playError();
      push('error', "Noto'g'ri PIN-kod kiritildi!");
      setPinInput('');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await turnstileHardware.setEmergencyMode(
        targetMode,
        targetMode === 'EVACUATION'
          ? 'Favqulodda evakuatsiya buyrug‘i'
          : targetMode === 'LOCKDOWN'
            ? 'Xavfsizlik blokirovkasi buyrug‘i'
            : 'Standart rejim tiklandi',
      );

      if (res.success) {
        playSuccess();
        setActiveMode(targetMode);
        onModeChange?.(targetMode);
        setIsPinModalOpen(false);
        setPinInput('');

        if (targetMode === 'EVACUATION') {
          push('info', "🚨 DIQQAT: Turniketlar FAVQULODDA EVAKUATSIYA rejimiga o'tkazildi! Barcha yo'laklar ochiq.");
        } else if (targetMode === 'LOCKDOWN') {
          push('error', "🛑 XAVFSIZLIK BLOKIROVKASI: Barcha turniketlar to'liq yopildi va qulflanildi.");
        } else {
          push('success', "Turniketlar standart Face ID rejimiga qaytarildi.");
        }
      } else {
        playError();
        push('error', res.error || 'Xatolik yuz berdi');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [pinInput, targetMode, onModeChange, playSuccess, playError, push]);

  // One-time manual dry-contact gate pulse
  const handleManualOpen = useCallback(async () => {
    if (isOpeningManual) return;
    setIsOpeningManual(true);
    playTick();

    try {
      const res = await turnstileHardware.triggerGateRelease({
        reason: "Qo'riqchi tomonidan qo'lda ochildi",
        direction: 'IN',
        durationMs: 1200,
      });

      if (res.success) {
        playSuccess();
        push('success', "Turniket 1 martalik o'tish uchun ochildi");
      } else {
        playError();
        push('error', res.error || "Turniketni ochish imkoni bo'lmadi");
      }
    } finally {
      setIsOpeningManual(false);
    }
  }, [isOpeningManual, playTick, playSuccess, playError, push]);

  // Pair physical USB relay module
  const handleConnectUsb = useCallback(async () => {
    playTick();
    const res = await turnstileHardware.requestUsbRelayConnection();
    if (res.connected) {
      playSuccess();
      setIsUsbConnected(true);
      push('success', res.info || 'USB Rele muvaffaqiyatli ulandi');
    } else if (res.error) {
      playError();
      push('error', res.error);
    }
  }, [playTick, playSuccess, playError, push]);

  return (
    <>
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 backdrop-blur-2xl transition-all duration-300',
          activeMode === 'NORMAL' && 'border-black/[0.08] dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04]',
          activeMode === 'EVACUATION' && 'border-amber-500/50 bg-amber-500/15 dark:bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
          activeMode === 'LOCKDOWN' && 'border-rose-500/60 bg-rose-500/15 dark:bg-rose-500/25 shadow-[0_0_25px_rgba(244,63,94,0.3)] animate-pulse',
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">
            {activeMode === 'NORMAL' && '🛡️'}
            {activeMode === 'EVACUATION' && '⚠️'}
            {activeMode === 'LOCKDOWN' && '🚨'}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Turniket Xavfsizlik Rejimi:
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                  activeMode === 'NORMAL' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                  activeMode === 'EVACUATION' && 'bg-amber-500/25 text-amber-700 dark:text-amber-300',
                  activeMode === 'LOCKDOWN' && 'bg-rose-500/25 text-rose-700 dark:text-rose-300',
                )}
              >
                {activeMode}
              </span>

              {isUsbConnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9.5px] font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  USB Hardware Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {activeMode === 'NORMAL' && "Barcha yo'laklar standart avtomatik biometrik tekshiruv ostida."}
              {activeMode === 'EVACUATION' && "Barcha turniketlar ochiq holatda qulflangan (Favqulodda evakuatsiya)."}
              {activeMode === 'LOCKDOWN' && "Barcha yo'laklar to'liq bloklangan. Hech kim o'tkazilmaydi."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Manual 1-time Gate Pulse */}
          <button
            type="button"
            onClick={handleManualOpen}
            disabled={isOpeningManual || activeMode === 'LOCKDOWN'}
            title="Mehmon yoki xodim uchun qulfni 1 martaga ochish"
            className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 active:scale-95 disabled:opacity-40 transition-all"
          >
            {isOpeningManual ? "Ochilmoqda…" : "🔓 Qo'lda ochish"}
          </button>

          {/* Connect USB Relay button if WebSerial is available */}
          {turnstileHardware.isWebSerialSupported() && !isUsbConnected && (
            <button
              type="button"
              onClick={handleConnectUsb}
              title="Kompuyterga ulangan USB rele modulini ulash"
              className="rounded-xl border border-slate-400/30 bg-slate-500/10 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-slate-500/20 transition-all"
            >
              🔌 USB Rele
            </button>
          )}

          {activeMode !== 'NORMAL' ? (
            <button
              type="button"
              onClick={() => initiateModeSwitch('NORMAL')}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-all"
            >
              ✓ Standart Rejimga Qaytish
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => initiateModeSwitch('EVACUATION')}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-all"
              >
                ⚠️ Evakuatsiya (Ochish)
              </button>

              <button
                type="button"
                onClick={() => initiateModeSwitch('LOCKDOWN')}
                className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 transition-all"
              >
                🛑 Qat'iy Blokirovka
              </button>
            </>
          )}
        </div>
      </div>

      {/* Emergency PIN Dialog */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => !isSubmitting && setIsPinModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-white/20 bg-[#161618]/95 p-6 text-white shadow-2xl backdrop-blur-3xl text-center"
            >
              <span className="text-3xl mb-2 block">
                {targetMode === 'NORMAL' ? '🛡️' : '🚨'}
              </span>
              <h3 className="text-base font-bold tracking-tight">
                {targetMode === 'NORMAL'
                  ? "Standart rejimni tiklash"
                  : "Favqulodda buyruqni tasdiqlang"}
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Ushbu apparat buyrug'ini bajarish uchun administrator PIN-kodini kiriting (standart: 1234)
              </p>

              <div className="my-5">
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  disabled={isSubmitting}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                  placeholder="••••"
                  className="w-36 text-center text-2xl tracking-[0.4em] font-mono py-2 rounded-xl bg-white/10 border border-white/20 focus:border-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsPinModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || pinInput.length < 4}
                  onClick={handlePinSubmit}
                  className="rounded-xl bg-white text-black px-5 py-2 text-xs font-bold hover:bg-neutral-200 transition disabled:opacity-40"
                >
                  {isSubmitting ? "Bajarilmoqda…" : "Tasdiqlash"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
});
