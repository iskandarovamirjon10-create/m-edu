import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Brain,
  Sparkles,
  AlertTriangle,
  X,
  Target,
} from 'lucide-react';
import '@/styles/arena-liquid.css';

interface ArenaAiCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  duelSummary?: {
    totalRounds: number;
    correctCount: number;
    avgSpeedSec: number;
    subject: string;
  } | null;
}

export function ArenaAiCoachModal({
  isOpen,
  onClose,
  duelSummary,
}: ArenaAiCoachModalProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl arena-glass rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25">
              <Brain className="w-6 h-6" />
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                <Sparkles className="w-3.5 h-3.5" /> AI Kognitiv Tahlilchi
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Shaxsiy Duel Refleksiyasi & Kognitiv Profil
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Yopish" className="w-9 h-9 min-h-[44px] min-w-[44px] rounded-full arena-inset flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cognitive Index Telemetry Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl arena-inset text-center border border-black/[0.05] dark:border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Qat’iyatlilik
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-500 mt-0.5">88%</div>
            <div className="text-[10px] text-slate-400">Birinchi tanlov ishonchi</div>
          </div>

          <div className="p-3.5 rounded-2xl arena-inset text-center border border-black/[0.05] dark:border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Bosim Chidamliligi
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-cyan-400 mt-0.5">
              74%
            </div>
            <div className="text-[10px] text-slate-400">&lt;4s qolgandagi aniqlik</div>
          </div>

          <div className="p-3.5 rounded-2xl arena-inset text-center border border-black/[0.05] dark:border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Refleks Tezligi
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-500 mt-0.5">
              {duelSummary?.avgSpeedSec ? `${duelSummary.avgSpeedSec}s` : '5.2s'}
            </div>
            <div className="text-[10px] text-slate-400">Optimal reaksiya</div>
          </div>
        </div>

        {/* Thinking Traps & Distractor Detector */}
        <div className="p-5 rounded-2xl arena-inset border border-amber-500/25 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Kognitiv Qopqonlar & Psixologik Detektor:</span>
          </div>

          <ul className="text-xs space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed list-disc list-inside">
            <li>
              <span className="font-bold">Shoshilish effekti:</span> Savol matnidagi inkor iboralariga e’tibor qaratmasdan javob berish holati kuzatildi.
            </li>
            <li>
              <span className="font-bold">Chalg‘ituvchi variant:</span> Bosh harflari yoki sonlar kattaligi o‘xshash bo‘lgan variantlarga ehtiyotkorlik bilan yondashish zarur.
            </li>
          </ul>
        </div>

        {/* 3-Step Action Plan */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>AI Murabbiy Tavsiya Qilgan 3 Bosqichli Reja:</span>
          </h4>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl arena-glass border border-black/[0.05] dark:border-white/10 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                1
              </span>
              <div>
                <div className="font-bold text-slate-900 dark:text-white">
                  Xatolar Laboratoriyasida Mashq Qilish
                </div>
                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Adashilgan savollarni reyting bosimisiz qayta yechib, formulani eslang.
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl arena-glass border border-black/[0.05] dark:border-white/10 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-cyan-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                2
              </span>
              <div>
                <div className="font-bold text-slate-900 dark:text-white">
                  Dastlabki 3 Soniyani Savolni O‘qishga Ajrating
                </div>
                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Raqib tez javob bersa ham, o‘z tempingizni yo‘qotmang — aniqlik tezlikdan muhimroq.
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl arena-glass border border-black/[0.05] dark:border-white/10 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                3
              </span>
              <div>
                <div className="font-bold text-slate-900 dark:text-white">
                  LMS Kursidagi Tegishli Mavzuni Qaytadan Ko‘rish
                </div>
                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Xatolar sabab bo‘lgan mavzu bo‘yicha 10 daqiqalik konspektni takrorlang.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-md active:scale-95 transition-all"
          >
            Tushundim, Rahmat!
          </button>
        </div>
      </motion.div>
    </div>
    )}
  </AnimatePresence>,
  document.body,
  );
}
