'use client';

/**
 * ============================================================================
 * M-EDU Apple Innovation Showcase Hub (v1.0)
 * ============================================================================
 *
 * Interactive Stage presenting all 7 Apple-grade proprietary features:
 *  1.  Live Activity Stage (iOS 27 Dynamic Island & StandBy Chimes)
 *  2. 🔮 Spatial Room Hologram Studio (VisionOS 3D Classroom Twin)
 *  3. ⏳ Executive Decision Time Machine (What-if Capacity & Margin Engine)
 *  4. 🎙️ Neural Voice & Accent Diagnostic Studio (IELTS Phoneme Coach)
 *  5. 💳 Apple Wallet & Smart NFC Pass Studio (Dynamic TOTP QR & Gate Relay)
 *  6. 👁️ AI Smart Proctoring & Camera Relay (Gaze Tracking & Acoustic Shield)
 *  7. 🏛️ Executive Day-End Closing & Fiscal Hub (Z-Report & Ledger Freeze)
 * ============================================================================
 */

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/design';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';

import { AppleLiveActivityStage } from '@/components/campus/AppleLiveActivityStage';
import { SpatialRoomHologramStudio } from '@/components/campus/SpatialRoomHologramStudio';
import { ExecutiveDecisionTimeMachine } from '@/components/finance/ExecutiveDecisionTimeMachine';
import { NeuralVoiceDiagnosticStudio } from '@/components/exams/NeuralVoiceDiagnosticStudio';
import { AppleWalletPassStudio } from '@/components/cards/AppleWalletPassStudio';
import { SmartProctoringRelayStudio } from '@/components/camera/SmartProctoringRelayStudio';
import { ExecutiveDayEndClosingHub } from '@/components/finance/ExecutiveDayEndClosingHub';

export type ShowcaseFeatureKey =
  | 'live-activities'
  | 'spatial-room'
  | 'time-machine'
  | 'voice-studio'
  | 'apple-wallet'
  | 'proctoring'
  | 'fiscal-hub';

interface FeatureMeta {
  id: ShowcaseFeatureKey;
  badge: string;
  title: string;
  subtitle: string;
  icon: string;
  tagColor: string;
}

const FEATURES: FeatureMeta[] = [
  {
    id: 'live-activities',
    badge: ' iOS 27 Live Activity',
    title: 'StandBy & Dynamic Island',
    subtitle: 'Real-time turnstile check-ins, lesson countdown & audio chimes',
    icon: '',
    tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  {
    id: 'spatial-room',
    badge: 'VisionOS Spatial',
    title: '3D Room Hologram Studio',
    subtitle: 'Classroom digital twin, live occupancy & desk heatmaps',
    icon: '🔮',
    tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    id: 'time-machine',
    badge: 'Executive Engine',
    title: 'Decision Time Machine',
    subtitle: 'What-if pricing, teacher wage & margin simulation engine',
    icon: '⏳',
    tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'voice-studio',
    badge: 'Neural AI Speech',
    title: 'Voice & Accent Coach',
    subtitle: 'IELTS / CEFR phoneme acoustics & AI fluency feedback',
    icon: '🎙️',
    tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    id: 'apple-wallet',
    badge: 'Apple VAS & NFC',
    title: 'Smart Pass & Gate Relay',
    subtitle: 'Anti-screenshot dynamic rotating QR & NFC turnstile link',
    icon: '💳',
    tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'proctoring',
    badge: 'Computer Vision AI',
    title: 'Smart Exam Proctoring',
    subtitle: 'Gaze vector tracking, acoustic decibel spike detector & desk alarm',
    icon: '👁️',
    tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    id: 'fiscal-hub',
    badge: 'Fiscal Day-End',
    title: 'Z-Report & Ledger Freeze',
    subtitle: 'Multi-gateway reconciliation, SHA-256 seal & director Telegram digest',
    icon: '🏛️',
    tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  },
];

export interface AppleInnovationShowcaseHubProps {
  className?: string;
}

export const AppleInnovationShowcaseHub = memo(function AppleInnovationShowcaseHub({
  className,
}: AppleInnovationShowcaseHubProps) {
  const haptics = useHaptics();
  const sound = usePremiumSound();

  const [activeFeature, setActiveFeature] = useState<ShowcaseFeatureKey>('live-activities');

  const currentMeta = FEATURES.find((f) => f.id === activeFeature) || FEATURES[0];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Keynote Hero Presentation Banner */}
      <div className="relative rounded-3xl border border-white/10 bg-gradient-to-r from-zinc-950 via-slate-950 to-black p-6 md:p-8 backdrop-blur-3xl shadow-2xl overflow-hidden">
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-blue-500/15 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-purple-500/15 blur-[100px]" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-white/10 text-white border border-white/20 mb-3 shadow-inner">
              <span></span> M-EDU NEXT-GEN INNOVATION SUITE (7 BREAKTHROUGHS)
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Ta&apos;lim Markazlari Boshqaruvida Yangi Standart
            </h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-3xl leading-relaxed">
              O&apos;zbekiston va xalqaro bozorda raqobatchilarda mavjud bo&apos;lmagan, Apple darajasidagi eksklyuziv 7 ta texnologik modul. Taqdimot va real ekspluatatsiyada markaz nufuzini eng yuqori cho&apos;qqiga olib chiqadi.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs uppercase font-bold text-zinc-400">Tizim holati</div>
              <div className="text-sm font-black text-emerald-400 flex items-center gap-1.5 justify-end">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                7/7 Modullar Faol
              </div>
            </div>
          </div>
        </div>

        {/* Feature Switcher Pills (Horizontal Scrollable) */}
        <div className="flex items-center gap-2.5 overflow-x-auto pt-6 mt-6 border-t border-white/10 no-scrollbar">
          {FEATURES.map((item) => {
            const isSelected = activeFeature === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  haptics.light();
                  sound.playTick();
                  setActiveFeature(item.id);
                }}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 border',
                  isSelected
                    ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.25)] scale-[1.02]'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:text-white'
                )}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.title}</span>
                {isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-black ml-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Feature Subtitle Strip */}
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{currentMeta.title}:</span>
            <span>{currentMeta.subtitle}</span>
          </div>
          <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold border', currentMeta.tagColor)}>
            {currentMeta.badge}
          </span>
        </div>
      </div>

      {/* Active Feature Presentation Stage */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeFeature}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
        >
          {activeFeature === 'live-activities' && <AppleLiveActivityStage />}
          {activeFeature === 'spatial-room' && <SpatialRoomHologramStudio />}
          {activeFeature === 'time-machine' && <ExecutiveDecisionTimeMachine />}
          {activeFeature === 'voice-studio' && <NeuralVoiceDiagnosticStudio />}
          {activeFeature === 'apple-wallet' && <AppleWalletPassStudio />}
          {activeFeature === 'proctoring' && <SmartProctoringRelayStudio />}
          {activeFeature === 'fiscal-hub' && <ExecutiveDayEndClosingHub />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});
