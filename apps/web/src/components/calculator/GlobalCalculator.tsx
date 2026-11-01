/**
 * ============================================================================
 *  GlobalCalculator V5 — Apple Liquid Glass Pro Edition (Fixed)
 * ============================================================================
 *
 *  Premium features:
 *   • True visionOS / iOS 18 Liquid Glass (specular reflection + caustics)
 *   • Seamless Framer Motion spring physics (stagger, blur-morph, tactile press)
 *   • Ctrl+C / ⌘+C to copy · full keyboard support · reduced-motion aware
 *   • Finance tab with Live Preview + one-click presets
 *   • Safe recall from history + AI Copilot handoff
 *
 *  Fixed vs. V4:
 *   ✓ AnimatePresence fragment bug (exit animations were dead)
 *   ✓ pressedKey now visually flashes keys (keyboard input)
 *   ✓ SSR-safe sound preference
 *   ✓ Finance percent clamped to 0-100 · months/people floored to ints
 *   ✓ Scientific-notation results safely rejected from recall
 *   ✓ Body scroll locked while the dialog is open
 *   ✓ aria-live no longer spams on every keystroke
 *   ✓ Keypad no longer overflows on short viewports
 *   ✓ Copy shortcut label is platform-aware (⌘C / Ctrl+C)
 *   ✓ Copy disabled in error state
 * ============================================================================
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
  Trash2,
  DollarSign,
  ArrowRightLeft,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { useUiStore } from '@/stores/ui.store';
import { useCalculator, type HistoryItem } from './useCalculator';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { GlassTabs } from '@/components/ui/GlassTabs';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const SPRING_MODAL = { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 } as const;
const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 32, mass: 0.6 } as const;
const SPRING_SOFT = { type: 'spring', stiffness: 300, damping: 28, mass: 0.85 } as const;

const KEYPAD_STAGGER: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.018, delayChildren: 0.02 },
  },
};

const KEY_ITEM_VARIANT: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING_SNAPPY },
};

const AI_EVENT_NAME = 'medu:ask-ai' as const;
const LEGACY_AI_EVENT = 'ask-ai' as const;

const KEY_TO_DIGIT: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
};

const DISCOUNT_PRESETS = [5, 10, 15, 20, 30, 50] as const;
const FINANCE_PERCENT_MAX = 100;

/* ============================================================================
 * LIQUID GLASS CSS
 * ========================================================================== */

const CALC_LIQUID_CSS = `
  .calc-liquid-shell {
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.84) 0%,
      rgba(248, 250, 252, 0.72) 50%,
      rgba(241, 245, 249, 0.78) 100%
    );
    backdrop-filter: blur(40px) saturate(210%);
    -webkit-backdrop-filter: blur(40px) saturate(210%);
    border: 1px solid rgba(255, 255, 255, 0.85);
    box-shadow:
      0 32px 70px -16px rgba(15, 23, 42, 0.22),
      0 8px 24px -6px rgba(15, 23, 42, 0.08),
      inset 0 1.5px 0 0 rgba(255, 255, 255, 0.95),
      inset 1px 0 0 0 rgba(255, 255, 255, 0.6);
  }
  .dark .calc-liquid-shell {
    background: linear-gradient(
      145deg,
      rgba(30, 41, 59, 0.72) 0%,
      rgba(15, 23, 42, 0.64) 55%,
      rgba(9, 14, 26, 0.76) 100%
    );
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow:
      0 36px 80px -16px rgba(0, 0, 0, 0.75),
      0 10px 30px -8px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.28),
      inset 1px 0 0 0 rgba(255, 255, 255, 0.1);
  }
  .calc-liquid-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      118deg,
      rgba(255, 255, 255, 0.32) 0%,
      rgba(255, 255, 255, 0.06) 28%,
      transparent 48%,
      rgba(255, 255, 255, 0.08) 100%
    );
    pointer-events: none;
    z-index: 0;
  }
  .dark .calc-liquid-shell::before {
    background: linear-gradient(
      118deg,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0.02) 28%,
      transparent 48%,
      rgba(255, 255, 255, 0.04) 100%
    );
  }
  .calc-lcd-well {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.04) 0%, rgba(15, 23, 42, 0.01) 100%);
    box-shadow:
      inset 0 2px 6px rgba(15, 23, 42, 0.06),
      0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .dark .calc-lcd-well {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.38) 0%, rgba(0, 0, 0, 0.16) 100%);
    box-shadow:
      inset 0 2px 10px rgba(0, 0, 0, 0.45),
      0 1px 0 rgba(255, 255, 255, 0.07);
  }
  .calc-key-glass {
    box-shadow:
      0 4px 10px -2px rgba(15, 23, 42, 0.05),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.85);
  }
  .dark .calc-key-glass {
    box-shadow:
      0 6px 14px -4px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.16);
  }
`;

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const NON_FINITE = new Set(['Error', 'Infinity', '-Infinity', 'NaN']);

