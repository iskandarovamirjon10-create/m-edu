import { useState, memo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GlassModal,
  GlassButton,
  GlassInput,
  GlassField,
  GlassTextArea,
  useToasts,
} from '@/components/ui';
import { teachersApi, notificationsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { getErrorMessage } from '@/lib/errorMessages';

interface BulkTeacherActionsProps {
  selectedIds: string[];
  isOpen: boolean;
  activeModal: 'status' | 'salary' | 'specialization' | 'message' | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkTeacherActionsModals = memo(function BulkTeacherActionsModals({
  selectedIds,
  isOpen,
  activeModal,
  onClose,
  onSuccess,
}: BulkTeacherActionsProps) {
  const { t } = useSafeI18n();
  const { push } = useToasts();
  const qc = useQueryClient();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  // 1. Bulk Status State
  const [targetStatus, setTargetStatus] = useState<boolean>(true);

  // 2. Bulk Salary State
  const [salaryType, setSalaryType] = useState<'MONTHLY' | 'HOURLY' | 'PER_LESSON'>('HOURLY');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [lessonRate, setLessonRate] = useState<string>('');

  // 3. Bulk Specialization State
  const [specializations, setSpecializations] = useState<string>('');
  const [specMode, setSpecMode] = useState<'add' | 'replace'>('add');

  // 4. Bulk Message State
  const [msgTitle, setMsgTitle] = useState<string>('');
  const [msgBody, setMsgBody] = useState<string>('');
  const [msgChannel, setMsgChannel] = useState<'SYSTEM' | 'SMS'>('SYSTEM');

  const count = selectedIds.length;

  // Mutations
  const statusMutation = useMutation({
    mutationFn: () => teachersApi.bulkStatus({ teacherIds: selectedIds, isActive: targetStatus }),
    onSuccess: () => {
      sound.playSuccess?.();
      haptics.success();
      push('success', t('teachers.bulk.statusUpdated', { count }));
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      haptics.error();
      push('error', getErrorMessage(err));
    },
  });

  const salaryMutation = useMutation({
    mutationFn: () =>
      teachersApi.bulkSalary({
        teacherIds: selectedIds,
        salaryType,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        lessonRate: lessonRate ? parseFloat(lessonRate) : undefined,
      }),
    onSuccess: () => {
      sound.playSuccess?.();
      haptics.success();
      push('success', t('teachers.bulk.salaryUpdated', { count }));
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      haptics.error();
      push('error', getErrorMessage(err));
    },
  });

  const specMutation = useMutation({
    mutationFn: () =>
      teachersApi.bulkSpecializations({
        teacherIds: selectedIds,
        specializations: specializations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        mode: specMode,
      }),
    onSuccess: () => {
      sound.playSuccess?.();
      haptics.success();
      push('success', t('teachers.bulk.specializationsUpdated', { count }));
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      haptics.error();
      push('error', getErrorMessage(err));
    },
  });

  const messageMutation = useMutation({
    mutationFn: async () => {
      // Send notification or broadcast
      const notifyAny = notificationsApi as any;
      if (typeof notifyAny?.send === 'function') {
        await notifyAny.send({
          userIds: selectedIds,
          title: msgTitle.trim(),
          body: msgBody.trim(),
          channel: msgChannel,
        });
      }
    },
    onSuccess: () => {
      sound.playSuccess?.();
      haptics.success();
      push('success', t('teachers.bulk.messageSent', { count }));
      setMsgTitle('');
      setMsgBody('');
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      haptics.error();
      push('error', getErrorMessage(err));
    },
  });

  if (!isOpen || !activeModal) return null;

  return (
    <>
      {/* ── Status Modal ────────────────────────────────────────────── */}
      {activeModal === 'status' && (
        <GlassModal
          open={isOpen}
          onClose={onClose}
          title={t('teachers.bulk.toggleStatus')}
          description={`${count} ${t('teachers.bulk.itemLabel')}`}
        >
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600 dark:text-white/70">
              Tanlangan {count} nafar o‘qituvchining faollik holatini o‘zgartirmoqchimisiz?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetStatus(true)}
                className={`p-3.5 rounded-2xl border text-center transition-all ${
                  targetStatus
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                }`}
              >
                🟢 {t('teachers.filter.active')}
              </button>
              <button
                type="button"
                onClick={() => setTargetStatus(false)}
                className={`p-3.5 rounded-2xl border text-center transition-all ${
                  !targetStatus
                    ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                }`}
              >
                🔴 {t('teachers.filter.inactive')}
              </button>
            </div>
            <div className="flex justify-end gap-2.5 pt-3">
              <GlassButton variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                variant="primary"
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate()}
              >
                {t('common.save')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* ── Salary Modal ────────────────────────────────────────────── */}
      {activeModal === 'salary' && (
        <GlassModal
          open={isOpen}
          onClose={onClose}
          title={t('teachers.bulk.salary')}
          description={`${count} ${t('teachers.bulk.itemLabel')}`}
        >
          <div className="space-y-4 pt-2">
            <GlassField label={t('teachers.form.salaryType')}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['HOURLY', 'MONTHLY', 'PER_LESSON'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSalaryType(type)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      salaryType === type
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                    }`}
                  >
                    {type === 'HOURLY'
                      ? t('teachers.salaryType.hourly')
                      : type === 'MONTHLY'
                      ? t('teachers.salaryType.monthly')
                      : t('teachers.salaryType.perLesson')}
                  </button>
                ))}
              </div>
            </GlassField>

            {salaryType === 'HOURLY' && (
              <GlassField label={t('teachers.form.hourlyRate')}>
                <GlassInput
                  type="number"
                  placeholder="150000"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </GlassField>
            )}

            {salaryType === 'PER_LESSON' && (
              <GlassField label={t('teachers.form.lessonRate')}>
                <GlassInput
                  type="number"
                  placeholder="80000"
                  value={lessonRate}
                  onChange={(e) => setLessonRate(e.target.value)}
                />
              </GlassField>
            )}

            <div className="flex justify-end gap-2.5 pt-3">
              <GlassButton variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                variant="primary"
                loading={salaryMutation.isPending}
                onClick={() => salaryMutation.mutate()}
              >
                {t('common.save')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* ── Specialization Modal ────────────────────────────────────── */}
      {activeModal === 'specialization' && (
        <GlassModal
          open={isOpen}
          onClose={onClose}
          title={t('teachers.bulk.specializations')}
          description={`${count} ${t('teachers.bulk.itemLabel')}`}
        >
          <div className="space-y-4 pt-2">
            <GlassField
              label={t('teachers.form.specializations')}
              hint={t('teachers.form.specializationsHint')}
            >
              <GlassInput
                placeholder="Matematika, Fizika, IELTS"
                value={specializations}
                onChange={(e) => setSpecializations(e.target.value)}
              />
            </GlassField>

            <div className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-white/70">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="specMode"
                  checked={specMode === 'add'}
                  onChange={() => setSpecMode('add')}
                />
                <span>Mavjudlariga qo‘shish (Add)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="specMode"
                  checked={specMode === 'replace'}
                  onChange={() => setSpecMode('replace')}
                />
                <span>To‘liq almashtirish (Replace)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-3">
              <GlassButton variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                variant="primary"
                loading={specMutation.isPending}
                onClick={() => specMutation.mutate()}
              >
                {t('common.save')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* ── Message / SMS Modal ─────────────────────────────────────── */}
      {activeModal === 'message' && (
        <GlassModal
          open={isOpen}
          onClose={onClose}
          title={t('teachers.bulk.notify')}
          description={`${count} ${t('teachers.bulk.itemLabel')}`}
        >
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMsgChannel('SYSTEM')}
                className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold ${
                  msgChannel === 'SYSTEM'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                }`}
              >
                🔔 Tizim xabarnomasi
              </button>
              <button
                type="button"
                onClick={() => setMsgChannel('SMS')}
                className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold ${
                  msgChannel === 'SMS'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60'
                }`}
              >
                📱 SMS xabarnoma
              </button>
            </div>

            <GlassField label="Mavzu / Sarlavha">
              <GlassInput
                placeholder="Dars jadvalidagi o‘zgarishlar"
                value={msgTitle}
                onChange={(e) => setMsgTitle(e.target.value)}
              />
            </GlassField>

            <GlassField label="Xabar matni">
              <GlassTextArea
                rows={4}
                placeholder="Hurmatli ustozlar! Ertangi pedagogik kengash soat 15:00 da o‘tkaziladi..."
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
              />
            </GlassField>

            <div className="flex justify-end gap-2.5 pt-3">
              <GlassButton variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                variant="primary"
                disabled={!msgBody.trim()}
                loading={messageMutation.isPending}
                onClick={() => messageMutation.mutate()}
              >
                Jo‘natish
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}
    </>
  );
});
