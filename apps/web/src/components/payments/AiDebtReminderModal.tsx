/**
 * AI Smart Debt Reminder Modal (M-EDU Payments v2)
 * Generates tailored Telegram/SMS reminders for student parents via paymentsApi.draftParentMessage.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Send,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { GlassModal, GlassButton, useToasts } from '@/components/ui';
import { paymentsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { Payment } from '@/lib/types';

interface AiDebtReminderModalProps {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
}

type MessageTone = 'friendly' | 'formal' | 'urgent';

export function AiDebtReminderModal({ open, onClose, payment }: AiDebtReminderModalProps) {
  const { t } = useSafeI18n();
  const { push } = useToasts();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  const [tone, setTone] = useState<MessageTone>('formal');
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const studentName = payment?.student
    ? `${payment.student.user?.firstName || ''} ${payment.student.user?.lastName || ''}`.trim()
    : 'O\'quvchi';

  const amountNum = payment ? Number(payment.amount) || 0 : 0;
  const parentPhone = payment?.student?.parentPhone || payment?.student?.user?.phone || '';

  // Generate message via AI or fallback
  const handleGenerate = useCallback(
    async (selectedTone: MessageTone = tone) => {
      if (!payment) return;
      setLoading(true);
      sound.playTick();
      try {
        const res = await paymentsApi.draftParentMessage({
          studentId: payment.studentId,
          studentName,
          tone: selectedTone,
          topic: 'debt',
          balanceDue: amountNum,
          details: `To'lov holati: ${payment.status}. To'lanishi kerak summa: ${formatCurrency(amountNum)}.`,
        });
        if (res && res.message) {
          setDraft(res.message);
          sound.playSuccess();
          haptics.success();
        } else {
          throw new Error('Xabar shakllanmadi');
        }
      } catch {
        // Fallback friendly template
        const fallback =
          selectedTone === 'urgent'
            ? `DIQQAT! Hurmatli ota-ona! ${studentName}ning o'quv kursi uchun ${formatCurrency(
                amountNum,
              )} to'lov muddati kechikmoqda. O'quv jarayoni to'xtab qolmasligi uchun zudlik bilan to'lovni amalga oshirishingizni so'raymiz. M-EDU Ma'muriyati.`
            : selectedTone === 'friendly'
            ? `Assalomu alaykum! Hurmatli ota-ona, ${studentName}ning o'qish jarayoni ajoyib davom etmoqda. Navbatdagi oy uchun ${formatCurrency(
                amountNum,
              )} to'lov muddati yetib kelganini muloyimlik bilan eslatib o'tamiz. Savollaringiz bo'lsa mamnuniyat bilan yordam beramiz! M-EDU.`
            : `Assalomu alaykum, hurmatli ota-ona! ${studentName}ning o'quv kursi uchun ${formatCurrency(
                amountNum,
              )} miqdoridagi to'lov muddati yetib kelganini ma'lum qilamiz. To'lovni o'z vaqtida amalga oshirishingizni iltimos qilamiz. Hurmat bilan, M-EDU Markazi.`;
        setDraft(fallback);
        sound.playPop();
      } finally {
        setLoading(false);
      }
    },
    [payment, tone, studentName, amountNum, sound, haptics],
  );

  useEffect(() => {
    if (open && payment) {
      setCopied(false);
      handleGenerate(tone);
    } else {
      setDraft('');
    }
  }, [open, payment]);

  const handleToneChange = (newTone: MessageTone) => {
    setTone(newTone);
    handleGenerate(newTone);
  };

  const handleCopy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft);
    setCopied(true);
    sound.playSuccess();
    haptics.light();
    push('success', 'Eslatma matni nusxalandi');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTelegram = () => {
    if (!draft) return;
    sound.playPop();
    const encoded = encodeURIComponent(draft);
    const tgUrl = parentPhone
      ? `https://t.me/+${parentPhone.replace(/\D/g, '')}`
      : `https://t.me/share/url?url=&text=${encoded}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  if (!payment) return null;

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={t('payments.aiReminder.title')}
      wide
    >
      <div className="space-y-4">
        {/* Recipient summary banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {studentName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('payments.aiReminder.debtAmount')}{' '}
                <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(amountNum)}</span>
                {parentPhone && ` · Tel: ${parentPhone}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {(['friendly', 'formal', 'urgent'] as MessageTone[]).map((tOption) => {
              const isActive = tone === tOption;
              const labels: Record<MessageTone, string> = {
                friendly: t('payments.aiReminder.toneFriendly'),
                formal: t('payments.aiReminder.toneFormal'),
                urgent: t('payments.aiReminder.toneUrgent'),
              };
              return (
                <button
                  key={tOption}
                  type="button"
                  onClick={() => handleToneChange(tOption)}
                  className={`px-3 py-1 text-xs font-semibold rounded-xl border transition-all ${
                    isActive
                      ? 'border-brand-500 bg-brand-500/20 text-brand-600 dark:text-brand-300 shadow-sm'
                      : 'border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-white/70'
                  }`}
                >
                  {labels[tOption]}
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Draft Area */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              Tayyorlangan xabar matni
            </span>
            <button
              type="button"
              onClick={() => handleGenerate(tone)}
              disabled={loading}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              Qayta shakllantirish
            </button>
          </div>

          <div className="relative rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] p-4 shadow-inner backdrop-blur-xl">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <Sparkles className="w-6 h-6 text-brand-500" />
                </motion.div>
                <span>M-EDU AI ota-ona uchun xabar tayyorlamoqda...</span>
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 outline-none resize-none font-medium leading-relaxed"
                placeholder="Xabar matni..."
              />
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.08]">
          <GlassButton type="button" variant="secondary" onClick={onClose}>
            {t('common.close')}
          </GlassButton>

          <div className="flex items-center gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCopy}
              disabled={!draft || loading}
              className="!border-slate-300/60 dark:!border-white/10"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? t('payments.aiReminder.copied') : t('payments.aiReminder.copy')}
              </span>
            </GlassButton>

            <GlassButton
              type="button"
              variant="primary"
              onClick={handleSendTelegram}
              disabled={!draft || loading}
              className="!bg-gradient-to-r !from-sky-500 !to-blue-600 !text-white"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <Send className="w-4 h-4" />
                {t('payments.aiReminder.sendTelegram')}
              </span>
            </GlassButton>
          </div>
        </div>
      </div>
    </GlassModal>
  );
}