function normalizeNumericString(raw: string): string {
  if (!raw) return '';
  if (raw === '-0') return '0';
  return raw;
}

function formatNumberDisplay(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const str = normalizeNumericString(String(val));
  if (NON_FINITE.has(str)) return 'Error';
  if (str.includes('e') || str.includes('E')) return str;
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join('.');
}

function isErrorValue(val: string | null | undefined): boolean {
  return typeof val === 'string' && NON_FINITE.has(val);
}

/* ============================================================================
 * HOOKS
 * ========================================================================== */

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      );

    const timer = window.setTimeout(() => {
      getFocusable()[0]?.focus();
    }, 40);

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
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      // Safeguard: never let a stale unmounted node throw.
      try {
        previouslyFocused?.focus?.();
      } catch {
        /* ignore */
      }
    };
  }, [active, ref]);
}

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);
}

function useIsApplePlatform(): boolean {
  const [isApple, setIsApple] = useState(false);
  useEffect(() => {
    try {
      const ua = navigator.userAgent || '';
      setIsApple(/Mac|iPhone|iPad|iPod/.test(ua));
    } catch {
      /* ignore */
    }
  }, []);
  return isApple;
}

/* ============================================================================
 * CALC BUTTON
 * ========================================================================== */

type CalcVariant = 'default' | 'primary' | 'secondary' | 'danger' | 'accent';

const CALC_BASE =
  'calc-key-glass relative flex min-h-[44px] select-none items-center justify-center rounded-2xl font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 overflow-hidden';

