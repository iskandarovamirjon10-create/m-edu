/**
 * AiStudentDiagnosticWidget — In-Context AI Student Analysis & Retention Advisor.
 * ============================================================================
 * Deeply embeds AI pedagogical diagnosis directly into student profiles:
 * - Real-time academic health score & risk categorization.
 * - Dynamic SWOT (Strengths, Weaknesses/Risks, Recommendations).
 * - Instant 1-click parent message composer tailored to the student's status.
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  MessageSquare,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { aiApi, type AiStudentDiagnostic } from '@/lib/api';
import { cn } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';

interface AiStudentDiagnosticWidgetProps {
  studentId: string;
  studentName: string;
  onOpenMessageModal?: (messageText: string) => void;
}

export function AiStudentDiagnosticWidget({
  studentId,
  studentName,
  onOpenMessageModal,
}: AiStudentDiagnosticWidgetProps) {
  const { t } = useSafeI18n();
  const [data, setData] = useState<AiStudentDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const loadDiagnostic = async () => {
    setLoading(true);
    try {
      const res = await aiApi.diagnoseStudent(studentId);
      setData(res);
    } catch {
      // Quiet fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) {
      loadDiagnostic();
    }
  }, [studentId]);

  const handleCopyMessage = () => {
    if (!data?.suggestedParentMessage) return;
    navigator.clipboard.writeText(data.suggestedParentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCopilot = () => {
    window.dispatchEvent(
      new CustomEvent('open-ai-copilot', {
        detail: {
          prompt: `${studentName} bo'yicha to'liq tahlil va kelgusi oy uchun o'qituvchilar va ota-onaga mo'ljallangan harakatlar rejasini tuzib ber.`,
        },
      }),
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 p-5 backdrop-blur-xl animate-pulse space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-[#007AFF]/20" />
          <div className="h-4 w-48 rounded bg-black/10 dark:bg-white/10" />
        </div>
        <div className="h-14 rounded-xl bg-black/5 dark:bg-white/5" />
      </div>
    );
  }

  if (!data) return null;

  const riskBadge =
    data.riskLevel === 'high'
      ? { label: 'Yuqori xavf', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' }
      : data.riskLevel === 'medium'
        ? { label: "O'rta xavf", color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
        : { label: 'Barqaror', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/8 dark:border-white/10 bg-gradient-to-br from-white/90 via-white/70 to-[#007AFF]/5 dark:from-zinc-900/90 dark:via-zinc-900/70 dark:to-[#007AFF]/10 p-5 backdrop-blur-2xl shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white shadow-sm shadow-[#007AFF]/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                AI Pedagogik Tahlil & Diagnostika
              </h4>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', riskBadge.color)}>
                {riskBadge.label}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Davomat, baholar va to'lov intizomining ko'p o'lchovli tahlili
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={loadDiagnostic}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 transition-colors"
            title="Yangilash"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3.5 space-y-4"
          >
            {/* Summary */}
            <div className="rounded-xl bg-white/60 dark:bg-zinc-800/50 p-3.5 border border-black/5 dark:border-white/5">
              <p className="text-xs font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
                {data.summary}
              </p>
            </div>

            {/* Strengths & Risks columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Strengths */}
              <div className="rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Kuchli jihatlari
                </div>
                <ul className="space-y-1.5">
                  {data.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risk factors */}
              <div className="rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Diqqat talab qiladigan nuqtalar
                </div>
                <ul className="space-y-1.5">
                  {data.riskFactors.length > 0 ? (
                    data.riskFactors.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-[11px] text-zinc-500 italic">Jiddiy xavf omillari topilmadi</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <div className="rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/15 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <Lightbulb className="h-3.5 w-3.5" />
                  AI Tavsiyalari:
                </div>
                <ul className="space-y-1">
                  {data.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300">
                      <span className="text-[#007AFF] font-bold">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested Parent Message Box */}
            {data.suggestedParentMessage && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-black/8 dark:border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <MessageSquare className="h-3.5 w-3.5 text-[#007AFF]" />
                    Ota-ona uchun tayyor xabar qoralamasi:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-600">Nusxalandi</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Nusxa olish</span>
                        </>
                      )}
                    </button>
                    {onOpenMessageModal && (
                      <button
                        type="button"
                        onClick={() => onOpenMessageModal(data.suggestedParentMessage)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#007AFF] px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-[#0051D5] transition-colors"
                      >
                        Yuborish
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 bg-white/70 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-black/5 dark:border-white/5 select-all">
                  {data.suggestedParentMessage}
                </p>
              </div>
            )}

            {/* Bottom action trigger to AI Copilot */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={handleOpenCopilot}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007AFF] hover:underline"
              >
                <span>AI Copilot orqali chuqurroq o'rganish</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
