/**
 * GlobalCalculator V3 — Apple Pro Edition
 *
 * Premium craft:
 *   • Dynamic auto-scaling LCD font sizing (5xl -> 4xl -> 3xl -> 2xl)
 *   • Formatted thousands display (e.g. 1 250 000) for instant legibility
 *   • Real Web Audio tactile click feedback with Mute toggle
 *   • iOS-style glowing active operator state
 *   • Instant 1-click education discount presets (5%, 10%, 15%, 20%, 30%, 50%)
 *   • Full keyboard support: 0-9, . + - * / Enter Backspace Escape % c
 *   • Focus trap + aria-modal + focus restore
 *   • History with 1-click recall & AI Copilot handoff
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Calculator as CalculatorIcon,
  X,
  Copy,
  Check,
  Sparkles,
  Clock,
  Users,
  Info,
  Plus,
  Minus,
  Divide,
  X as MultiplyIcon,
  Tag,
  TrendingUp,
  Volume2,
  VolumeX,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '@/stores/ui.store';
import { useCalculator, type HistoryItem } from './useCalculator';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { GlassTabs } from '@/components/ui/GlassTabs';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const SPRING_SMOOTH = { type: 'spring', stiffness: 360, damping: 30, mass: 0.85 } as const;

const AI_EVENT_NAME = 'medu:ask-ai' as const;
const LEGACY_AI_EVENT = 'ask-ai' as const;

const KEY_TO_DIGIT: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
};

/* ============================================================================
 * FOCUS TRAP
 * ========================================================================== */

function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(focusableSelector));

    const first = getFocusable()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active, ref]);
}

/* ============================================================================
 * CALC BUTTON
 * ========================================================================== */

type CalcVariant = 'default' | 'primary' | 'secondary' | 'danger' | 'accent';

const CALC_BASE =
  'relative flex h-12 select-none items-center justify-center rounded-[var(--radius-xl)] font-medium transition-all duration-150 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

function calcVariantClass(variant: CalcVariant, active: boolean): string {
  switch (variant) {
    case 'primary':
      return active
        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-300 scale-[1.02]'
        : 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30';
    case 'secondary':
      return 'bg-black/[0.05] text-slate-700 hover:bg-black/[0.09] border border-black/5 dark:bg-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.12] dark:border-white/5';
    case 'danger':
      return 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/30 dark:border-rose-500/30';
    case 'accent':
      return 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 hover:brightness-110';
    case 'default':
    default:
      return 'bg-black/[0.03] text-slate-900 hover:bg-black/[0.07] border border-black/5 text-lg font-normal dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.1] dark:border-white/5';
  }
}

