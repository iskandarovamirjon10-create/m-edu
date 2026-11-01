/**
 * ExecutiveBriefingModal — AI executive briefing with optional voice playback.
 *
 * Text-to-speech is triggered independently of the motion preference (reduced
 * motion only disables the decorative waveform). The shared GlassModal provides
 * the portal, focus trap, Escape handling, scroll lock and focus restore.
 */

import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Users,
  CreditCard,
  TrendingUp,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { GlassModal } from '@/components/ui/GlassModal';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { formatCurrency } from '@/lib/format';
import type { DashboardStats } from '@/lib/types';

interface ExecutiveBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: DashboardStats;
  userName?: string;
  orgName?: string;
}

const BAR_PATTERN = [0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.85, 0.5, 0.7];

/** Decorative speech indicator — hidden under reduced motion. */
function AudioWaveform({ active }: { active: boolean }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;
  return (
    <div className="flex h-5 items-center justify-center gap-[3px]" aria-hidden>
      {BAR_PATTERN.map((h, i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full bg-apple-blue"
          style={{ height: '100%', transformOrigin: 'center' }}
          animate={active ? { scaleY: [0.2, h, 0.2] } : { scaleY: 0.2 }}
          transition={{
            duration: 0.85,
            repeat: active ? Infinity : 0,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function StatMini({
  icon: IconComponent,
  label,
  value,
  footnote,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  footnote: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03] shadow-xs">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-xl', tone)}>
          <IconComponent className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-tertiary">{label}</span>
      </div>
      <p className="mt-2.5 text-base font-bold tabular-nums text-primary">{value}</p>
      <span className="mt-0.5 block text-[11px] text-tertiary">{footnote}</span>
    </div>
  );
}

export function ExecutiveBriefingModal({
  isOpen,
  onClose,
  stats,
  userName,
  orgName,
}: ExecutiveBriefingModalProps) {
  const { t, locale } = useSafeI18n();
  const navigate = useNavigate();
  const { speakBriefingIntro, stopAll } = useVoiceFeedback();
  const { playSuccess, playPop } = usePremiumSound();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const summary = useMemo(
    () => ({
      studentCount: stats.activeStudents || stats.totalStudents || 0,
      paidAmount: Number(stats.totalPaid) || 0,
      conversion: stats.conversionRate || 0,
      attendance: stats.attendanceRate || 0,
    }),
    [stats],
  );

  const briefingText = useMemo(() => {
    const name = userName ? `, ${userName}` : '';
    const org = orgName || 'M-EDU';
    const vars: Record<string, string | number> = {
      name,
      org,
      students: summary.studentCount,
      revenue: formatCurrency(summary.paidAmount),
      attendance: summary.attendance,
      conversion: summary.conversion,
    };
    const template =
      t('dashboard.briefingText') ||
      `Assalomu alaykum${name}! ${org} bo'yicha bugungi tahliliy hisobot: ${summary.studentCount} nafar faol o'quvchi, jami tushum ${formatCurrency(summary.paidAmount)}, o'rtacha davomat ${summary.attendance}%, lidlar konversiyasi ${summary.conversion}%. Barcha tizimlar me'yorda ishlamoqda.`;
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
  }, [t, userName, orgName, summary]);

  const handleStart = useCallback(() => {
    playSuccess();
    setIsSpeaking(true);
    setHasStarted(true);
    speakBriefingIntro(briefingText, () => setIsSpeaking(false));
  }, [briefingText, speakBriefingIntro, playSuccess]);

  const handleStop = useCallback(() => {
    playPop();
    setIsSpeaking(false);
    stopAll();
  }, [playPop, stopAll]);

  const handleClose = useCallback(() => {
    stopAll();
    setIsSpeaking(false);
    setHasStarted(false);
    onClose();
  }, [stopAll, onClose]);

  useEffect(() => {
    if (!isOpen) {
      stopAll();
      setIsSpeaking(false);
      setHasStarted(false);
    }
  }, [isOpen, stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  const today = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <GlassModal
      open={isOpen}
      onClose={handleClose}
      size="lg"
      title={t('dashboard.briefingTitle') || 'Tahliliy AI Hisoboti'}
      description={`${orgName || 'M-EDU'} · ${today}`}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              handleClose();
              navigate('/reports');
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-black/[0.08] bg-black/[0.03] px-4 text-xs font-semibold text-secondary transition-colors duration-150 hover:bg-black/[0.06] hover:text-primary dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
          >
            {t('dashboard.fullDiagnostics') || 'Batafsil hisobotlar'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-apple-blue to-[#5E5CE6] px-5 text-xs font-semibold text-white shadow-xs transition-all duration-150 hover:opacity-95 active:scale-98"
          >
            {t('dashboard.startWorking') || 'Tushunarli'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-apple-blue/10 text-apple-blue ring-1 ring-apple-blue/20">
              <Sparkles className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden />
            </span>
            <span className="text-xs font-semibold text-secondary">AI tahliliy xulosa</span>
          </div>

          <button
            type="button"
            onClick={isSpeaking ? handleStop : handleStart}
            aria-label={
              isSpeaking
                ? t('dashboard.stopVoice') || 'Ovozni to\'xtatish'
                : t('dashboard.playVoice') || 'Ovozli tinglash'
            }
            className={cn(
              'inline-flex h-8.5 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all duration-150',
              isSpeaking
                ? 'bg-apple-blue/15 text-apple-blue ring-1 ring-apple-blue/30'
                : 'border border-black/[0.08] bg-black/[0.02] text-secondary hover:text-primary hover:bg-black/[0.05] dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
            )}
          >
            {isSpeaking ? (
              <>
                <Volume2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                <span>{t('dashboard.speaking') || 'Ovozli ijro...'}</span>
              </>
            ) : (
              <>
                {hasStarted ? (
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                )}
                <span>
                  {hasStarted
                    ? t('dashboard.replay') || 'Qayta tinglash'
                    : t('dashboard.playVoice') || 'Ovozli tinglash'}
                </span>
              </>
            )}
          </button>
        </div>

        {isSpeaking && (
          <div className="flex items-center justify-between rounded-2xl border border-apple-blue/20 bg-apple-blue/[0.08] px-4 py-2.5 backdrop-blur-md">
            <span className="text-xs font-medium text-apple-blue">AI hisobotni o'qib bermoqda...</span>
            <AudioWaveform active={isSpeaking} />
          </div>
        )}

        <p
          aria-live="polite"
          className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-sm leading-relaxed text-secondary dark:border-white/[0.08] dark:bg-white/[0.03]"
        >
          “{briefingText}”
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatMini
            icon={Users}
            label={t('dashboard.students') || 'O\'quvchilar'}
            value={summary.studentCount}
            footnote={t('dashboard.activeLearning') || 'Faol o\'quvchilar'}
            tone="bg-apple-blue/10 text-apple-blue"
          />
          <StatMini
            icon={CreditCard}
            label={t('dashboard.revenue') || 'Tushum'}
            value={formatCurrency(summary.paidAmount)}
            footnote={t('dashboard.totalCollected') || 'Jami yig\'ilgan'}
            tone="bg-apple-green/10 text-apple-green"
          />
          <StatMini
            icon={TrendingUp}
            label={t('dashboard.conversion') || 'Konversiya'}
            value={`${summary.conversion}%`}
            footnote={t('dashboard.leadFlow') || 'Lidlar oqimi'}
            tone="bg-apple-orange/10 text-apple-orange"
          />
          <StatMini
            icon={ShieldCheck}
            label={t('dashboard.systemHealth') || 'Tizim'}
            value="100%"
            footnote={t('dashboard.allOperational') || 'Barqaror'}
            tone="bg-apple-teal/10 text-apple-teal"
          />
        </div>
      </div>
    </GlassModal>
  );
}

export default ExecutiveBriefingModal;
