/**
 * AiParentMessageModal — AI-Powered Parent Communication Studio.
 * ============================================================================
 * Enables instant drafting of empathetic, culturally tailored parent messages
 * for attendance alerts, billing reminders, praise, and exams.
 * ============================================================================
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Send,
  Copy,
  Check,
  RefreshCw,
  MessageCircle,
} from 'lucide-react';
import { aiApi } from '@/lib/api';
import { cn } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';

export interface AiParentMessageModalProps {
  open: boolean;
  onClose: () => void;
  studentName: string;
  studentId?: string;
  initialTopic?: 'attendance' | 'debt' | 'praise' | 'exam' | 'custom';
  balanceDue?: number;
  initialMessage?: string;
}

export function AiParentMessageModal({
  open,
  onClose,
  studentName,
  studentId,
  initialTopic = 'attendance',
  balanceDue = 0,
  initialMessage = '',
}: AiParentMessageModalProps) {
  const { t } = useSafeI18n();
  const [topic, setTopic] = useState<'attendance' | 'debt' | 'praise' | 'exam' | 'custom'>(initialTopic);
  const [tone, setTone] = useState<'friendly' | 'formal' | 'urgent'>('friendly');
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await aiApi.draftParentMessage({
        studentName,
        studentId,
        topic,
        tone,
        details: details.trim() || undefined,
        balanceDue: balanceDue > 0 ? balanceDue : undefined,
      });
      setMessage(res.message);
    } catch {
      // Quiet fallback
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!message) return;
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTelegramShare = () => {
    if (!message) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative w-full max-w-lg overflow-hidden rounded-2xl border',
          'bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10',
          'shadow-2xl shadow-black/20 backdrop-blur-2xl p-6 space-y-4',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                AI Ota-onaga Xabar Generatori
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                O'quvchi: <span className="font-medium text-zinc-800 dark:text-zinc-200">{studentName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Topic selector */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
              Mavzu
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(
                [
                  { id: 'attendance', label: 'Davomat' },
                  { id: 'debt', label: "To'lov" },
                  { id: 'praise', label: 'Maqtov' },
                  { id: 'exam', label: 'Imtihon' },
                  { id: 'custom', label: 'Boshqa' },
                ] as const
              ).map((tItem) => (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => setTopic(tItem.id)}
                  className={cn(
                    'rounded-lg py-1.5 px-2 text-xs font-medium border text-center transition-all',
                    topic === tItem.id
                      ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700',
                  )}
                >
                  {tItem.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone selector */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
              Muloqot ohangi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'friendly', label: 'Samimiy' },
                  { id: 'formal', label: 'Rasmiy' },
                  { id: 'urgent', label: 'Jiddiy' },
                ] as const
              ).map((tItem) => (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => setTone(tItem.id)}
                  className={cn(
                    'rounded-lg py-1.5 text-xs font-medium border text-center transition-all',
                    tone === tItem.id
                      ? 'bg-[#5856D6] text-white border-[#5856D6] shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700',
                  )}
                >
                  {tItem.label}
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Qo'shimcha tafsilotlar (ixtiyoriy)
            </label>
            <input
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Masalan: darsga 20 daqiqa kechikib keldi..."
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#007AFF]/20 hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>AI xabar yozmoqda…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{message ? 'Xabarni qayta yaratish' : 'AI Xabar Yaratish'}</span>
              </>
            )}
          </button>
        </div>

        {/* Message preview textarea */}
        {message && (
          <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Tayyor xabar matni ({message.length} belgi)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#007AFF] hover:underline"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Nusxalandi' : 'Nusxa olish'}
              </button>
            </div>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 p-3 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleTelegramShare}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2AABEE] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-105 transition-all"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Telegram orqali yuborish</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
