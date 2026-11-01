import { useState, memo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  GlassModal,
  GlassButton,
  GlassField,
  GlassSelect,
  useToasts,
} from '@/components/ui';
import { aiApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Course } from '@/lib/types';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { getErrorMessage } from '@/lib/errorMessages';

interface CourseAiSyllabusModalProps {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CourseAiSyllabusModal = memo(function CourseAiSyllabusModal({
  course,
  isOpen,
  onClose,
}: CourseAiSyllabusModalProps) {
  const { t } = useSafeI18n();
  const { push } = useToasts();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  const [activeTab, setActiveTab] = useState<'syllabus' | 'marketing' | 'pricing'>('syllabus');

  // Outputs
  const [syllabusResult, setSyllabusResult] = useState<string>('');
  const [marketingResult, setMarketingResult] = useState<string>('');
  const [pricingResult, setPricingResult] = useState<string>('');

  // Marketing tone
  const [marketingChannel, setMarketingChannel] = useState<'telegram' | 'instagram' | 'sms'>('telegram');

  // 1. Syllabus Mutation
  const syllabusMutation = useMutation({
    mutationFn: async () => {
      if (!course) return;
      const prompt = `Siz zamonaviy ta'lim markazining yetakchi metodist va kurrikulum dizaynerisiz.
Quyidagi kurs uchun haftama-hafta / modulli batafsil o'quv dasturi (Syllabus) tuzib bering:

Kurs nomi: "${course.name}"
Daraja: ${course.level || "Standart"}
Davomiyligi: ${course.duration} oy
Oylik to'lov narxi: ${formatCurrency(Number(course.price))}
Kurs tavsifi: "${course.description || "Amaliyotga yo'naltirilgan intensiv ta'lim"}"

Iltimos, quyidagi tuzilishda o'quv rejasini taqdim eting:
1. Kursning asosiy maqsadi va talabaga beradigan ko'nikmalari
2. Bosqichma-bosqich modullar (har bir modul mavzulari, amaliy mashg'ulotlar)
3. Yakuniy bitiruv (Capstone) real loyihasi g'oyasi
4. Talabalarni baholash mezonlari.`;

      const res = await aiApi.chat({
        message: prompt,
        route: `/courses/${course.id}`,
      });
      return res.content;
    },
    onSuccess: (data) => {
      if (data) {
        sound.playSuccess();
        haptics.success();
        setSyllabusResult(data);
      }
    },
    onError: (err) => {
      sound.playError();
      haptics.error();
      push({
        type: 'error',
        title: t('common.error', 'Dastur yaratishda xatolik yuz berdi'),
        message: getErrorMessage(err),
      });
    },
  });

  // 2. Marketing Copy Mutation
  const marketingMutation = useMutation({
    mutationFn: async () => {
      if (!course) return;
      const prompt = `Ta'lim markazining "${course.name}" kursi uchun yangi qabul e'loni matnini yozib bering.
Kanal: ${marketingChannel === 'telegram' ? 'Telegram kanal va guruhlar' : marketingChannel === 'instagram' ? 'Instagram post va storislar' : 'SMS xabarnoma'}
Daraja: ${course.level || 'Barcha qiziquvchilar uchun'}
Davomiyligi: ${course.duration} oy
Oylik narx: ${formatCurrency(Number(course.price))}

Talablar:
- E'tibor tortuvchi kuchli sarlavha
- Kimlar uchun mo'ljallanganligi va qulayliklar
- Kursda o'rganiladigan asosiy imkoniyatlar
- Emojilar va aniq harakatga chaqiruv (Call to Action: ro'yxatdan o'tish havolasi / telefon)
- Format chiroyli, darhol chop etishga tayyor bo'lsin.`;

      const res = await aiApi.chat({
        message: prompt,
        route: `/courses/${course.id}`,
      });
      return res.content;
    },
    onSuccess: (data) => {
      if (data) {
        sound.playSuccess();
        haptics.success();
        setMarketingResult(data);
      }
    },
    onError: (err) => {
      sound.playError();
      haptics.error();
      push({
        type: 'error',
        title: t('common.error', 'Xatolik yuz berdi'),
        message: getErrorMessage(err),
      });
    },
  });

  // 3. Pricing Advisor Mutation
  const pricingMutation = useMutation({
    mutationFn: async () => {
      if (!course) return;
      const prompt = `Ta'lim markazi kursining narxlash siyosatini tahlil qiling va daromadni optimallashtirish bo'yicha tavsiyalar bering:
Kurs: "${course.name}"
Daraja: ${course.level || "Standard"}
Davomiyligi: ${course.duration} oy
Oylik narxi: ${formatCurrency(Number(course.price))} (Umumiy kurs qiymati: ${formatCurrency(Number(course.price) * course.duration)})

Tahlil qiling:
1. Ushbu narxning O'zbekiston ta'lim bozoridagi raqobatbardoshligi
2. Chegirma va to'lov modellari (To'liq to'lov uchun chegirma, bo'lib to'lash)
3. Sotuvni oshirish uchun paketli takliflar (Masalan, 1+1 yoki karyera kafolati).`;

      const res = await aiApi.chat({
        message: prompt,
        route: `/courses/${course.id}`,
      });
      return res.content;
    },
    onSuccess: (data) => {
      if (data) {
        sound.playSuccess();
        haptics.success();
        setPricingResult(data);
      }
    },
    onError: (err) => {
      sound.playError();
      haptics.error();
      push({
        type: 'error',
        title: t('common.error', 'Tahlilda xatolik yuz berdi'),
        message: getErrorMessage(err),
      });
    },
  });

  // Auto trigger syllabus on open if empty
  useEffect(() => {
    if (isOpen && course && !syllabusResult && !syllabusMutation.isPending) {
      syllabusMutation.mutate();
    }
  }, [isOpen, course?.id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    sound.playSuccess();
    haptics.light();
    push({
      type: 'success',
      title: t('common.copied', 'Nusxalandi!'),
      message: t('courses.ai.copiedDesc', 'Matn buferga muvaffaqiyatli nusxalandi'),
    });
  };

  if (!isOpen || !course) return null;

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title={`AI Kurs Me'mori: ${course.name}`}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Tab switchers */}
        <div className="flex rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('syllabus')}
            className={`flex-1 py-2 text-[12.5px] font-semibold rounded-lg transition-all ${
              activeTab === 'syllabus'
                ? 'bg-white dark:bg-surface-800 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            📚 O'quv rejasi (Syllabus)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('marketing')}
            className={`flex-1 py-2 text-[12.5px] font-semibold rounded-lg transition-all ${
              activeTab === 'marketing'
                ? 'bg-white dark:bg-surface-800 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            📢 Qabul & Marketing posti
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`flex-1 py-2 text-[12.5px] font-semibold rounded-lg transition-all ${
              activeTab === 'pricing'
                ? 'bg-white dark:bg-surface-800 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            💡 Narxlash & Bozor tahlili
          </button>
        </div>

        {/* TAB 1: SYLLABUS */}
        {activeTab === 'syllabus' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3.5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[12px]">
              <div>
                <span className="font-semibold text-[var(--text-primary)]">{course.name}</span>
                <span className="text-[var(--text-tertiary)]"> · {course.duration} oy</span>
              </div>
              <span className="px-2 py-0.5 rounded font-mono font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400">
                {course.level || 'STANDART'}
              </span>
            </div>

            {syllabusMutation.isPending ? (
              <div className="p-8 text-center space-y-3">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
                <p className="text-[13px] text-[var(--text-secondary)] font-medium">
                  AI mutaxassisi to'liq o'quv dasturi va amaliy loyihalarni tuzmoqda...
                </p>
              </div>
            ) : syllabusResult ? (
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.03] p-5 space-y-3">
                <div className="prose dark:prose-invert max-w-none text-[13.5px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                  {syllabusResult}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-indigo-500/10">
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => syllabusMutation.mutate()}
                  >
                    🔄 Qayta yaratish
                  </GlassButton>
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(syllabusResult)}
                  >
                    📋 Nusxalash
                  </GlassButton>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <GlassButton
                  variant="primary"
                  onClick={() => syllabusMutation.mutate()}
                >
                  O'quv rejasini yaratish
                </GlassButton>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MARKETING COPY */}
        {activeTab === 'marketing' && (
          <div className="space-y-4">
            <GlassField label="Tarqatish kanali">
              <GlassSelect
                value={marketingChannel}
                onChange={(e) => setMarketingChannel(e.target.value as any)}
              >
                <option value="telegram">✈️ Telegram kanal / Guruh posti</option>
                <option value="instagram">📸 Instagram post & Storis matni</option>
                <option value="sms">💬 Qisqa SMS xabarnoma</option>
              </GlassSelect>
            </GlassField>

            <div className="flex justify-end">
              <GlassButton
                variant="primary"
                onClick={() => marketingMutation.mutate()}
                loading={marketingMutation.isPending}
              >
                ✨ Marketing postini yaratish
              </GlassButton>
            </div>

            {marketingResult && (
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  <span>Tayyor marketing posti</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(marketingResult)}
                    className="text-brand-600 dark:text-brand-400 hover:underline capitalize"
                  >
                    📋 Nusxa olish
                  </button>
                </div>
                <div className="rounded-xl bg-white dark:bg-surface-800 p-4 border border-black/[0.05] dark:border-white/[0.05] text-[13px] leading-relaxed whitespace-pre-wrap font-sans">
                  {marketingResult}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PRICING ADVISOR */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3.5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[12px]">
              <div>
                <span className="font-semibold text-[var(--text-primary)]">Hozirgi narx:</span>
                <span className="text-brand-600 dark:text-brand-400 font-bold ml-1">
                  {formatCurrency(Number(course.price))} / oy
                </span>
              </div>
              <span className="text-[var(--text-tertiary)]">
                Jami: {formatCurrency(Number(course.price) * course.duration)}
              </span>
            </div>

            {pricingMutation.isPending ? (
              <div className="p-8 text-center space-y-3">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
                <p className="text-[13px] text-[var(--text-secondary)] font-medium">
                  Bozor narxlari va to'lov modellari tahlil qilinmoqda...
                </p>
              </div>
            ) : pricingResult ? (
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.03] p-5 space-y-3">
                <div className="prose dark:prose-invert max-w-none text-[13.5px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                  {pricingResult}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-indigo-500/10">
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => pricingMutation.mutate()}
                  >
                    🔄 Qayta tahlil
                  </GlassButton>
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(pricingResult)}
                  >
                    📋 Nusxalash
                  </GlassButton>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <GlassButton
                  variant="primary"
                  onClick={() => pricingMutation.mutate()}
                >
                  Narxlash tahlilini boshlash
                </GlassButton>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassModal>
  );
});
