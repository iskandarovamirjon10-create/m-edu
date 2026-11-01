import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  KeyRound,
  CheckCircle2,
  XCircle,
  Settings,
  Sparkles,
  Camera,
  Copy,
  Lock,
  Unlock,
} from 'lucide-react';
import { platformApi } from '@/lib/api';
import {
  useToasts,
  GlassCard,
  GlassButton,
  GlassModal,
  GlassBadge,
  GlassTable,
  GlassTHead,
  GlassTR,
  GlassTH,
  GlassTD,
  GlassInput,
  GlassSelect,
} from '@/components/ui';

interface TenantOrganization {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  _count: {
    users: number;
    students: number;
    branches: number;
  };
  subscription: {
    id: string;
    plan: string;
    status: string;
    priceUzs: number;
    maxStudents: number;
    maxBranches: number;
    maxEmployees: number;
    hasFaceId: boolean;
    hasAiCopilot: boolean;
    trialStartAt: string | null;
    trialEndAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
}

export function SuperAdminPage() {
  const queryClient = useQueryClient();
  const { push } = useToasts();
  const [selectedOrg, setSelectedOrg] = useState<TenantOrganization | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<{ code: string; expiresAt: string } | null>(null);

  // Quota Override Form State
  const [maxStudents, setMaxStudents] = useState<number>(100);
  const [maxBranches, setMaxBranches] = useState<number>(1);
  const [maxEmployees, setMaxEmployees] = useState<number>(5);
  const [hasFaceId, setHasFaceId] = useState<boolean>(false);
  const [hasAiCopilot, setHasAiCopilot] = useState<boolean>(true);
  const [subStatus, setSubStatus] = useState<string>('ACTIVE');

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['platform-statistics'],
    queryFn: platformApi.getStatistics,
    refetchInterval: 15000,
  });

  const { data: organizations = [] } = useQuery<TenantOrganization[]>({
    queryKey: ['platform-organizations'],
    queryFn: platformApi.getOrganizations,
    refetchInterval: 15000,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: platformApi.getPlans,
  });

  // Mutations
  const updateSubMutation = useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: any }) =>
      platformApi.updateOrganizationSubscription(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform-statistics'] });
      setIsEditModalOpen(false);
      push('success', 'Organization subscription and quotas updated');
    },
    onError: (err: any) => {
      push('error', err.message || 'Failed to update organization');
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.suspendOrganization(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform-statistics'] });
      push('success', 'Organization suspended');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (orgId: string) => platformApi.reactivateOrganization(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['platform-statistics'] });
      push('success', 'Organization reactivated');
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: (data: { maxUses: number; expiresAt: string }) =>
      platformApi.createInvitation(data),
    onSuccess: (data) => {
      setGeneratedInvite(data);
      push('success', 'Platform invitation code created');
    },
  });

  const handleOpenEdit = (org: TenantOrganization) => {
    setSelectedOrg(org);
    const sub = org.subscription;
    setMaxStudents(sub?.maxStudents || 100);
    setMaxBranches(sub?.maxBranches || 1);
    setMaxEmployees(sub?.maxEmployees || 5);
    setHasFaceId(Boolean(sub?.hasFaceId));
    setHasAiCopilot(Boolean(sub?.hasAiCopilot));
    setSubStatus(sub?.status || 'ACTIVE');
    setIsEditModalOpen(true);
  };

  const handleSaveQuotas = () => {
    if (!selectedOrg) return;
    updateSubMutation.mutate({
      orgId: selectedOrg.id,
      data: {
        maxStudents: Number(maxStudents),
        maxBranches: Number(maxBranches),
        maxEmployees: Number(maxEmployees),
        hasFaceId,
        hasAiCopilot,
        status: subStatus,
      },
    });
  };

  const formatUzs = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' UZS';
  };

  return (
    <div className="page-container space-y-6 pb-24 text-primary">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Super Admin Control Plane
            </h1>
          </div>
          <p className="text-sm text-secondary mt-1.5">
            Global SaaS governance, multi-tenant subscription enforcement, and system telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GlassButton
            variant="primary"
            size="md"
            icon={<KeyRound className="w-4 h-4" />}
            onClick={() => {
              setGeneratedInvite(null);
              setIsInviteModalOpen(true);
            }}
          >
            Generate Invite Code
          </GlassButton>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <GlassCard padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Monthly Recurring Revenue</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary">
              {stats?.mrr !== undefined ? formatUzs(stats.mrr) : '—'}
            </div>
            <div className="text-xs text-secondary mt-1">
              ARR: {stats?.arr !== undefined ? formatUzs(stats.arr) : '—'}
            </div>
          </div>
        </GlassCard>

        {/* Total Tenants */}
        <GlassCard padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Educational Centers</span>
            <Building2 className="w-5 h-5 text-brand-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary">
              {stats?.orgCount ?? '—'}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <span>{stats?.activeOrgs ?? 0} active organizations</span>
            </div>
          </div>
        </GlassCard>

        {/* Subscription Status Breakdown */}
        <GlassCard padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Subscriber States</span>
            <CreditCard className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats?.statusCounts?.ACTIVE ?? 0}
              </div>
              <div className="text-[11px] text-secondary">Active Paid</div>
            </div>
            <div className="border-l border-black/[0.06] dark:border-white/[0.08] pl-3">
              <div className="text-2xl font-bold text-amber-500">
                {stats?.statusCounts?.TRIALING ?? 0}
              </div>
              <div className="text-[11px] text-secondary">In Trial</div>
            </div>
            <div className="border-l border-black/[0.06] dark:border-white/[0.08] pl-3">
              <div className="text-2xl font-bold text-rose-500">
                {stats?.statusCounts?.SUSPENDED ?? 0}
              </div>
              <div className="text-[11px] text-secondary">Suspended</div>
            </div>
          </div>
        </GlassCard>

        {/* Total Students on Platform */}
        <GlassCard padding="md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Platform Students</span>
            <Users className="w-5 h-5 text-cyan-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary">
              {stats?.studentCount ?? '—'}
            </div>
            <div className="text-xs text-secondary mt-1">
              Enrolled tenant students
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Tenant Directory Section */}
      <GlassCard padding="none" className="overflow-hidden">
        <div className="p-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">Educational Centers & Tenants</h2>
            <p className="text-xs text-secondary mt-0.5">Manage live quotas, billing states, and biometric access overrides.</p>
          </div>
          <GlassBadge variant="neutral" size="sm">
            {organizations.length} organizations
          </GlassBadge>
        </div>

        <GlassTable minWidth={720}>
          <GlassTHead>
            <GlassTR>
              <GlassTH>Organization</GlassTH>
              <GlassTH>Plan</GlassTH>
              <GlassTH>Subscription Status</GlassTH>
              <GlassTH>Usage / Quota</GlassTH>
              <GlassTH>Biometrics & AI</GlassTH>
              <GlassTH align="right">Actions</GlassTH>
            </GlassTR>
          </GlassTHead>
          <tbody>
            {organizations.map((org) => {
              const sub = org.subscription;
              const status = sub?.status || 'UNKNOWN';

              let badgeVariant: 'green' | 'blue' | 'red' | 'amber' | 'neutral' = 'neutral';
              if (status === 'ACTIVE') badgeVariant = 'green';
              else if (status === 'TRIALING') badgeVariant = 'blue';
              else if (status === 'SUSPENDED') badgeVariant = 'red';
              else if (status === 'PAST_DUE') badgeVariant = 'amber';

              return (
                <GlassTR key={org.id}>
                  <GlassTD>
                    <div className="font-semibold text-primary">{org.name}</div>
                    <div className="text-xs text-secondary">{org.email || org.phone || 'No direct contact'}</div>
                  </GlassTD>

                  <GlassTD>
                    <GlassBadge variant="purple" size="sm">
                      {sub?.plan || 'START'}
                    </GlassBadge>
                  </GlassTD>

                  <GlassTD>
                    <GlassBadge variant={badgeVariant} size="sm">
                      {status}
                    </GlassBadge>
                  </GlassTD>

                  <GlassTD>
                    <div className="text-xs space-y-0.5 text-secondary">
                      <div>
                        Students: <strong className="text-primary">{org._count.students}</strong> / {sub?.maxStudents ?? 100}
                      </div>
                      <div>
                        Branches: <strong className="text-primary">{org._count.branches}</strong> / {sub?.maxBranches ?? 1}
                      </div>
                    </div>
                  </GlassTD>

                  <GlassTD>
                    <div className="flex items-center gap-2">
                      <span
                        title={sub?.hasFaceId ? 'Face ID Enabled' : 'Face ID Locked'}
                        className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                          sub?.hasFaceId
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-black/5 dark:bg-white/5 text-secondary border-black/[0.06] dark:border-white/[0.08]'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </span>

                      <span
                        title={sub?.hasAiCopilot ? 'AI Copilot Active' : 'AI Copilot Disabled'}
                        className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                          sub?.hasAiCopilot
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                            : 'bg-black/5 dark:bg-white/5 text-secondary border-black/[0.06] dark:border-white/[0.08]'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </GlassTD>

                  <GlassTD align="right">
                    <div className="flex items-center justify-end gap-2">
                      <GlassButton
                        size="xs"
                        variant="secondary"
                        icon={<Settings className="w-3.5 h-3.5" />}
                        onClick={() => handleOpenEdit(org)}
                      >
                        Quotas
                      </GlassButton>

                      {status === 'SUSPENDED' ? (
                        <GlassButton
                          size="xs"
                          variant="success"
                          icon={<Unlock className="w-3.5 h-3.5" />}
                          onClick={() => reactivateMutation.mutate(org.id)}
                        >
                          Reactivate
                        </GlassButton>
                      ) : (
                        <GlassButton
                          size="xs"
                          variant="danger-outline"
                          icon={<Lock className="w-3.5 h-3.5" />}
                          onClick={() => suspendMutation.mutate(org.id)}
                        >
                          Suspend
                        </GlassButton>
                      )}
                    </div>
                  </GlassTD>
                </GlassTR>
              );
            })}
          </tbody>
        </GlassTable>
      </GlassCard>

      {/* SaaS Pricing Plans Grid */}
      <GlassCard padding="lg" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">SaaS Pricing Catalog</h2>
          <p className="text-xs text-secondary mt-0.5">Current tier limits and monthly pricing in Uzbekistan Sums (UZS).</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {plans.map((p: any) => (
            <GlassCard
              key={p.id}
              padding="md"
              variant="flat"
              className="flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-primary">{p.name}</h3>
                  <GlassBadge variant="purple" size="sm">
                    {p.code}
                  </GlassBadge>
                </div>

                <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-2">
                  {formatUzs(p.priceUzs)}
                  <span className="text-xs text-secondary font-normal"> / mo</span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-secondary">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Up to <strong className="text-primary">{p.maxStudents}</strong> students</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Up to <strong className="text-primary">{p.maxBranches}</strong> branch(es)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Up to <strong className="text-primary">{p.maxEmployees}</strong> staff</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {p.hasFaceId ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-secondary opacity-40" />
                    )}
                    <span className={p.hasFaceId ? 'text-primary' : 'text-secondary'}>
                      Face ID Attendance
                    </span>
                  </li>
                </ul>
              </div>
            </GlassCard>
          ))}
        </div>
      </GlassCard>

      {/* Edit Quota Modal */}
      <GlassModal
        open={Boolean(isEditModalOpen && selectedOrg)}
        onClose={() => setIsEditModalOpen(false)}
        title="Override Tenant Quotas"
        description={selectedOrg?.name}
        size="md"
      >
        <div className="p-6 space-y-4">
          <GlassSelect
            label="Subscription Status"
            value={subStatus}
            onChange={(e) => setSubStatus(e.target.value)}
            options={[
              { label: 'ACTIVE', value: 'ACTIVE' },
              { label: 'TRIALING', value: 'TRIALING' },
              { label: 'PAST_DUE', value: 'PAST_DUE' },
              { label: 'SUSPENDED', value: 'SUSPENDED' },
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <GlassInput
              label="Max Students"
              type="number"
              value={maxStudents}
              onChange={(e) => setMaxStudents(Number(e.target.value))}
            />
            <GlassInput
              label="Max Branches"
              type="number"
              value={maxBranches}
              onChange={(e) => setMaxBranches(Number(e.target.value))}
            />
            <GlassInput
              label="Max Staff"
              type="number"
              value={maxEmployees}
              onChange={(e) => setMaxEmployees(Number(e.target.value))}
            />
          </div>

          <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFaceId}
                onChange={(e) => setHasFaceId(e.target.checked)}
                className="w-4 h-4 rounded border-black/20 dark:border-white/20 bg-white/5 text-purple-600"
              />
              <span className="text-xs text-primary font-medium">Enable Face ID Biometrics</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAiCopilot}
                onChange={(e) => setHasAiCopilot(e.target.checked)}
                className="w-4 h-4 rounded border-black/20 dark:border-white/20 bg-white/5 text-purple-600"
              />
              <span className="text-xs text-primary font-medium">Enable Gemini AI Copilot</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleSaveQuotas}
              loading={updateSubMutation.isPending}
            >
              Save Changes
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Invite Code Generation Modal */}
      <GlassModal
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Platform Invitation Code"
        size="md"
      >
        <div className="p-6 space-y-4">
          {generatedInvite ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
                <span className="text-xs text-purple-600 dark:text-purple-300 uppercase font-semibold">One-Time Onboarding Key</span>
                <div className="font-mono text-xl font-bold text-primary mt-1.5 select-all">
                  {generatedInvite.code}
                </div>
              </div>
              <GlassButton
                variant="primary"
                size="md"
                className="w-full"
                icon={<Copy className="w-4 h-4" />}
                onClick={() => {
                  navigator.clipboard.writeText(generatedInvite.code);
                  push('success', 'Invite code copied to clipboard');
                }}
              >
                Copy Code
              </GlassButton>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-secondary leading-relaxed">
                Generates a cryptographically secure 128-bit platform invite key allowing a new educational organization to register.
              </p>
              <GlassButton
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => {
                  const exp = new Date();
                  exp.setDate(exp.getDate() + 30);
                  createInviteMutation.mutate({
                    maxUses: 1,
                    expiresAt: exp.toISOString(),
                  });
                }}
                loading={createInviteMutation.isPending}
              >
                Generate New Code
              </GlassButton>
            </div>
          )}
        </div>
      </GlassModal>
    </div>
  );
}

export default SuperAdminPage;