function CalcBtn({
  children,
  onClick,
  variant = 'default',
  active = false,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: CalcVariant;
  active?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={variant === 'primary' ? active : undefined}
      className={`${CALC_BASE} ${calcVariantClass(variant, active)}`}
    >
      {children}
    </button>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

type Tab = 'basic' | 'finance';

export function GlobalCalculator() {
  const { isCalculatorOpen, setCalculatorOpen } = useUiStore();
  const { t } = useSafeI18n();
  const sounds = usePremiumSound();

  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [financeInput, setFinanceInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('medu_calc_sound') !== 'false';
    } catch {
      return true;
    }
  });

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    currentValue,
    previousValue,
    operator,
    history,
    inputDigit,
    inputDot,
    performOperation,
    calculateEquals,
    toggleSign,
    inputPercent,
    backspace,
    clear,
    clearHistory,
    calculateDiscount,
    calculateMarkup,
    calculateInstallment,
    calculateSplit,
  } = useCalculator();

  const playClick = useCallback((type: 'tick' | 'pop' | 'success' | 'error' = 'tick') => {
    if (!soundEnabled) return;
    if (type === 'tick') sounds.playTick();
    else if (type === 'pop') sounds.playPop();
    else if (type === 'success') sounds.playSuccess();
    else if (type === 'error') sounds.playError();
  }, [soundEnabled, sounds]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('medu_calc_sound', String(next));
    } catch {
      // ignore
    }
  };

  /* Focus trap */
  useFocusTrap(dialogRef, isCalculatorOpen);

  /* Cleanup copied timeout on unmount */
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  /* Reset transient UI when modal closes */
  useEffect(() => {
    if (!isCalculatorOpen) {
      setShowHistory(false);
      setActiveTab('basic');
      setFinanceInput('');
      setCopied(false);
    }
  }, [isCalculatorOpen]);

  /* ----------------------------------------------------------------------
   * Keyboard input — full calculator support
   * -------------------------------------------------------------------- */
  useEffect(() => {
    if (!isCalculatorOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (inInput && target) {
          (target as HTMLInputElement).blur();
          return;
        }
        setCalculatorOpen(false);
        return;
      }

      if (inInput || activeTab === 'finance') return;

      if (KEY_TO_DIGIT[e.key] !== undefined) {
        e.preventDefault();
        playClick('tick');
        inputDigit(KEY_TO_DIGIT[e.key]);
        return;
      }

      switch (e.key) {
        case '.':
        case ',':
          e.preventDefault();
          playClick('tick');
          inputDot();
          break;
        case '+':
          e.preventDefault();
          playClick('tick');
          performOperation('+');
          break;
        case '-':
          e.preventDefault();
          playClick('tick');
          performOperation('-');
          break;
        case '*':
        case 'x':
          e.preventDefault();
          playClick('tick');
          performOperation('×');
          break;
        case '/':
          e.preventDefault();
          playClick('tick');
          performOperation('÷');
          break;
        case '%':
          e.preventDefault();
          playClick('tick');
          inputPercent();
          break;
        case 'Enter':
        case '=':
          e.preventDefault();
          playClick('success');
          calculateEquals();
          break;
        case 'Backspace':
          e.preventDefault();
          playClick('pop');
          backspace();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          playClick('pop');
          clear();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    isCalculatorOpen, activeTab, setCalculatorOpen,
    inputDigit, inputDot, performOperation, calculateEquals,
    inputPercent, backspace, clear, playClick,
  ]);

  /* ----------------------------------------------------------------------
   * Copy with fallback + a11y
   * -------------------------------------------------------------------- */
  const handleCopy = useCallback(async () => {
    const text = currentValue;
    if (!text) return;

    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }

    if (ok) {
      playClick('success');
      setCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [currentValue, playClick]);

  /* ----------------------------------------------------------------------
   * AI handoff — typed event + legacy fallback
   * -------------------------------------------------------------------- */
  const handleAskAi = useCallback((item: HistoryItem) => {
    const prompt = `Iltimos, ushbu hisob-kitobni tushuntirib bering: ${item.expression} = ${item.result}`;
    const detail = { prompt, source: 'calculator' };
    try {
      window.dispatchEvent(new CustomEvent(AI_EVENT_NAME, { detail }));
      window.dispatchEvent(new CustomEvent(LEGACY_AI_EVENT, { detail: prompt }));
    } catch {
      // ignore
    }
    setCalculatorOpen(false);
  }, [setCalculatorOpen]);

  /* ----------------------------------------------------------------------
   * Finance actions & presets
   * -------------------------------------------------------------------- */
  const handleFinanceAction = useCallback((action: 'discount' | 'markup' | 'installment' | 'split', customVal?: number) => {
    const val = customVal !== undefined ? customVal : parseFloat(financeInput);
    if (Number.isNaN(val)) return;
    playClick('success');
    switch (action) {
      case 'discount':    calculateDiscount(val);    break;
      case 'markup':      calculateMarkup(val);      break;
      case 'installment': calculateInstallment(val); break;
      case 'split':       calculateSplit(val);       break;
    }
    setFinanceInput('');
    setActiveTab('basic');
  }, [financeInput, calculateDiscount, calculateMarkup, calculateInstallment, calculateSplit, playClick]);

  const isError = currentValue === 'Error';

  // Dynamic font sizing for large numbers (Apple style)
  const displayFontSize = useMemo(() => {
    const len = currentValue.length;
    if (len <= 7) return 'text-4xl sm:text-5xl';
    if (len <= 10) return 'text-3xl sm:text-4xl';
    if (len <= 13) return 'text-2xl sm:text-3xl';
    return 'text-xl sm:text-2xl';
  }, [currentValue]);

  // Formatted display (thousand spaces for integers)
  const formattedDisplay = useMemo(() => {
    if (isError) return 'Error';
    const parts = currentValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
  }, [currentValue, isError]);

  const tabs = useMemo(() => [
    { id: 'basic',   label: t('calculator.basic')   || 'Asosiy' },
    { id: 'finance', label: t('calculator.finance') || 'Chegirma & Moliya' },
  ], [t]);

  if (!isCalculatorOpen) return null;

  return (
    <AnimatePresence>
      {isCalculatorOpen && (
        <>
          {/* Backdrop — mobile only */}
          <motion.div
            key="calc-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setCalculatorOpen(false)}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            key="calc-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('calculator.title') || 'Calculator'}
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={SPRING_SMOOTH}
            className={[
              'fixed right-3 z-[150] flex w-[370px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden',
              'inset-y-3 lg:inset-y-auto lg:top-[var(--top-bar-height,5rem)] lg:bottom-4',
              'rounded-3xl border border-black/10 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-slate-900/95 dark:text-white',
            ].join(' ')}
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-4 py-3 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20">
                  <CalculatorIcon size={16} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                  {t('calculator.premiumTitle') || 'Kalkulyator'}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                {/* Sound Mute/Unmute */}
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-label={soundEnabled ? 'Ovozni o’chirish' : 'Ovozni yoqish'}
                  title={soundEnabled ? 'Ovozni o’chirish' : 'Ovozni yoqish'}
                  className="rounded-xl p-1.5 text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-slate-400 dark:text-slate-500" />}
                </button>

                {/* History toggle */}
                <button
                  type="button"
                  onClick={() => {
                    playClick('pop');
                    setShowHistory((v) => !v);
                  }}
                  aria-label={t('calculator.history') || 'Tarix'}
                  aria-pressed={showHistory}
                  className={`rounded-xl p-1.5 transition-colors ${
                    showHistory
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : 'text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                >
                  <Clock size={16} />
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={() => setCalculatorOpen(false)}
                  aria-label={t('common.close') || 'Yopish'}
                  className="rounded-xl p-1.5 text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              {showHistory ? (
                <HistoryPanel
                  history={history}
                  onClear={clearHistory}
                  onAskAi={handleAskAi}
                  onSelect={(val) => {
                    playClick('tick');
                    inputDigit(val);
                    setShowHistory(false);
                  }}
                />
              ) : (
                <div className="flex flex-1 flex-col">
                  {/* LCD Display */}
                  <div className="flex flex-col items-end gap-1 px-5 py-5 bg-gradient-to-b from-black/[0.03] to-transparent dark:from-black/40 border-b border-black/5 dark:border-white/5">
                    <div className="h-5 text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wider">
                      {previousValue != null ? `${previousValue} ${operator}` : ''}
                    </div>

                    <div className="flex w-full items-center justify-between">
                      <button
                        type="button"
                        onClick={handleCopy}
                        aria-label={t('calc.copy')}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                        title="Nusxalash"
                      >
                        {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>

                      <div
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        className={`tabular-nums font-light tracking-tight transition-all select-all ${displayFontSize} ${
                          isError ? 'text-rose-500 font-medium' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {formattedDisplay}
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="border-b border-black/10 dark:border-white/10 px-4 bg-black/[0.01] dark:bg-white/[0.01]">
                    <GlassTabs
                      tabs={tabs}
                      active={activeTab}
                      onChange={(id) => {
                        playClick('pop');
                        setActiveTab(id as Tab);
                      }}
                      variant="underline"
                      size="sm"
                      aria-label={t('calc.types')}
                    />
                  </div>

                  {/* Keypad */}
                  {activeTab === 'basic' ? (
                    <div className="grid flex-1 grid-cols-4 gap-2 p-4">
                      <CalcBtn
                        onClick={() => { playClick('pop'); clear(); }}
                        variant="danger"
                        label="Tozalash"
                      >
                        AC
                      </CalcBtn>
                      <CalcBtn
                        onClick={() => { playClick('pop'); backspace(); }}
                        variant="secondary"
                        label="O’chirish"
                      >
                        ⌫
                      </CalcBtn>
                      <CalcBtn
                        onClick={() => { playClick('tick'); inputPercent(); }}
                        variant="secondary"
                        label="Foiz"
                      >
                        %
                      </CalcBtn>
                      <CalcBtn
                        onClick={() => { playClick('tick'); performOperation('÷'); }}
                        variant="primary"
                        active={operator === '÷'}
                        label="Bo’lish"
                      >
                        <Divide size={18} />
                      </CalcBtn>

                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('7'); }}>7</CalcBtn>
                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('8'); }}>8</CalcBtn>
                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('9'); }}>9</CalcBtn>
                      <CalcBtn
                        onClick={() => { playClick('tick'); performOperation('×'); }}
                        variant="primary"
                        active={operator === '×'}
                        label="Ko’paytirish"
                      >
                        <MultiplyIcon size={18} />
                      </CalcBtn>

                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('4'); }}>4</CalcBtn>
                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('5'); }}>5</CalcBtn>
                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('6'); }}>6</CalcBtn>
                      <CalcBtn
                        onClick={() => { playClick('tick'); performOperation('-'); }}
                        variant="primary"
                        active={operator === '-'}
                        label="Ayirish"
                      >
                        <Minus size={18} />
                      </CalcBtn>

                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('1'); }}>1</CalcBtn>
                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('2'); }}>2</CalcBtn>
                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('3'); }}>3</CalcBtn>
                      <CalcBtn
                        onClick={() => { playClick('tick'); performOperation('+'); }}
                        variant="primary"
                        active={operator === '+'}
                        label="Qo’shish"
                      >
                        <Plus size={18} />
                      </CalcBtn>

                      <CalcBtn onClick={() => { playClick('tick'); toggleSign(); }} variant="secondary" label="Musbat/Manfiy">±</CalcBtn>
                      <CalcBtn onClick={() => { playClick('tick'); inputDigit('0'); }}>0</CalcBtn>
                      <CalcBtn onClick={() => { playClick('tick'); inputDot(); }} variant="secondary" label="Nuqta">.</CalcBtn>
                      <CalcBtn
                        onClick={() => { playClick('success'); calculateEquals(); }}
                        variant="accent"
                        label="Teng"
                      >
                        =
                      </CalcBtn>
                    </div>
                  ) : (
                    /* Finance & Education Discount Tab */
                    <div className="flex flex-1 flex-col gap-3.5 p-4 overflow-y-auto">
                      <div>
                        <label
                          htmlFor="calc-finance-input"
                          className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          Qiymat (Foiz %, oylar yoki odamlar soni)
                        </label>
                        <input
                          id="calc-finance-input"
                          type="number"
                          inputMode="decimal"
                          value={financeInput}
                          onChange={(e) => setFinanceInput(e.target.value)}
                          placeholder="Masalan: 15"
                          className="w-full rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:placeholder-slate-500"
                        />
                      </div>

                      {/* Quick Discount Presets for Educational Center */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                          Tezkor Chegirmalar (1-bosishda):
                        </span>
                        <div className="grid grid-cols-6 gap-1.5">
                          {[5, 10, 15, 20, 30, 50].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => handleFinanceAction('discount', pct)}
                              className="rounded-xl border border-blue-500/30 bg-blue-500/10 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-500/20 active:scale-95 transition-all dark:text-blue-300"
                            >
                              -{pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleFinanceAction('discount')}
                          disabled={!financeInput}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-xs font-bold text-slate-800 hover:bg-black/[0.05] active:scale-95 disabled:opacity-40 transition-all dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                        >
                          <Tag size={14} className="text-amber-500" />
                          <span>Chegirma qo’llash</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFinanceAction('markup')}
                          disabled={!financeInput}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-xs font-bold text-slate-800 hover:bg-black/[0.05] active:scale-95 disabled:opacity-40 transition-all dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                        >
                          <TrendingUp size={14} className="text-emerald-500" />
                          <span>Ustama (Komissiya)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFinanceAction('installment')}
                          disabled={!financeInput}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-xs font-bold text-slate-800 hover:bg-black/[0.05] active:scale-95 disabled:opacity-40 transition-all dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                        >
                          <Clock size={14} className="text-cyan-600 dark:text-cyan-400" />
                          <span>Bo’lib to’lash (Oy)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFinanceAction('split')}
                          disabled={!financeInput}
                          className="flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-black/[0.02] p-3 text-xs font-bold text-slate-800 hover:bg-black/[0.05] active:scale-95 disabled:opacity-40 transition-all dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                        >
                          <Users size={14} className="text-purple-600 dark:text-purple-400" />
                          <span>Taqsimlash (Odam)</span>
                        </button>
                      </div>

                      {/* Hint */}
                      <div className="mt-auto flex gap-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3 text-blue-700 dark:text-blue-300">
                        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
                        <p className="text-xs leading-relaxed">
                          Hozirgi summa: <strong className="text-slate-900 dark:text-white">{formattedDisplay} so’m</strong>. Yuqorida foiz yoki muddatni tanlab, hisob-kitob qiling.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
 * HISTORY PANEL
 * ========================================================================== */

