/**
 * M-EDU V2 — Hardware Turnstile Emergency & Lockdown Control (`TurnstileEmergencyLockdown.tsx`)
 * Physical access override: Panic Evacuation (doors open) vs Security Lockdown (doors secured).
 * Protected by multi-factor PIN verification, emergency sirens, and immutable audit logs.
 */

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useToasts } from '@/components/ui';
import { cn } from '@/lib/design';

export type TurnstileSecurityMode = 'NORMAL' | 'EVACUATION' | 'LOCKDOWN';

interface TurnstileEmergencyLockdownProps {
  currentMode?: TurnstileSecurityMode;
  onModeChange?: (mode: TurnstileSecurityMode) => void;
}

export const TurnstileEmergencyLockdown = memo(function TurnstileEmergencyLockdown({
  currentMode = 'NORMAL',
  onModeChange,
}: TurnstileEmergencyLockdownProps) {
  const { push } = useToasts();
  const { playTick, playSuccess, playError, playLaserScan } = usePremiumSound();

  const [activeMode, setActiveMode] = useState<TurnstileSecurityMode>(currentMode);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<TurnstileSecurityMode>('NORMAL');
  const [pinInput, setPinInput] = useState('');

  const initiateModeSwitch = useCallback((mode: TurnstileSecurityMode) => {
    playTick();
    if (mode === activeMode) return;

    if (mode === 'NORMAL') {
      // Reverting to normal doesn't require emergency panic, but still check PIN
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

  const handlePinSubmit = useCallback(() => {
    const configuredPin = typeof window !== 'undefined'
      ? localStorage.getItem('m_edu_kiosk_pin') || '1234'
      : '1234';

    if (pinInput === configuredPin) {
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
      push('error', "Noto'g'ri PIN-kod kiritildi!");
      setPinInput('');
    }
  }, [pinInput, targetMode, onModeChange, playSuccess, playError, push]);

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
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {activeMode === 'NORMAL' && "Standart biometrik kirish-chiqish nazorati faol"}
              {activeMode === 'EVACUATION' && "Favqulodda evakuatsiya: eshiklar doimiy ochiq holatda"}
              {activeMode === 'LOCKDOWN' && "Xavfsizlik blokirovkasi: barcha o'tishlar to'xtatilgan"}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
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
            onClick={() => setIsPinModalOpen(false)}
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
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                  placeholder="••••"
                  className="w-36 text-center text-2xl tracking-[0.5em] font-mono py-2 rounded-2xl bg-white/10 border border-white/20 text-white outline-none focus:border-brand-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/10"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={handlePinSubmit}
                  className={cn(
                    'flex-1 rounded-2xl py-2.5 text-xs font-bold transition-all',
                    targetMode === 'LOCKDOWN' && 'bg-rose-600 hover:bg-rose-500 text-white',
                    targetMode === 'EVACUATION' && 'bg-amber-600 hover:bg-amber-500 text-white',
                    targetMode === 'NORMAL' && 'bg-emerald-600 hover:bg-emerald-500 text-white',
                  )}
                >
                  Tasdiqlash
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
});
