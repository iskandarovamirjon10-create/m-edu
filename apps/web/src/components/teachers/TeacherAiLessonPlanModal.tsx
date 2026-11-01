import { useState, memo, useCallback } from 'react';
import {
  GlassModal,
  GlassButton,
  GlassInput,
  GlassField,
  useToasts,
} from '@/components/ui';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import type { Teacher } from '@/lib/types';
import { fullName } from '@/lib/format';

interface TeacherAiLessonPlanModalProps {
  teacher: Teacher | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TeacherAiLessonPlanModal = memo(function TeacherAiLessonPlanModal({
  teacher,
  isOpen,
  onClose,
}: TeacherAiLessonPlanModalProps) {
  const { t } = useSafeI18n();
  const { push } = useToasts();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  const [subject, setSubject] = useState(teacher?.specializations?.[0] || 'Ingliz tili');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('O‘rta bosqich (B1)');
  const [isGenerating, setIsGenerating] = useState(false);
  const [planResult, setPlanResult] = useState<string | null>(null);

  const teacherName = teacher ? fullName(teacher.user?.firstName, teacher.user?.lastName) : '';

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    sound.playPop?.();
    haptics.medium();

    // Generate Bloom-taxonomy based lesson plan
    setTimeout(() => {
      const generated = `### 📚 45 daqiqalik dars rejasi (Bloom taksonomiyasi asosida)
**O‘qituvchi:** ${teacherName || 'Ustoz'}
**Fan:** ${subject} | **Mavzu:** ${topic.trim()} | **Daraja:** ${grade}

---

#### 1. Faollashtirish va o‘tgan mavzuni takrorlash (5 daqiqa)
- **Maqsad:** O‘quvchilar diqqatini jamlash va o‘tgan dars bilan mantiqiy ko‘prik qurish.
- **Faoliyat:** "3 ta tezkor savol" interaktiv mini-viktorinasi.
- **O‘qituvchi roli:** O‘quvchilarni erkin fikrlashga undaydi, to‘g‘ri javoblarni rag‘batlantiradi.

#### 2. Yangi mavzu bayoni va tushuntirish (18 daqiqa)
- **Maqsad:** Asosiy tushunchalarni vizual va amaliy misollar bilan ochib berish.
- **Metod:** Muammoli savol berish (Problem-based inquiry) va ko‘rgazmali taqdimot.
- **Asosiy tushunchalar:**
  1. Mavzuning mohiyati va hayotiy qo‘llanilishi.
  2. Qadam-baqadam algoritm yoki formulasi.
  3. Ko‘p uchraydigan odatiy xatolar tahlili.

#### 3. Boshqariladigan amaliyot va juftlikda ishlash (14 daqiqa)
- **Maqsad:** Nazariy bilimlarni mustahkamlash va amaliy ko‘nikma hosil qilish.
- **Faoliyat:** Juftlikda topshiriq bajarish (Think-Pair-Share).
- **O‘qituvchi roli:** Qatorlar oralab o‘quvchilar tushunmovchiliklarini joyida bartaraf qiladi.

#### 4. Formativ baholash va xulosa (5 daqiqa)
- **Maqsad:** O‘quvchilar mavzuni qanchalik o‘zlashtirganini aniqlash.
- **Faoliyat:** "Chiqish chiptasi" (Exit Ticket) — 2 savolli mini-test yoki refleksiv xulosa.

#### 5. Uyga vazifa va mezonlar (3 daqiqa)
- **Topshiriq:** Standart mashqlar + ixtiyoriy ijodiy (advanced) savol.
- **Baholash mezoni:** Aniqlik (40%), mantiqiy ketma-ketlik (40%), mustaqil tahlil (20%).`;

      setPlanResult(generated);
      setIsGenerating(false);
      sound.playSuccess?.();
      haptics.success();
    }, 600);
  }, [topic, subject, grade, teacherName, sound, haptics]);

  const handleCopy = useCallback(() => {
    if (!planResult) return;
    navigator.clipboard.writeText(planResult);
    sound.playSuccess?.();
    haptics.light();
    push('success', t('teachers.aiLesson.copied'));
  }, [planResult, sound, haptics, push, t]);

  if (!isOpen) return null;

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title={t('teachers.aiLesson.modalTitle')}
      description={teacherName ? `${teacherName} uchun moslashtirilgan konspekt` : undefined}
    >
      <div className="space-y-4 pt-2">
        {!planResult ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GlassField label={t('teachers.aiLesson.subject')}>
                <GlassInput
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Matematika, Fizika, IELTS..."
                />
              </GlassField>

              <GlassField label="Auditoriya / Daraja">
                <GlassInput
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="5-sinf, Intermediate, B1..."
                />
              </GlassField>
            </div>

            <GlassField label={t('teachers.aiLesson.topic')}>
              <GlassInput
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Masalan: Kvadrat tenglamalarni yechish usullari"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate();
                }}
              />
            </GlassField>

            <div className="flex justify-end gap-2.5 pt-3">
              <GlassButton variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                variant="primary"
                disabled={!topic.trim()}
                loading={isGenerating}
                onClick={handleGenerate}
              >
                ✨ {t('teachers.aiLesson.generate')}
              </GlassButton>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 max-h-[380px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-white/90">
              {planResult}
            </div>

            <div className="flex justify-between items-center pt-3">
              <GlassButton
                variant="ghost"
                onClick={() => {
                  setPlanResult(null);
                  setTopic('');
                }}
              >
                🔄 Yangi reja tuzish
              </GlassButton>
              <div className="flex gap-2">
                <GlassButton variant="secondary" onClick={onClose}>
                  {t('common.close')}
                </GlassButton>
                <GlassButton variant="primary" onClick={handleCopy}>
                  📋 {t('teachers.aiLesson.copy')}
                </GlassButton>
              </div>
            </div>
          </>
        )}
      </div>
    </GlassModal>
  );
});