function HistoryPanel({
  history,
  onClear,
  onAskAi,
  onSelect,
}: {
  history: HistoryItem[];
  onClear: () => void;
  onAskAi: (item: HistoryItem) => void;
  onSelect: (result: string) => void;
}) {
  const { t } = useSafeI18n();

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 scrollbar-thin">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('calculator.historyTitle') || 'Hisob-Kitob Tarixi'}
        </h4>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-rose-500 hover:underline"
          >
            {t('common.clear') || 'Tozalash'}
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex h-36 flex-col items-center justify-center text-slate-400 text-xs">
          <Clock size={24} className="mb-2 opacity-40" />
          <p>Hozircha tarix mavjud emas</p>
        </div>
      ) : (
        <ul role="list" className="flex flex-col gap-2.5">
          {history.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-2xl border border-black/5 bg-black/[0.02] p-3 transition-colors hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            >
              <div className="text-right text-xs text-slate-500 dark:text-slate-400 font-mono">
                {item.expression} =
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSelect(item.result)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  title="Kalkulyatorga yuklash"
                >
                  <RotateCcw size={12} />
                  <span>Qayta yuklash</span>
                </button>
                <div className="text-right text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {item.result}
                </div>
              </div>
              <div className="mt-1 flex justify-end gap-2 border-t border-black/5 dark:border-white/5 pt-2">
                <button
                  type="button"
                  onClick={() => onAskAi(item)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  <Sparkles size={13} />
                  <span>AI bilan tahlil qilish</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}