import { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Send,
  User,
  X,
  Flame,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';

export interface LeadScriptTarget {
  id: string;
  name: string;
  phone: string;
  courseName?: string;
  stage: string;
  source?: string;
  createdAt?: string;
}

interface Props {
  lead: LeadScriptTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvanceStage?: (leadId: string, nextStage: string, notes?: string) => void;
}

export const LeadCallingScriptModal = memo(function LeadCallingScriptModal({
  lead,
  isOpen,
  onClose,
  onAdvanceStage,
}: Props) {
  const sound = usePremiumSound();
  const haptics = useHaptics();

  const [activeObjection, setActiveObjection] = useState<'expensive' | 'think' | 'no_time' | 'competitor'>('expensive');
  const [callNotes, setCallNotes] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [actionDone, setActionDone] = useState(false);

  // Conversion Propensity Score calculation
  const propensityScore = useMemo(() => {
    if (!lead) return 75;
    let score = 70;
    if (lead.courseName?.toLowerCase().includes('ielts') || lead.courseName?.toLowerCase().includes('frontend')) {
      score += 15;
    }
    if (lead.source?.toLowerCase().includes('instagram') || lead.source?.toLowerCase().includes('telegram')) {
      score += 10;
    }
    return Math.min(95, score);
  }, [lead]);

  const objectionResponses = {
    expensive: {
      objection: "Kurs narxi juda qimmat ekan...",
      responseUz:
        "To'g'ri tushunaman, narx har doim muhim. Lekin bizda faqat nazariya emas, real loyihalar ustida ishlanadi va kursni bitirgach, ishga joylashish bo'yicha amaliy kafolat beriladi. Bundan tashqari, 2 haftalik kafolat davri mavjud — agar yoqmasa, mablag'ingiz to'liq qaytariladi. Keling, avval bepul sinov darsimizda qatnashib ko'ring?",
    },
    think: {
      objection: "O'ylab ko'rishim kerak, keyinroq aytaman...",
      responseUz:
        "Albatta, bunday qarorlarni puxta o'ylash kerak. Lekin yangi ochilayotgan guruhimizda hozir atigi 2 ta bo'sh o'rin qoldi. Keling, siz uchun joyni bepul 24 soatga band qilib qo'yaman, siz esa ertaga 17:00 dagi ochiq amaliy darsimizga kelib, muhit bilan tanishib olasiz. Rozimisiz?",
    },
    no_time: {
      objection: "Hozir ishlarim ko'p, vaqtim yetmaydi...",
      responseUz:
        "Sizni juda yaxshi tushunaman, zamonaviy hayotda vaqt eng qimmatli resurs. Aynan shuning uchun biz darslarni haftada 3 kun kechki soat 19:30 ga hamda dam olish kunlari guruhlariga rejalashtirganmiz. Bundan tashqari barcha darslarning video yozuvi shaxsiy kabinetingizda doim saqlanadi.",
    },
    competitor: {
      objection: "Boshqa o'quv markaz arzonroq yoki yaqinroq...",
      responseUz:
        "Boshqa markazlarni ham o'rganayotganingiz juda yaxshi. Bizning asosiy ustunligimiz — ustozlarimiz xalqaro tajribaga ega va darslarimiz Vision OS 27 interaktiv platformasida Face ID turniket va avtomatlashtirilgan laboratoriya bilan jihozlangan. O'quvchimiz 3 oyda mustaqil ish boshlay oladi.",
    },
  };

  const handleOutcome = useCallback(
    (nextStage: string, defaultNote: string) => {
      if (!lead) return;
      sound?.play('success');
      haptics?.trigger?.('success');
      setActionDone(true);
      onAdvanceStage?.(lead.id, nextStage, callNotes || defaultNote);
      setTimeout(() => {
        setActionDone(false);
        setCallNotes('');
        onClose();
      }, 1200);
    },
    [lead, callNotes, sound, haptics, onAdvanceStage, onClose]
  );

  if (!isOpen || !lead) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-slate-900/90 text-white shadow-2xl backdrop-blur-3xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 shadow-md text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    AI Lead Skript & Qo'ng'iroq Yordamchisi
                  </h3>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                    Propensity: {propensityScore}% 🔥
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {lead.name} · {lead.phone} · Kurs: {lead.courseName || 'Kurs belgilanmagan'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {actionDone ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">
                Qo'ng'iroq Natijasi CRM ga Saqlandi!
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Lead bosqichi yangilandi va keyingi harakat kalendarga kiritildi.
              </p>
            </div>
          ) : (
            <div className="space-y-5 p-6">
              {/* Call Trigger Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Raqamga qo'ng'iroq qilish: {lead.phone}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Operator uchun jonli interaktiv AI skript
                    </p>
                  </div>
                </div>

                <a
                  href={`tel:${lead.phone}`}
                  onClick={() => setIsCalling(true)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-700 active:scale-95"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Qo'ng'iroqni Boshlash</span>
                </a>
              </div>

              {/* 1. Hook / Greeting Script */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <MessageSquare className="h-4 w-4 text-blue-400" />
                  <span>1. Salomlashish & Hook (Kirish qismi):</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-200">
                  "Assalomu alaykum, <strong>{lead.name}</strong>! M-EDU ta'lim markazidan qo'ng'iroq qilyapman.
                  Siz bizning <strong>{lead.courseName || 'dasturlash/til'}</strong> kursimizga qiziqish bildirgan ekansiz.
                  Hozir 2 daqiqa gaplashishga vaqtingiz bormi?"
                </p>
              </div>

              {/* 2. Objection Handling Matrix */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    <span>2. E'tirozlarni Yengish (Objection Matrix):</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Mijoz nima dedi?</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { id: 'expensive', label: "Qimmat ekan" },
                    { id: 'think', label: "O'ylab ko'raman" },
                    { id: 'no_time', label: "Vaqtim yo'q" },
                    { id: 'competitor', label: "Boshqa markaz" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveObjection(tab.id as any)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                        activeObjection === tab.id
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                  <p className="text-[11px] font-semibold text-amber-400">
                    ✦ AI Tavsiya etilgan javob:
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-200">
                    {objectionResponses[activeObjection].responseUz}
                  </p>
                </div>
              </div>

              {/* 3. Call Notes & CRM Actions */}
              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Qo'ng'iroq natijasi bo'yicha izoh:
                </label>
                <input
                  type="text"
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Mijoz qiziqdi, ochiq darsga keladi..."
                  className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Outcome Action Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => handleOutcome('TRIAL', "Sinov darsiga taklif qilindi va qabul qildi")}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-[11px] font-bold">Sinovga Yozildi</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOutcome('CALL_BACK', "Ertaga qayta qo'ng'iroq qilish kerak")}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-blue-400 transition-all hover:bg-blue-500/20 active:scale-95"
                >
                  <Clock className="h-5 w-5" />
                  <span className="text-[11px] font-bold">Qayta Qo'ng'iroq</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOutcome('NO_ANSWER', "Go'shakni ko'tarmadi, SMS yuborildi")}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-400 transition-all hover:bg-amber-500/20 active:scale-95"
                >
                  <PhoneOff className="h-5 w-5" />
                  <span className="text-[11px] font-bold">Javob Bermadi</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOutcome('LOST', "Qiziqmadi yoki rad etdi")}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400 transition-all hover:bg-rose-500/20 active:scale-95"
                >
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-[11px] font-bold">Rad Qildi</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default LeadCallingScriptModal;