function calcVariantClass(variant: CalcVariant, active: boolean): string {
  // Keyboard-flash state — applied on top of any variant.
  const flash = active ? 'ring-2 ring-blue-400/70 ring-offset-1 ring-offset-transparent' : '';

  switch (variant) {
    case 'primary':
      return (
        flash +
        (active
          ? ' bg-gradient-to-b from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/40 border border-white/40'
          : ' bg-gradient-to-b from-amber-500 to-orange-500 text-white shadow-[0_4px_14px_-2px_rgba(245,158,11,0.45)] border border-amber-400/40 hover:brightness-105')
      );
    case 'secondary':
      return (
        flash +
        (active
          ? ' bg-blue-500/15 text-blue-700 border border-blue-500/40 dark:bg-blue-500/25 dark:text-blue-200'
          : ' bg-slate-900/[0.06] text-slate-700 hover:bg-slate-900/[0.11] border border-slate-900/10 dark:bg-white/[0.1] dark:text-slate-200 dark:hover:bg-white/[0.16] dark:border-white/10')
      );
    case 'danger':
      return (
        flash +
        (active
          ? ' bg-rose-500/25 text-rose-700 border border-rose-500/40 dark:text-rose-200'
          : ' bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 border border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400/30 text-[18px] font-bold')
      );
    case 'accent':
      return (
        flash +
        ' bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/35 border border-white/30 hover:brightness-110'
      );
    case 'default':
    default:
      return (
        flash +
        (active
          ? ' bg-blue-500/15 text-blue-700 border border-blue-500/40 dark:bg-blue-500/25 dark:text-blue-100 text-[19px]'
          : ' bg-white/65 text-slate-900 hover:bg-white/90 border border-slate-900/[0.07] text-[19px] font-medium dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.12] dark:border-white/10')
      );
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
    <motion.button
      variants={KEY_ITEM_VARIANT}
      whileTap={{ scale: 0.92 }}
      transition={SPRING_SNAPPY}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={variant === 'primary' ? active : undefined}
      className={`${CALC_BASE} ${calcVariantClass(variant, active)}`}
    >
      <span className="relative z-10 flex items-center justify-center">{children}</span>
    </motion.button>
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
  const reducedMotion = useReducedMotion();
  const isApple = useIsApplePlatform();

  const [copied, setCopied] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [financeInput, setFinanceInput] = useState('');
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  // SSR-safe: init true, hydrate from storage on mount.
  const [soundEnabled, setSoundEnabled] = useState(true);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    calculateSquare,
    calculateSquareRoot,
    calculateReciprocal,
    convertCurrency,
  } = useCalculator();

  /* ------------------------------ sound -------------------------------- */
  useEffect(() => {
    try {
      if (localStorage.getItem('medu_calc_sound') === 'false') setSoundEnabled(false);
    } catch {
      /* ignore */
    }
  }, []);

  const playClick = useCallback(
    (type: 'tick' | 'pop' | 'success' | 'error' = 'tick') => {
      if (!soundEnabled) return;
      if (type === 'tick') sounds.playTick();
      else if (type === 'pop') sounds.playPop();
      else if (type === 'success') sounds.playSuccess();
      else if (type === 'error') sounds.playError();
    },
    [soundEnabled, sounds],
  );

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('medu_calc_sound', String(next));
    } catch {
      /* ignore */
    }
  };

  const flashKey = useCallback((key: string) => {
    setPressedKey(key);
    if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current);
    keyTimeoutRef.current = setTimeout(() => setPressedKey(null), 160);
  }, []);

  /* ------------------------------ mount ------------------------------- */
  useFocusTrap(dialogRef, isCalculatorOpen);
  useScrollLock(isCalculatorOpen);

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      if (keyTimeoutRef.current) clearTimeout(keyTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isCalculatorOpen) {
      setShowHistory(false);
      setActiveTab('basic');
      setFinanceInput('');
      setCopied(false);
      setAnnounce('');
    }
  }, [isCalculatorOpen]);

  /* ------------------------------ copy --------------------------------- */
  const handleCopy = useCallback(async () => {
    const text = currentValue;
    if (!text || isErrorValue(text)) return;

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
      setAnnounce('Natija nusxalandi');
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [currentValue, playClick]);

  /* ------------------------------ recall ------------------------------ */
  const handleRecallHistory = useCallback(
    (resultStr: string) => {
      const clean = resultStr.replace(/\s+/g, '');
      if (!clean) return;
      if (NON_FINITE.has(clean)) {
        playClick('error');
        return;
      }
      // Scientific notation cannot be re-typed digit by digit reliably.
      if (/[eE]/.test(clean)) {
        playClick('error');
        setAnnounce('Bu natijani qayta yuklab bo\'lmaydi (juda katta son)');
        return;
      }

      playClick('tick');
      clear();
      const isNegative = clean.startsWith('-');
      const unsigned = isNegative ? clean.slice(1) : clean;

      for (const ch of unsigned) {
        if (ch === '.') inputDot();
        else if (ch >= '0' && ch <= '9') inputDigit(ch);
      }
      if (isNegative) toggleSign();

      setShowHistory(false);
      setAnnounce(`Natija yuklandi: ${formatNumberDisplay(clean)}`);
    },
    [clear, inputDigit, inputDot, toggleSign, playClick],
  );

  /* ------------------------------ keyboard ---------------------------- */
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
        if (showHistory) {
          setShowHistory(false);
          return;
        }
        setCalculatorOpen(false);
        return;
      }

      // Ctrl/Cmd + C → copy result (bypasses default "clear" behavior).
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (!inInput) {
          e.preventDefault();
          void handleCopy();
        }
        return;
      }

      if (inInput || activeTab === 'finance' || showHistory) return;

      if (KEY_TO_DIGIT[e.key] !== undefined) {
        e.preventDefault();
        playClick('tick');
        flashKey(e.key);
        inputDigit(KEY_TO_DIGIT[e.key]);
        return;
      }

      switch (e.key) {
        case '.':
        case ',':
          e.preventDefault();
          playClick('tick');
          flashKey('.');
          inputDot();
          break;
        case '+':
          e.preventDefault();
          playClick('tick');
          flashKey('+');
          performOperation('+');
          break;
        case '-':
          e.preventDefault();
          playClick('tick');
          flashKey('-');
          performOperation('-');
          break;
        case '*':
        case 'x':
        case 'X':
          e.preventDefault();
          playClick('tick');
          flashKey('×');
          performOperation('×');
          break;
        case '/':
          e.preventDefault();
          playClick('tick');
          flashKey('÷');
          performOperation('÷');
          break;
        case '%':
          e.preventDefault();
          playClick('tick');
          inputPercent();
          break;
        case 'Enter':
        case '=': {
          e.preventDefault();
          playClick('success');
          calculateEquals();
          setAnnounce(`Natija: ${formatNumberDisplay(currentValue)}`);
          break;
        }
        case 'Backspace':
          e.preventDefault();
          playClick('pop');
          backspace();
          break;
        case 'Delete':
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
    isCalculatorOpen,
    activeTab,
    showHistory,
    setCalculatorOpen,
    inputDigit,
    inputDot,
    performOperation,
    calculateEquals,
    inputPercent,
    backspace,
    clear,
    playClick,
    handleCopy,
    flashKey,
    currentValue,
  ]);

  /* ------------------------------ AI handoff -------------------------- */
  const handleAskAi = useCallback(
    (item: HistoryItem) => {
      const prompt = `Iltimos, ushbu hisob-kitobni tushuntirib bering: ${item.expression} = ${item.result}`;
      const detail = { prompt, source: 'calculator' };
      try {
        window.dispatchEvent(new CustomEvent(AI_EVENT_NAME, { detail }));
        window.dispatchEvent(new CustomEvent(LEGACY_AI_EVENT, { detail: prompt }));
      } catch {
        /* ignore */
      }
      setCalculatorOpen(false);
    },
    [setCalculatorOpen],
  );

  /* ------------------------------ finance ----------------------------- */
  const handleFinanceAction = useCallback(
    (action: 'discount' | 'markup' | 'installment' | 'split', customVal?: number) => {
      const raw = customVal !== undefined ? customVal : parseFloat(financeInput);
      if (!Number.isFinite(raw) || raw < 0) {
        playClick('error');
        return;
      }

      if (action === 'discount' || action === 'markup') {
        if (raw > FINANCE_PERCENT_MAX) {
          playClick('error');
          setAnnounce(`Foiz ${FINANCE_PERCENT_MAX} dan oshmasligi kerak`);
          return;
        }
      } else {
        // Installment / split — integer values only.
        const intVal = Math.floor(raw);
        if (intVal <= 0) {
          playClick('error');
          return;
        }
        playClick('success');
        if (action === 'installment') calculateInstallment(intVal);
        else calculateSplit(intVal);
        setFinanceInput('');
        setActiveTab('basic');
        return;
      }

      playClick('success');
      if (action === 'discount') calculateDiscount(raw);
      else calculateMarkup(raw);

      setFinanceInput('');
      setActiveTab('basic');
    },
    [
      financeInput,
      calculateDiscount,
      calculateMarkup,
      calculateInstallment,
      calculateSplit,
    calculateSquare,
    calculateSquareRoot,
    calculateReciprocal,
    convertCurrency,
      playClick,
    ],
  );

  /* ------------------------------ derived ----------------------------- */
  const isError = isErrorValue(currentValue);

  const displayFontSize = useMemo(() => {
    const len = currentValue.length;
    if (len <= 7) return 'text-4xl sm:text-[42px] leading-none';
    if (len <= 10) return 'text-3xl sm:text-4xl leading-none';
    if (len <= 13) return 'text-2xl sm:text-3xl leading-none';
    return 'text-xl sm:text-2xl leading-none';
  }, [currentValue]);

  const formattedDisplay = useMemo(() => formatNumberDisplay(currentValue), [currentValue]);
  const formattedPrevious = useMemo(() => formatNumberDisplay(previousValue), [previousValue]);

  const financePreview = useMemo(() => {
    const base = parseFloat(currentValue);
    const val = parseFloat(financeInput);
    if (!Number.isFinite(base) || !Number.isFinite(val) || val <= 0) return null;

    const asMoney = (n: number) =>
      formatNumberDisplay(Math.round(n * 100) / 100);

    return {
      discount:
        val <= FINANCE_PERCENT_MAX
          ? asMoney(base * (1 - val / 100))
          : null,
      markup:
        val <= FINANCE_PERCENT_MAX
          ? asMoney(base * (1 + val / 100))
          : null,
      split: asMoney(base / Math.max(1, Math.floor(val))),
    };
  }, [currentValue, financeInput]);

  const tabs = useMemo(
    () => [
      { id: 'basic', label: t('calculator.basic') || 'Asosiy' },
      { id: 'finance', label: t('calculator.finance') || 'Chegirma & Moliya' },
    ],
    [t],
  );

  const copyShortcut = isApple ? '⌘C' : 'Ctrl+C';

  /* ------------------------------ render ------------------------------ */
  return (
    <>
      <style>{CALC_LIQUID_CSS}</style>

      <AnimatePresence>
        {isCalculatorOpen && (
          <motion.div
            key="calc-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-md lg:hidden"
            onClick={() => setCalculatorOpen(false)}
            aria-hidden="true"
          />
        )}

        {isCalculatorOpen && (
          <motion.div
            key="calc-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('calculator.title') || 'Kalkulyator'}
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -16, scale: 0.94, filter: 'blur(10px)' }
            }
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -12, scale: 0.95, filter: 'blur(8px)' }
            }
            transition={SPRING_MODAL}
            className={[
              'calc-liquid-shell fixed right-3 z-[150] flex w-[375px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden',
              'inset-y-3 sm:inset-y-auto sm:top-[var(--top-bar-height,4.75rem)] sm:max-h-[calc(100vh-6rem)]',
              'rounded-[32px] text-slate-900 dark:text-white',
            ].join(' ')}
          >
            {/* Caustic orbs */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div
                className="absolute -right-14 -top-14 h-44 w-44 rounded-full opacity-50 blur-2xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(245,158,11,0.28), transparent 70%)',
                }}
              />
              <div
                className="absolute -bottom-16 -left-14 h-48 w-48 rounded-full opacity-50 blur-2xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(99,102,241,0.26), transparent 70%)',
                }}
              />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between border-b border-black/[0.07] bg-white/30 px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/40">
                  <CalculatorIcon size={16} />
                </div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  {t('calculator.premiumTitle') || 'Kalkulyator'}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={toggleSound}
                  aria-label={soundEnabled ? "Ovozni o'chirish" : 'Ovozni yoqish'}
                  title={soundEnabled ? "Ovozni o'chirish" : 'Ovozni yoqish'}
                  className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {soundEnabled ? (
                    <Volume2 size={16} />
                  ) : (
                    <VolumeX size={16} className="text-slate-400 dark:text-slate-500" />
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => {
                    playClick('pop');
                    setShowHistory((v) => !v);
                  }}
                  aria-label={t('calculator.history') || 'Tarix'}
                  aria-pressed={showHistory}
                  className={`relative rounded-xl p-2 transition-colors ${
                    showHistory
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : 'text-slate-500 hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                >
                  <Clock size={16} />
                  {history.length > 0 && !showHistory && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setCalculatorOpen(false)}
                  aria-label={t('common.close') || 'Yopish'}
                  className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X size={16} />
                </motion.button>
              </div>
            </header>

            {/* Body */}
            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                {showHistory ? (
                  <motion.div
                    key="history-view"
                    initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={SPRING_SOFT}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <HistoryPanel
                      history={history}
                      onClear={() => {
                        playClick('pop');
                        clearHistory();
                      }}
                      onAskAi={handleAskAi}
                      onSelect={handleRecallHistory}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="calculator-view"
                    initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    transition={SPRING_SOFT}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    {/* LCD */}
                    <div className="calc-lcd-well mx-3.5 mt-3.5 flex flex-col items-end justify-between rounded-2xl border border-black/[0.06] px-4 py-3.5 dark:border-white/10">
                      <div className="flex w-full items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                          {operator ? 'Hisoblanmoqda' : 'Natija'}
                        </span>
                        <div className="h-4 font-mono text-xs font-medium tracking-wider text-slate-500 dark:text-slate-400">
                          {previousValue != null
                            ? `${formattedPrevious} ${operator ?? ''}`
                            : ''}
                        </div>
                      </div>

                      <div className="mt-2 flex w-full items-center justify-between gap-2">
                        <motion.button
                          whileHover={{ scale: 1.06 }}
                          whileTap={{ scale: 0.92 }}
                          type="button"
                          onClick={() => void handleCopy()}
                          disabled={isError}
                          aria-disabled={isError}
                          aria-label={t('calc.copy') || 'Nusxalash'}
                          className="flex items-center gap-1 rounded-xl border border-black/5 bg-white/60 px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                          title={`Nusxalash (${copyShortcut})`}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {copied ? (
                              <motion.span
                                key="copied"
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.7, opacity: 0 }}
                                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
                              >
                                <Check size={14} />
                                <span className="text-[11px]">Nusxalandi</span>
                              </motion.span>
                            ) : (
                              <motion.span
                                key="copy"
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.7, opacity: 0 }}
                                className="flex items-center"
                              >
                                <Copy size={14} />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>

                        <motion.div
                          key={formattedDisplay}
                          initial={{ scale: 0.98, opacity: 0.85 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={SPRING_SNAPPY}
                          role="textbox"
                          aria-readonly="true"
                          aria-live="off"
                          className={`select-all truncate font-light tracking-tight tabular-nums ${displayFontSize} ${
                            isError
                              ? 'font-semibold text-rose-500'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {formattedDisplay}
                        </motion.div>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-2 border-b border-black/[0.07] px-4 dark:border-white/10">
                      <GlassTabs
                        tabs={tabs}
                        active={activeTab}
                        onChange={(id) => {
                          playClick('pop');
                          setActiveTab(id as Tab);
                        }}
                        variant="underline"
                        size="sm"
                        aria-label={t('calc.types') || 'Kalkulyator rejimlari'}
                      />
                    </div>

                    {/* Tab content */}
                    <AnimatePresence mode="wait" initial={false}>
                      {activeTab === 'basic' ? (
                        <motion.div
                          key="tab-basic"
                          variants={KEYPAD_STAGGER}
                          initial="hidden"
                          animate="show"
                          exit={{
                            opacity: 0,
                            scale: 0.98,
                            transition: { duration: 0.12 },
                          }}
                          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                        >
                          {/* Quick Math & Currency Strip */}
                          <div className="mx-3.5 mb-1 mt-2.5 flex items-center justify-between gap-1.5 px-0.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  playClick('tick');
                                  convertCurrency(true);
                                }}
                                title="UZS ➔ USD (1$ = 12 850 so'm)"
                                className="calc-key-glass flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                              >
                                <DollarSign size={12} className="shrink-0" />
                                <span>UZS ➔ $</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  playClick('tick');
                                  convertCurrency(false);
                                }}
                                title="USD ➔ UZS (1$ = 12 850 so'm)"
                                className="calc-key-glass flex items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
                              >
                                <ArrowRightLeft size={11} className="shrink-0" />
                                <span>$ ➔ UZS</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  playClick('tick');
                                  calculateSquare();
                                }}
                                title="Kvadrat (x²)"
                                className="calc-key-glass rounded-xl border border-black/5 bg-black/[0.04] px-2 py-1 font-mono text-[11px] font-bold text-slate-700 transition-colors hover:bg-black/[0.08] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                              >
                                x²
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  playClick('tick');
                                  calculateSquareRoot();
                                }}
                                title="Kvadrat ildiz (√x)"
                                className="calc-key-glass rounded-xl border border-black/5 bg-black/[0.04] px-2 py-1 font-mono text-[11px] font-bold text-slate-700 transition-colors hover:bg-black/[0.08] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                              >
                                √x
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  playClick('tick');
                                  calculateReciprocal();
                                }}
                                title="Teskari (¹/x)"
                                className="calc-key-glass rounded-xl border border-black/5 bg-black/[0.04] px-2 py-1 font-mono text-[11px] font-bold text-slate-700 transition-colors hover:bg-black/[0.08] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                              >
                                ¹/x
                              </button>
                            </div>
                          </div>

                          <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-4 gap-2 p-3.5 pt-1.5"
                        >
                          <CalcBtn
                            onClick={() => {
                              playClick('pop');
                              clear();
                            }}
                            variant="danger"
                            label="Tozalash"
                          >
                            {currentValue !== '0' ? 'C' : 'AC'}
                          </CalcBtn>
                          <CalcBtn
                            onClick={() => {
                              playClick('pop');
                              backspace();
                            }}
                            variant="secondary"
                            label="O'chirish"
                          >
                            ⌫
                          </CalcBtn>
                          <CalcBtn
                            onClick={() => {
                              playClick('tick');
                              inputPercent();
                            }}
                            variant="secondary"
                            label="Foiz"
                          >
                            %
                          </CalcBtn>
                          <CalcBtn
                            onClick={() => {
                              playClick('tick');
                              flashKey('÷');
                              performOperation('÷');
                            }}
                            variant="primary"
                            active={operator === '÷' || pressedKey === '÷'}
                            label="Bo'lish"
                          >
                            <Divide size={18} />
                          </CalcBtn>

                          {(['7', '8', '9'] as const).map((d) => (
                            <CalcBtn
                              key={d}
                              active={pressedKey === d}
                              onClick={() => {
                                playClick('tick');
                                inputDigit(d);
                              }}
                            >
                              {d}
                            </CalcBtn>
                          ))}
                          <CalcBtn
                            onClick={() => {
                              playClick('tick');
                              flashKey('×');
                              performOperation('×');
                            }}
                            variant="primary"
                            active={operator === '×' || pressedKey === '×'}
                            label="Ko'paytirish"
                          >
                            <MultiplyIcon size={18} />
                          </CalcBtn>

                          {(['4', '5', '6'] as const).map((d) => (
                            <CalcBtn
                              key={d}
                              active={pressedKey === d}
                              onClick={() => {
                                playClick('tick');
                                inputDigit(d);
                              }}
                            >
                              {d}
                            </CalcBtn>
                          ))}
                          <CalcBtn
                            onClick={() => {
                              playClick('tick');
                              flashKey('-');
                              performOperation('-');
                            }}
                            variant="primary"
                            active={operator === '-' || pressedKey === '-'}
                            label="Ayirish"
                          >
                            <Minus size={18} />
                          </CalcBtn>

                          {(['1', '2', '3'] as const).map((d) => (
                            <CalcBtn
                              key={d}
                              active={pressedKey === d}
                              onClick={() => {
                                playClick('tick');
                                inputDigit(d);
                              }}
                            >
                              {d}
                            </CalcBtn>
                          ))}
                          <CalcBtn
                            onClick={() => {
                              playClick('tick');
                              flashKey('+');
                              performOperation('+');
                            }}
                            variant="primary"
                            active={operator === '+' || pressedKey === '+'}
                            label="Qo'shish"
                          >
                            <Plus size={18} />
                          </CalcBtn>

                          <CalcBtn
                            onClick={() => {
                              playClick('tick');
                              toggleSign();
                            }}
                            variant="secondary"
                            label="Musbat/Manfiy"
                          >
                            ±
                          </CalcBtn>
                          <CalcBtn
                            active={pressedKey === '0'}
                            onClick={() => {
                              playClick('tick');
                              inputDigit('0');
                            }}
                          >
                            0
                          </CalcBtn>
                          <CalcBtn
                            onClick={() => {
                              playClick('tick');
                              flashKey('.');
                              inputDot();
                            }}
                            active={pressedKey === '.'}
                            variant="secondary"
                            label="Nuqta"
                          >
                            .
                          </CalcBtn>
                          <CalcBtn
                            onClick={() => {
                              playClick('success');
                              calculateEquals();
                              setAnnounce(
                                `Natija: ${formatNumberDisplay(currentValue)}`,
                              );
                            }}
                            variant="accent"
                            label="Teng"
                          >
                            =
                          </CalcBtn>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="tab-finance"
                          initial={{ opacity: 0, x: 14, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, x: -14, filter: 'blur(4px)' }}
                          transition={SPRING_SOFT}
                          className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4"
                        >
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
                              min="0"
                              max={FINANCE_PERCENT_MAX * 100}
                              step="any"
                              inputMode="decimal"
                              value={financeInput}
                              onChange={(e) => setFinanceInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && financeInput) {
                                  e.preventDefault();
                                  handleFinanceAction('discount');
                                }
                              }}
                              placeholder="Masalan: 15"
                              className="calc-key-glass w-full rounded-2xl border border-black/10 bg-white/75 px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/15 dark:bg-slate-900/70 dark:text-white dark:placeholder-slate-500"
                            />
                          </div>

                          <div>
                            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Tezkor chegirmalar (1-bosishda):
                            </span>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                              {DISCOUNT_PRESETS.map((pct) => (
                                <motion.button
                                  key={pct}
                                  whileTap={{ scale: 0.92 }}
                                  type="button"
                                  onClick={() => handleFinanceAction('discount', pct)}
                                  className="calc-key-glass rounded-xl border border-blue-500/30 bg-blue-500/12 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-500/22 dark:border-blue-400/30 dark:text-blue-300"
                                >
                                  -{pct}%
                                </motion.button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              type="button"
                              onClick={() => handleFinanceAction('discount')}
                              disabled={!financeInput || parseFloat(financeInput) < 0}
                              className="calc-key-glass flex flex-col items-start gap-1 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition-all hover:bg-white/90 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1]"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                                <Tag size={14} className="text-amber-500" />
                                <span>Chegirma (-%)</span>
                              </div>
                              {financePreview?.discount && (
                                <span className="text-[11px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                                  = {financePreview.discount}
                                </span>
                              )}
                            </motion.button>

                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              type="button"
                              onClick={() => handleFinanceAction('markup')}
                              disabled={!financeInput || parseFloat(financeInput) < 0}
                              className="calc-key-glass flex flex-col items-start gap-1 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition-all hover:bg-white/90 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1]"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                                <TrendingUp size={14} className="text-emerald-500" />
                                <span>Ustama (+%)</span>
                              </div>
                              {financePreview?.markup && (
                                <span className="text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                  = {financePreview.markup}
                                </span>
                              )}
                            </motion.button>

                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              type="button"
                              onClick={() => handleFinanceAction('installment')}
                              disabled={!financeInput || parseFloat(financeInput) <= 0}
                              className="calc-key-glass flex flex-col items-start gap-1 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition-all hover:bg-white/90 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1]"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                                <Clock size={14} className="text-cyan-600 dark:text-cyan-400" />
                                <span>Bo&apos;lib to&apos;lash</span>
                              </div>
                              {financePreview?.split && (
                                <span className="text-[11px] font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">
                                  {financePreview.split} / oy
                                </span>
                              )}
                            </motion.button>

                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              type="button"
                              onClick={() => handleFinanceAction('split')}
                              disabled={!financeInput || parseFloat(financeInput) <= 0}
                              className="calc-key-glass flex flex-col items-start gap-1 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition-all hover:bg-white/90 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.1]"
                            >
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                                <Users size={14} className="text-purple-600 dark:text-purple-400" />
                                <span>Taqsimlash</span>
                              </div>
                              {financePreview?.split && (
                                <span className="text-[11px] font-semibold tabular-nums text-purple-600 dark:text-purple-400">
                                  {financePreview.split} / kishi
                                </span>
                              )}
                            </motion.button>
                          </div>

                          <div className="mt-auto flex gap-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-700 dark:text-blue-300">
                            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <p className="text-xs leading-relaxed">
                              Asosiy summa:{' '}
                              <strong className="font-bold text-slate-900 dark:text-white">
                                {formattedDisplay || '0'} so&apos;m
                              </strong>
                              . Foiz yoki oylar sonini kiriting — natija darhol hisoblanadi.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Polite announcer for screen readers — only final results. */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>
    </>
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
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('calculator.historyTitle') || 'Hisob-kitob tarixi'}
        </h4>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-500/10"
          >
            <Trash2 size={12} />
            <span>{t('common.clear') || 'Tozalash'}</span>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center text-center text-xs text-slate-400">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-black/5 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]">
            <Clock size={22} className="opacity-50" />
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-300">
            Hozircha tarix mavjud emas
          </p>
          <p className="mt-0.5 text-[11px] opacity-75">
            Barcha hisob-kitoblar shu yerda saqlanadi
          </p>
        </div>
      ) : (
        <motion.ul
          variants={KEYPAD_STAGGER}
          initial="hidden"
          animate="show"
          role="list"
          className="flex flex-col gap-2.5"
        >
          {history.map((item) => (
            <motion.li
              key={item.id}
              variants={KEY_ITEM_VARIANT}
              className="calc-key-glass flex flex-col gap-1.5 rounded-2xl border border-black/[0.07] bg-white/60 p-3.5 transition-colors hover:bg-white/90 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <div className="text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                {item.expression} =
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(item.result)}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
                  title="Ekranga qayta yuklash"
                >
                  <RotateCcw size={12} />
                  <span>Yuklash</span>
                </button>
                <div className="truncate text-right text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatNumberDisplay(item.result)}
                </div>
              </div>
              <div className="mt-1 flex justify-end border-t border-black/5 pt-2 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => onAskAi(item)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 transition-colors hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  <Sparkles size={13} />
                  <span>AI bilan tahlil qilish</span>
                </button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

export default GlobalCalculator;