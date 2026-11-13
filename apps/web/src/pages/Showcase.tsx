import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppleInnovationShowcaseHub } from '@/components/showcase/AppleInnovationShowcaseHub';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import {
  Sparkles,
  Presentation,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const Showcase = memo(function Showcase() {
  usePageTitle(' Apple Innovation Suite — Taqdimot va Flagmanlar');
  const haptics = useHaptics();
  const sounds = usePremiumSound();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoTour, setAutoTour] = useState(false);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) sounds.playPop();
      return next;
    });
  }, [sounds]);

  return (
    <div className="min-h-screen space-y-8 pb-16">
      {/* Top Controls Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/40 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30">
            <Presentation size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                M-EDU Spatial Keynote Showcase
              </h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
                Live Enterprise v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Investorlar, direktorlar va taqdimotlar uchun eksklyuziv interaktiv rejim
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? "Ovozni o'chirish" : 'Ovozni yoqish'}
            className="flex items-center gap-1.5 rounded-xl border border-black/5 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            {soundEnabled ? (
              <>
                <Volume2 size={15} className="text-blue-500" />
                <span className="hidden sm:inline">Audio Ochiq</span>
              </>
            ) : (
              <>
                <VolumeX size={15} className="text-slate-400" />
                <span className="hidden sm:inline">Audio O&apos;chiq</span>
              </>
            )}
          </button>

          <Link
            to="/executive-dashboard"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition-all hover:brightness-110 active:scale-95"
          >
            <span>Executive Suite</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Main Innovation Showcase Stage */}
      <AppleInnovationShowcaseHub />
    </div>
  );
});

export default Showcase;
