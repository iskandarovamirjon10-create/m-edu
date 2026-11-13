/**
 * AiParentMessageModal — AI-Powered Parent Communication Studio.
 * ============================================================================
 * Enables instant drafting of empathetic, culturally tailored parent messages
 * for attendance alerts, billing reminders, praise, and exams.
 * ============================================================================
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Send,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { aiApi } from '@/lib/api';
import { cn } from '@/lib/design';

export interface AiParentMessageModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  studentName: string;
  studentId?: string;
  initialTopic?: 'attendance' | 'debt' | 'praise' | 'exam' | 'custom';
  initialDetails?: string;
  balanceDue?: number;
  initialMessage?: string;
}

export function AiParentMessageModal(props: AiParentMessageModalProps) {
  const {
    open = props.isOpen ?? false,
    onClose,
    studentName,
    studentId,
    initialTopic = 'attendance',
    initialDetails = '',
    balanceDue = 0,
    initialMessage = '',
  } = props;

  const [topic, setTopic] = useState<'attendance' | 'debt' | 'praise' | 'exam' | 'custom'>(initialTopic);
  const [tone, setTone] = useState<'friendly' | 'formal' | 'urgent'>('friendly');
  const [details, setDetails] = useState(initialDetails);
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await aiApi.draftParentMessage({
        studentId,
        studentName,
        topic,
        tone,
        details: details.trim() || undefined,
        balanceDue: balanceDue > 0 ? balanceDue : undefined,
      });
      setMessage(res.message);
    } catch {
      // Fallback template if network/model unavailable
      const fallbackTemplates: Record<string, string> = {
        attendance: `Assalomu alaykum, hurmatli ota-ona! ${studentName} bugun darsda qatnashmadi. Iltimos, sababini ma'lum qilsangiz. Hurmat bilan, M-EDU ma'muriyati.`,
        debt: `Assalomu alaykum! ${studentName}ning to'lov muddati yetib keldi. Qarzdorlik: ${balanceDue ? balanceDue.toLocaleString() + ' UZS' : 'mavjud'}. To'lovni o'z vaqtida amalga oshirishingizni so'raymiz.`,
        praise: `Assalomu alaykum! ${studentName} bugungi mashg'ulotda a'lo natija ko'rsatdi va faol qatnashdi. Farzandingiz yutuqlari bilan tabriklaymiz!`,
        exam: `Assalomu alaykum! ${studentName}ning navbatdagi imtihoni yaqinlashmoqda. Iltimos, uy vazifalarini va tayyorgarligini nazorat qilib boring.`,
        custom: `Assalomu alaykum! ${studentName} bo'yicha markaz ma'muriyati siz bilan bog'lanmoqda.`,
      };
      setMessage(fallbackTemplates[topic] || fallbackTemplates.attendance);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSendViaTelegram = () => {
    if (!message) return;
    // Open Telegram share or copy to clipboard
    const encoded = encodeURIComponent(message);
    window.open(`https://t.me/share/url?url=${encoded}`, '_blank');
    onClose();
  };

  const isModalOpen = open;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
          {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1C1E] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Ota-ona uchun AI Xabar Tuzuvchi
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {studentName} uchun qulay va muloyim xabar loyihasi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 h-9 w-9 min-h-[44px] min-w-[44px] tap-extend flex items-center justify-center text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Topic Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Xabar Mavzusi:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'attendance', label: 'Davomat' },
                    { id: 'debt', label: "To'lov" },
                    { id: 'praise', label: 'Maqtov' },
                    { id: 'exam', label: 'Imtihon' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopic(t.id)}
                    className={cn(
                      'rounded-lg px-2.5 py-2 min-h-[38px] tap-extend text-xs font-semibold transition-all',
                      topic === t.id
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Ohang (Tone):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'friendly', label: 'Muloyim & Do‘stona' },
                    { id: 'formal', label: 'Rasmiy & Qat’iy' },
                    { id: 'urgent', label: 'Shoshilinch' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={cn(
                      'rounded-lg px-2.5 py-2 min-h-[38px] tap-extend text-[11px] font-semibold transition-all',
                      tone === t.id
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
                        : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Details Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Qo'shimcha tafsilotlar (ixtiyoriy):
              </label>
              <input
                type="text"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="masalan: ertaga soat 14:00 da ochiq dars bo'ladi"
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Generate Action Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 min-h-[44px] tap-extend text-xs font-semibold text-white shadow-md hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 transition-all active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>AI xabar yozmoqda...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI bilan xabar matnini tuzish</span>
                </>
              )}
            </button>

            {/* Generated Message Output Area */}
            {message && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Tayyor xabar matni:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 min-h-[36px] tap-extend text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500">Nusxalandi</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Nusxa olish</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/60 p-3 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-black/5 dark:border-white/10 px-5 py-3 bg-zinc-50/50 dark:bg-zinc-800/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 min-h-[44px] tap-extend text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Yopish
            </button>
            <button
              type="button"
              onClick={handleSendViaTelegram}
              disabled={!message}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 min-h-[44px] tap-extend text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-40 transition-all"
            >
              <Send className="h-3 w-3" />
              <span>Telegram orqali yuborish</span>
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
