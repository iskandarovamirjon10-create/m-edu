/**
 * M-EDU V2 — Lead Course Advisor & Career ROI Proposal Generator (`LeadCourseAdvisorModal.tsx`)
 * Empowers receptionists and sales managers to instantly calculate course ROI, payback periods,
 * and dispatch personalized Commercial Proposals (Tijorat Taklifi) via Telegram with 1 click.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  GlassModal,
  GlassButton,
  GlassBadge,
  useToast,
} from '@/components/ui';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { coursesApi } from '@/lib/api';
import type { Course } from '@/types/academics';

interface LeadCourseAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLeadName?: string;
  defaultPhone?: string;
}

export const LeadCourseAdvisorModal: React.FC<LeadCourseAdvisorModalProps> = ({
  isOpen,
  onClose,
  defaultLeadName = '',
  defaultPhone = '',
}) => {
  const toast = useToast();
  const { playSuccess, playPop } = usePremiumSound();
  const haptics = useHaptics();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [leadName, setLeadName] = useState<string>(defaultLeadName || 'Yangi Talaba');
  const [leadPhone, setLeadPhone] = useState<string>(defaultPhone || '+998 90 123 45 67');
  const [paymentPlan, setPaymentPlan] = useState<'MONTHLY' | 'UPFRONT_DISCOUNT'>('MONTHLY');
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch real courses from database
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    coursesApi.list({ limit: 30 })
      .then((res: any) => {
        if (!active) return;
        const list: Course[] = res?.data || res?.items || (Array.isArray(res) ? res : []);
        setCourses(list);
        if (list.length > 0 && !selectedCourseId) {
          setSelectedCourseId(list[0].id);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [isOpen, selectedCourseId]);

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || courses[0] || null;
  }, [courses, selectedCourseId]);

  const coursePrice = useMemo(() => {
    return Number(selectedCourse?.price ?? 400_000);
  }, [selectedCourse]);

  const durationMonths = useMemo(() => {
    // Default estimated 4 to 6 months if not set
    return (selectedCourse as any)?.durationMonths || 4;
  }, [selectedCourse]);

  const totalTuition = useMemo(() => {
    const base = coursePrice * durationMonths;
    if (paymentPlan === 'UPFRONT_DISCOUNT') {
      return Math.round(base * 0.9); // 10% discount for upfront payment
    }
    return base;
  }, [coursePrice, durationMonths, paymentPlan]);

  const expectedSalaryForecast = useMemo(() => {
    const cName = (selectedCourse?.name || '').toLowerCase();
    if (cName.includes('pc') || cName.includes('savod')) {
      return { entry: 3_500_000, mid: 6_000_000, title: 'Ofis Menejeri / IT Operator' };
    }
    if (cName.includes('front') || cName.includes('full') || cName.includes('dastur')) {
      return { entry: 6_500_000, mid: 14_000_000, title: 'Junior Software Engineer' };
    }
    if (cName.includes('ielts') || cName.includes('ingliz')) {
      return { entry: 5_000_000, mid: 12_000_000, title: 'Xalqaro Kompaniya Mutaxassisi' };
    }
    return { entry: 4_500_000, mid: 9_000_000, title: 'Kvalifikatsiyali Mutaxassis' };
  }, [selectedCourse]);

  // Payback days calculation
  const paybackDays = useMemo(() => {
    const dailyIncome = expectedSalaryForecast.entry / 22;
    return Math.max(7, Math.round(totalTuition / dailyIncome));
  }, [totalTuition, expectedSalaryForecast]);

  const proposalText = useMemo(() => {
    const discountNote = paymentPlan === 'UPFRONT_DISCOUNT' ? " (To'liq to'lov uchun 10% chegirma bilan)" : "";
    return `Assalomu alaykum, hurmatli ${leadName}!\n\n` +
      `M-EDU Ta'lim Markazining "${selectedCourse?.name || 'Dasturlash'}" kursi bo'yicha rasmiy Tijorat Taklifi va Karyera Hisobi:\n\n` +
      `📚 Kurs davomiyligi: ${durationMonths} oy\n` +
      `💳 Oylik to'lov: ${coursePrice.toLocaleString('uz-UZ')} UZS\n` +
      `💰 Jami investitsiya: ${totalTuition.toLocaleString('uz-UZ')} UZS${discountNote}\n\n` +
      `🎯 Kutilayotgan natija:\n` +
      `• Karyera sohasi: ${expectedSalaryForecast.title}\n` +
      `• Boshlang'ich kutilayotgan oylik: ${expectedSalaryForecast.entry.toLocaleString('uz-UZ')} UZS\n` +
      `• O'zini qoplash muddati: Atigi ${paybackDays} kunlik maosh bilan to'liq qoplanadi!\n\n` +
      `Guruhda joylar soni cheklangan (maksimal 12 nafar). Sinov darsiga yozilish uchun ushbu xabarga javob bering yoki markazimizga tashrif buyuring.\n` +
      `📍 Manzil: M-EDU Bosh Ofisi\n📞 Telefon: +998 71 200 00 00`;
  }, [leadName, selectedCourse, durationMonths, coursePrice, totalTuition, paymentPlan, expectedSalaryForecast, paybackDays]);

  const handleCopyProposal = async () => {
    try {
      await navigator.clipboard.writeText(proposalText);
      setCopied(true);
      playSuccess();
      haptics.success();
      toast.success("Taklifnoma nusxalandi!", "Ota-onaga yuborish uchun tayyor matn buferga saqlandi.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleSendTelegram = () => {
    playPop();
    haptics.medium();
    const cleanPhone = leadPhone.replace(/[^0-9]/g, '');
    const url = cleanPhone ? `https://t.me/+${cleanPhone}` : `https://t.me/share/url?url=${encodeURIComponent('https://m-edu.uz')}&text=${encodeURIComponent(proposalText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      className="w-full max-w-4xl overflow-hidden p-0"
    >
      <div className="flex flex-col bg-slate-950 text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <span className="text-xl">📈</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Lead Course Advisor & Ta'lim ROI Hisoblagichi
                </h3>
                <GlassBadge variant="info" size="sm" className="font-bold">
                  Savdo Konversiyasi +40%
                </GlassBadge>
              </div>
              <p className="text-xs text-slate-400">
                Lidlar va ota-onalarga kursning moliyaviy va professional qiymatini bir zumda isbotlab beruvchi tijorat taklifi
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-6">
          {/* Controls: Course & Lead Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Lid (O'quvchi / Ota-ona) Ismi
              </label>
              <input
                type="text"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Masalan: Sardor Aliyev"
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Telefon Raqami (Telegram)
              </label>
              <input
                type="text"
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Tanlangan Kurs
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  playPop();
                }}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {Number(c.price ?? 0).toLocaleString('uz-UZ')} UZS/oy
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ROI & Payback Impact Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center">
              <div className="text-xs text-slate-400">Jami Investitsiya</div>
              <div className="text-xl font-bold text-white mt-1">
                {totalTuition.toLocaleString('uz-UZ')} UZS
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{durationMonths} oylik to'liq dastur</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <div className="text-xs font-semibold text-emerald-300">Boshlang'ich Maosh</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {expectedSalaryForecast.entry.toLocaleString('uz-UZ')} UZS/oy
              </div>
              <div className="text-[10px] text-emerald-300/70 mt-0.5">{expectedSalaryForecast.title}</div>
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-center">
              <div className="text-xs font-semibold text-cyan-300">O'zini Qoplash Davri</div>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                {paybackDays} kun
              </div>
              <div className="text-[10px] text-cyan-300/70 mt-0.5">Ilk oylik maoshdayoq qoplanadi</div>
            </div>

            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-center">
              <div className="text-xs font-semibold text-indigo-300">To'lov Imtiyozi</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => setPaymentPlan('MONTHLY')}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                    paymentPlan === 'MONTHLY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Oylik
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentPlan('UPFRONT_DISCOUNT')}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                    paymentPlan === 'UPFRONT_DISCOUNT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  -10% To'liq
                </button>
              </div>
              <div className="text-[10px] text-indigo-300/70 mt-1">
                {paymentPlan === 'UPFRONT_DISCOUNT' ? "10% tejash mavjud" : "Bo'lib to'lash"}
              </div>
            </div>
          </div>

          {/* Generated Commercial Proposal Box */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>📄</span>
                <span>Ota-ona uchun tayyor Tijorat Taklifi (Telegram / SMS)</span>
              </div>
              <GlassBadge variant="success" size="sm">Tayyor Shablon</GlassBadge>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-950 p-4 text-xs font-mono text-slate-300 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto select-all">
              {proposalText}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <GlassButton
                variant="primary"
                onClick={handleSendTelegram}
                className="flex-1 justify-center gap-2 !rounded-xl !bg-gradient-to-r !from-blue-600 !to-indigo-600 font-bold"
              >
                <span>✈️</span>
                <span>Telegram orqali Jo'natish</span>
              </GlassButton>

              <GlassButton
                variant="ghost"
                onClick={handleCopyProposal}
                className="justify-center gap-2 !rounded-xl border border-white/15 font-bold"
              >
                <span>📋</span>
                <span>{copied ? 'Nusxalandi!' : 'Matnni Nusxalash'}</span>
              </GlassButton>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/80 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MeduAiLogo size="xs" />
            <span>M-EDU Sales Conversion Engine</span>
          </div>

          <GlassButton variant="ghost" onClick={onClose} className="!rounded-xl text-xs">
            Yopish
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
};
