import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GlassModal,
  GlassButton,
  GlassField,
  useToasts,
} from '@/components/ui';
import { teachersApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import type { Teacher } from '@/lib/types';
import { fullName } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';

interface TeacherQuickAssignGroupModalProps {
  teacher: Teacher | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TeacherQuickAssignGroupModal = memo(function TeacherQuickAssignGroupModal({
  teacher,
  isOpen,
  onClose,
}: TeacherQuickAssignGroupModalProps) {
  const { t } = useSafeI18n();
  const { push } = useToasts();
  const qc = useQueryClient();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const groupsQuery = useQuery({
    queryKey: ['groups', 'active-selector'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    enabled: isOpen,
  });

  const groupsList = (groupsQuery.data as any)?.items || [];
  const teacherName = teacher ? fullName(teacher.user?.firstName, teacher.user?.lastName) : '';

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!teacher?.id || !selectedGroupId) throw new Error('Missing selection');
      return teachersApi.assignGroup(teacher.id, selectedGroupId);
    },
    onSuccess: () => {
      sound.playSuccess?.();
      haptics.success();
      push('success', t('teachers.assignModal.success'));
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      qc.invalidateQueries({ queryKey: ['groups'] });
      setSelectedGroupId('');
      onClose();
    },
    onError: (err: Error) => {
      haptics.error();
      push('error', getErrorMessage(err));
    },
  });

  if (!isOpen || !teacher) return null;

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title={t('teachers.assignModal.title')}
      description={`${teacherName} ga guruh biriktirish`}
    >
      <div className="space-y-4 pt-2">
        <GlassField label={t('teachers.assignModal.selectGroup')}>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Guruhni tanlang --</option>
            {groupsList.map((g: any) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.course?.name || 'Kurs'}) {g.teacherId ? '· [Boshqa o‘qituvchida]' : '· [Biriktirilmagan]'}
              </option>
            ))}
          </select>
        </GlassField>

        <div className="flex justify-end gap-2.5 pt-3">
          <GlassButton variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </GlassButton>
          <GlassButton
            variant="primary"
            disabled={!selectedGroupId}
            loading={assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            {t('teachers.assignModal.submit')}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
});
