import { useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassCard,
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassTD,
} from '@/components/ui';
import { fullName, formatDate, formatTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Group, GroupSchedule } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface GroupMember {
  student: {
    id: string;
    user?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  };
  isActive: boolean;
  joinedAt?: string;
}

function formatDayOfWeek(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
}

function formatCapacity(current: number, max?: number | null): string {
  if (!max) return String(current);
  return `${current} / ${max}`;
}

function getGroupStatusBadge(isActive: boolean): { variant: 'success' | 'muted'; label: string } {
  return isActive
    ? { variant: 'success', label: 'Active' }
    : { variant: 'muted', label: 'Inactive' };
}

function formatScheduleTime(time: string): string {
  return formatTime(time);
}

function getScheduleRoom(schedule: GroupSchedule, groupRoom?: string | null): string {
  return schedule.room || groupRoom || '—';
}

export function GroupDetailPage() {
  usePageTitle('Group Details');
  const { id } = useParams<{ id: string }>();

  const group = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.get(id!),
    enabled: !!id,
    placeholderData: (previousData) => previousData,
  });

  const groupData = group.data as Group | undefined;
  const members = useMemo(
    () =>
      (groupData?.enrollments || []).filter(
        (enrollment) => enrollment.isActive,
      ) as GroupMember[],
    [groupData],
  );

  const schedules = useMemo(
    () => groupData?.schedules || [],
    [groupData],
  );

  const { refetch: refetchGroup } = group;
  const handleRetry = useCallback(() => {
    void refetchGroup();
  }, [refetchGroup]);

  // Early return for loading state
  if (group.isLoading && !groupData) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader title="Group" subtitle="Loading group details…" />
          <GlassCard className="p-8">
            <GlassPageLoader label="Loading group…" />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (group.isError || !groupData) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader title="Group" subtitle="Group details" />
          <GlassCard className="p-8">
            <GlassErrorState
              title="Group not found"
              message={getErrorMessage(group.error as Error)}
              onRetry={handleRetry}
            />
          </GlassCard>
        </div>
      </div>
    );
  }

  const statusBadge = getGroupStatusBadge(groupData.isActive);
  const teacherName = groupData.teacher
    ? fullName(
        groupData.teacher.user?.firstName,
        groupData.teacher.user?.lastName,
      )
    : '—';

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
      <div className="page-container">
        <GlassPageHeader
          title={groupData.name}
          subtitle={`${groupData.course?.name || 'Course'} · ${groupData.room || 'No room'}`}
          actions={
            <Link
              to={`/groups/${groupData.id}/edit`}
              className="glass-btn glass-btn-secondary"
            >
              Edit group
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Group details */}
          <GlassCard className="overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Details</h2>
            </div>
            <div className="p-5">
              <dl className="space-y-4">
                <div className="flex items-start justify-between">
                  <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Teacher</dt>
                  <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {teacherName}
                  </dd>
                </div>
                <div className="flex items-start justify-between">
                  <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Capacity</dt>
                  <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatCapacity(members.length, groupData.capacity)}
                  </dd>
                </div>
                <div className="flex items-start justify-between">
                  <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Start date</dt>
                  <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(groupData.startDate)}
                  </dd>
                </div>
                <div className="flex items-start justify-between">
                  <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>End date</dt>
                  <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(groupData.endDate)}
                  </dd>
                </div>
                <div className="flex items-start justify-between">
                  <dt className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status</dt>
                  <dd>
                    <GlassBadge variant={statusBadge.variant}>
                      {statusBadge.label}
                    </GlassBadge>
                  </dd>
                </div>
              </dl>
            </div>
          </GlassCard>

          {/* Group members */}
          <GlassCard className="overflow-hidden lg:col-span-2">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Members ({members.length})
              </h2>
            </div>

            {members.length === 0 ? (
              <GlassEmptyState
                title="No members"
                message="Assign students to this group to see them here."
              />
            ) : (
              <div className="glass-table-wrap">
                <GlassTable>
                  <GlassTHead>
                    <GlassTR>
                      <GlassTH>Student</GlassTH>
                      <GlassTH>Email</GlassTH>
                      <GlassTH>Joined</GlassTH>
                    </GlassTR>
                  </GlassTHead>
                  <GlassTBody>
                    {members.map((member) => (
                      <GlassTR
                        key={member.student.id}
                        className="transition-colors"
                      >
                        <GlassTD className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {fullName(
                            member.student.user?.firstName,
                            member.student.user?.lastName,
                          )}
                        </GlassTD>
                        <GlassTD>{member.student.user?.email || '—'}</GlassTD>
                        <GlassTD className="whitespace-nowrap">
                          {member.joinedAt
                            ? formatDate(member.joinedAt)
                            : '—'}
                        </GlassTD>
                      </GlassTR>
                    ))}
                  </GlassTBody>
                </GlassTable>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Schedule section */}
        {schedules.length > 0 && (
          <GlassCard className="overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Schedule
              </h2>
            </div>
            <div className="glass-table-wrap">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>Day</GlassTH>
                    <GlassTH>Start</GlassTH>
                    <GlassTH>End</GlassTH>
                    <GlassTH>Room</GlassTH>
                  </GlassTR>
                </GlassTHead>
                <GlassTBody>
                  {schedules.map((schedule) => (
                    <GlassTR
                      key={schedule.id}
                      className="transition-colors"
                    >
                      <GlassTD className="capitalize">
                        {formatDayOfWeek(schedule.dayOfWeek)}
                      </GlassTD>
                      <GlassTD className="whitespace-nowrap">
                        {formatScheduleTime(schedule.startTime)}
                      </GlassTD>
                      <GlassTD className="whitespace-nowrap">
                        {formatScheduleTime(schedule.endTime)}
                      </GlassTD>
                      <GlassTD>
                        {getScheduleRoom(schedule, groupData.room)}
                      </GlassTD>
                    </GlassTR>
                  ))}
                </GlassTBody>
              </GlassTable>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
