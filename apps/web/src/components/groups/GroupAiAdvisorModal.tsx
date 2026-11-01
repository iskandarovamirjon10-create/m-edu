import { useState, memo, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  GlassModal,
  GlassButton,
  GlassInput,
  GlassField,
  GlassSelect,
  useToasts,
} from '@/components/ui';
import { aiApi } from '@/lib/api';
import { fullName } from '@/lib/format';
import type { Group } from '@/lib/types';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { getErrorMessage } from '@/lib/errorMessages';

interface GroupAiAdvisorModalProps {
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
}

export const GroupAiAdvisorModal = memo(function GroupAiAdvisorModal({
  group,
  isOpen,
  onClose,
}: GroupAiAdvisorModalProps) {
  const { t } = useSafeI18n();
  const { push } = useToasts();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  const [activeTab, setActiveTab] = useState<'diagnosis' | 'announcement'>('diagnosis');

  // Announcement state
  const [topic, setTopic] = useState<'schedule' | 'exam' | 'module_start' | 'custom'>('schedule');
  const [tone, setTone] = useState<'friendly' | 'formal' | 'urgent'>('friendly');
  const [extraDetails, setExtraDetails] = useState('');
  const [generatedAnnouncement, setGeneratedAnnouncement] = useState('');

  // Diagnosis state
  const [diagnosisResult, setDiagnosisResult] = useState<string>('');

  const teacherName = group?.teacher?.user
    ? fullName(group.teacher.user.firstName, group.teacher.user.lastName)
    : "O'qituvchi biriktirilmagan";

  const enrolledCount = group?._count?.enrollments ?? group?.enrollments?.length ?? 0;
  const capacity = group?.capacity && group.capacity > 0 ? group.capacity : 20;

  // Diagnosis Mutation
  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      if (!group) return;
      const prompt = `Siz professional ta'lim markazi maslahatchisisiz. Ushbu guruh holatini tahlil qiling va qisqa, aniq amaliy tavsiyalar bering:
Guruh nomi: "${group.name}"
Kurs: "${group.course?.name || "Noma'lum"}"
O'qituvchi: "${teacherName}"
Xona: "${group.room || "Belgilanmagan"}"
O'quvchilar soni: ${enrolledCount} nafar
Guruh sig'imi: ${capacity} o'rin
To'ldirilish darajasi: ${Math.round((enrolledCount / capacity) * 100)}%
Holati: ${group.isActive ? 'Faol' : 'Nofaol'}

Iltimos, quyidagi 3 qismdan iborat xulosa bering:
1. Guruh to'ldirilishi va sig'im tahlili (Capacity & Balance)
2. O'quv jarayoni va davomat xatarlari (Attendance & Retention risks)
3. Amaliy tavsiyalar (Action items: qo'shimcha qabul, parallel guruh bilan birlashtirish yoki xonani almashtirish).`;

      const res = await aiApi.chat({
        message: prompt,
        route: `/groups/${group.id}`,
      });
      return res.content;
    },
    onSuccess: (data) => {
      if (data) {
        sound.playSuccess();
        haptics.success();
        setDiagnosisResult(data);
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

  // Announcement Mutation
  const announcementMutation = useMutation({
    mutationFn: async () => {
      if (!group) return;
      const topicLabels: Record<string, string> = {
        schedule: "Dars jadvali yoki vaqtining o'zgarishi",
        exam: "Imtihon / Yakuniy nazorat o'tkazilishi",
        module_start: "Yangi modul boshlanishi va tayyorgarlik",
        custom: "Maxsus e'lon",
      };

      const prompt = `Ta'lim markazining "${group.name}" guruhi o'quvchilari va ota-onalari uchun Telegram / SMS e'loni matnini yozib bering.
Guruh: ${group.name} (${group.course?.name || ''})
O'qituvchi: ${teacherName}
Mavzu: ${topicLabels[topic]}
Ohang (Tone): ${tone === 'friendly' ? "Samimiy, do'stona va rag'batlantiruvchi" : tone === 'formal' ? "Rasmiy va jiddiy" : "Shoshilinch va muhim"}
Qo'shimcha tafsilotlar: ${extraDetails || "Rejali darslar o'z vaqtida bo'lib o'tadi"}

Matn chiroyli formatlangan, emojilar bilan va darhol yuborishga tayyor bo'lsin.`;

      const res = await aiApi.chat({
        message: prompt,
        route: `/groups/${group.id}`,
      });
      return res.content;
    },
    onSuccess: (data) => {
      if (data) {
        sound.playSuccess();
        haptics.success();
        setGeneratedAnnouncement(data);
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

  // Auto trigger diagnosis on open if empty
  useEffect(() => {
    if (isOpen && group && !diagnosisResult && !diagnoseMutation.isPending) {
      diagnoseMutation.mutate();
    }
  }, [isOpen, group?.id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    sound.playSuccess();
    haptics.light();
    push({
      type: 'success',
      title: t('common.copied', 'Nusxalandi!'),
      message: t('groups.ai.copiedDesc', 'Matn buferga muvaffaqiyatli nusxalandi'),
    });
  };

  if (!isOpen || !group) return null;

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title={`AI Maslahatchi: ${group.name}`}
      titleTestId="group-ai-advisor-title"
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Tab switchers */}
        <div className="flex rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('diagnosis')}
            className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              activeTab === 'diagnosis'
                ? 'bg-white dark:bg-surface-800 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            📊 Guruh diagnostikasi & Tavsiyalar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('announcement')}
            className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              activeTab === 'announcement'
                ? 'bg-white dark:bg-surface-800 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            📢 Telegram / SMS Xabarnoma
          </button>
        </div>

        {/* TAB 1: DIAGNOSIS */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3.5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[12px]">
              <div>
                <span className="font-semibold text-[var(--text-primary)]">{group.name}</span>
                <span className="text-[var(--text-tertiary)]"> · {group.course?.name}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-[var(--text-secondary)]">{enrolledCount} / {capacity} talaba</span>
                <span className="px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold">
                  {Math.round((enrolledCount / capacity) * 100)}%
                </span>
              </div>
            </div>

            {diagnoseMutation.isPending ? (
              <div className="p-8 text-center space-y-3">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
                <p className="text-[13px] text-[var(--text-secondary)] font-medium">
                  AI guruh sig'imi, davomat va yuklamasini tahlil qilmoqda...
                </p>
              </div>
            ) : diagnosisResult ? (
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.03] p-5 space-y-3">
                <div className="prose dark:prose-invert max-w-none text-[13.5px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                  {diagnosisResult}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-indigo-500/10">
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => diagnoseMutation.mutate()}
                  >
                    🔄 Qayta tahlil qilish
                  </GlassButton>
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(diagnosisResult)}
                  >
                    📋 Nusxalash
                  </GlassButton>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <GlassButton
                  variant="primary"
                  onClick={() => diagnoseMutation.mutate()}
                >
                  Tahlilni boshlash
                </GlassButton>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ANNOUNCEMENT GENERATOR */}
        {activeTab === 'announcement' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <GlassField label="Xabarnoma mavzusi">
                <GlassSelect
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as any)}
                >
                  <option value="schedule">📅 Dars jadvali o'zgarishi</option>
                  <option value="exam">📝 Imtihon / Nazorat testi</option>
                  <option value="module_start">🚀 Yangi modul boshlanishi</option>
                  <option value="custom">💬 Boshqa maxsus xabar</option>
                </GlassSelect>
              </GlassField>

              <GlassField label="Muloqot ohangi">
                <GlassSelect
                  value={tone}
                  onChange={(e) => setTone(e.target.value as any)}
                >
                  <option value="friendly">😊 Samimiy va do'stona</option>
                  <option value="formal">👔 Rasmiy va jiddiy</option>
                  <option value="urgent">⚡ Muhim / Shoshilinch</option>
                </GlassSelect>
              </GlassField>
            </div>

            <GlassField label="Qo'shimcha ma'lumot yoki izoh (ixtiyoriy)">
              <GlassInput
                value={extraDetails}
                onChange={(e) => setExtraDetails(e.target.value)}
                placeholder="Masalan: Keyingi dars soat 15:00 da 204-xonada boshlanadi"
              />
            </GlassField>

            <div className="flex justify-end">
              <GlassButton
                variant="primary"
                onClick={() => announcementMutation.mutate()}
                loading={announcementMutation.isPending}
              >
                ✨ Xabarnoma matnini yaratish
              </GlassButton>
            </div>

            {generatedAnnouncement && (
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  <span>Tayyor Telegram / SMS xabari</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedAnnouncement)}
                    className="text-brand-600 dark:text-brand-400 hover:underline capitalize"
                  >
                    📋 Nusxa olish
                  </button>
                </div>
                <div className="rounded-xl bg-white dark:bg-surface-800 p-4 border border-black/[0.05] dark:border-white/[0.05] text-[13px] leading-relaxed whitespace-pre-wrap font-sans">
                  {generatedAnnouncement}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassModal>
  );
});
