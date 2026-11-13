import { useState, memo, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GlassModal,
  GlassButton,
  GlassField,
  useToasts,
} from '@/components/ui';
import { teachersApi, groupsApi } from '@/lib/api';
import { toList } from '@/lib/normalizeList';
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

interface GroupOption {
  id: string;
  name: string;
  course?: { name?: string };
  teacherId?: string | null;
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

  useEffect(() => {
    if (!isOpen) {
      setSelectedGroupId('');
    }
  }, [isOpen, teacher?.id]);

  const groupsQuery = useQuery({
    queryKey: ['groups', 'active-selector'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    enabled: isOpen,
  });

  const groupsList = useMemo<GroupOption[]>(
    () => toList<GroupOption>(groupsQuery.data),
    [groupsQuery.data],
  );
  const teacherName = teacher ? fullName(teacher.user?.firstName, teacher.user?.lastName) : '';

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!teacher?.id || !selectedGroupId) throw new Error('Missing selection');
      return teachersApi.assignGroup(teacher.id, selectedGroupId);
    },
    onSuccess: () => {
      sound.playSuccess?.();
      haptics.success();
      push('success', t('teachers.assignModal.success', 'Guruh muvaffaqiyatli biriktirildi'));
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      qc.invalidateQueries({ queryKey: ['groups'] });
      setSelectedGroupId('');
      onClose();
    },
    onError: (err: Error) => {
      haptics.error();
      sound.playError?.();
      push('error', getErrorMessage(err));
    },
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && selectedGroupId && !assignMutation.isPending) {
        e.preventDefault();
        assignMutation.mutate();
      }
    },
    [selectedGroupId, assignMutation],
  );

  if (!isOpen || !teacher) return null;

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title={t('teachers.assignModal.title', 'O‘qituvchiga guruh biriktirish')}
      description={`${teacherName} ga yangi guruhni biriktirish`}
    >
      <div className="space-y-4 pt-2" onKeyDown={handleKeyDown}>
        <GlassField label={t('teachers.assignModal.selectGroup', 'Guruhni tanlang')}>
          <select
            value={selectedGroupId}
            onChange={(e) => {
              sound.playTick?.();
              setSelectedGroupId(e.target.value);
            }}
            disabled={groupsQuery.isLoading || assignMutation.isPending}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-white/70 dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.12] text-slate-800 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 backdrop-blur-md transition-all shadow-inner"
          >
            <option value="">-- Guruhni tanlang --</option>
            {groupsList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.course?.name || 'Kurs'}) {g.teacherId ? '· [Boshqa o‘qituvchida]' : '· [Biriktirilmagan]'}
              </option>
            ))}
          </select>
        </GlassField>

        <div className="flex justify-end gap-2.5 pt-3">
          <GlassButton
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => {
              sound.playTick?.();
              onClose();
            }}
          >
            {t('common.cancel', 'Bekor qilish')}
          </GlassButton>
          <GlassButton
            variant="primary"
            className="min-h-[44px]"
            disabled={!selectedGroupId || assignMutation.isPending}
            loading={assignMutation.isPending}
            onClick={() => {
              sound.playTick?.();
              assignMutation.mutate();
            }}
          >
            {t('teachers.assignModal.submit', 'Biriktirish')}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
});

export default TeacherQuickAssignGroupModal;
