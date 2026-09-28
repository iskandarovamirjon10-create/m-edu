import { toLocalISOString } from '../lib/format';
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi, usersApi } from '@/lib/api';
import { GlassPageHeader, GlassCard, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD, GlassModal, GlassSelect, GlassInput, GlassBadge, GlassButton, useToast } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Employee, ContractType, User } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

interface EmployeeFormState {
  userId: string;
  employeeNumber: string;
  position: string;
  department: string;
  contractType: ContractType | '';
  salary: string;
  hireDate: string;
  bankAccount: string;
  taxId: string;
}

const INITIAL_FORM: EmployeeFormState = {
  userId: '',
  employeeNumber: '',
  position: '',
  department: '',
  contractType: '',
  salary: '',
  hireDate: toLocalISOString(),
  bankAccount: '',
  taxId: '',
};

const CONTRACT_TYPES: ContractType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];

const CONTRACT_TYPE_LABEL_KEYS: Record<ContractType, string> = {
  FULL_TIME: 'hr.contractType.fullTime',
  PART_TIME: 'hr.contractType.partTime',
  CONTRACT: 'hr.contractType.contract',
  INTERN: 'hr.contractType.intern',
};

const DEPARTMENTS = [
  'Administration',
  'Teaching',
  'IT',
  'Finance',
  'Human Resources',
  'Marketing',
  'Operations',
  'Student Services',
];

const DEPARTMENT_LABEL_KEYS: Record<string, string> = {
  Administration: 'hr.department.administration',
  Teaching: 'hr.department.teaching',
  IT: 'hr.department.it',
  Finance: 'hr.department.finance',
  'Human Resources': 'hr.department.humanResources',
  Marketing: 'hr.department.marketing',
  Operations: 'hr.department.operations',
  'Student Services': 'hr.department.studentServices',
};

function validateEmployeeForm(
  form: EmployeeFormState,
  isEdit: boolean
): Partial<Record<keyof EmployeeFormState, string>> {
  const errors: Partial<Record<keyof EmployeeFormState, string>> = {};

  if (!isEdit) {
    if (!form.userId) errors.userId = 'hr.form.validation.userIdRequired';
    if (!form.employeeNumber.trim()) errors.employeeNumber = 'hr.form.validation.employeeNumberRequired';
    if (!form.hireDate) errors.hireDate = 'hr.form.validation.hireDateRequired';
    if (!form.contractType) errors.contractType = 'hr.form.validation.contractTypeRequired';
  }

  if (!form.position.trim()) errors.position = 'hr.form.validation.positionRequired';
  if (!form.department.trim()) errors.department = 'hr.form.validation.departmentRequired';
  if (!form.salary || isNaN(parseFloat(form.salary)) || parseFloat(form.salary) <= 0) {
    errors.salary = 'hr.form.validation.salaryInvalid';
  }

  return errors;
}

function getContractTypeBadge(type: ContractType): { variant: 'primary' | 'success' | 'warning' | 'muted'; labelKey: string } {
  const badges: Record<ContractType, { variant: 'primary' | 'success' | 'warning' | 'muted'; labelKey: string }> = {
    FULL_TIME: { variant: 'success', labelKey: CONTRACT_TYPE_LABEL_KEYS.FULL_TIME },
    PART_TIME: { variant: 'primary', labelKey: CONTRACT_TYPE_LABEL_KEYS.PART_TIME },
    CONTRACT: { variant: 'warning', labelKey: CONTRACT_TYPE_LABEL_KEYS.CONTRACT },
    INTERN: { variant: 'muted', labelKey: CONTRACT_TYPE_LABEL_KEYS.INTERN },
  };
  return badges[type] ?? { variant: 'muted', labelKey: '' };
}

function employeeName(emp: Employee): string {
  if (emp.user) {
    return [emp.user.firstName, emp.user.lastName].filter(Boolean).join(' ') || '—';
  }
  return emp.employeeNumber || emp.id.slice(0, 8);
}

function employeeEmail(emp: Employee): string {
  return emp.user?.email || '—';
}

export function HRPage() {
  const { t } = useI18n();
  usePageTitle(t('hr.title'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<EmployeeFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EmployeeFormState, string>>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [terminateTarget, setTerminateTarget] = useState<Employee | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [terminateError, setTerminateError] = useState<string | null>(null);

  const employees = useQuery({
    queryKey: ['hr-employees'],
    queryFn: () => hrApi.listEmployees({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const users = useQuery({
    queryKey: ['hr-users-for-employee'],
    queryFn: () => usersApi.list({ limit: 200 }) as Promise<Paginated<User>>,
    enabled: modalOpen && !editingId,
  });

  const data = employees.data as Paginated<Employee> | undefined;
  const employeeList = useMemo(() => data?.items || [], [data]);

  const userList = useMemo(
    () => (users.data as Paginated<User> | undefined)?.items || [],
    [users.data]
  );

  const filteredEmployees = useMemo(() => {
    let filtered = employeeList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((emp) => {
        const name = employeeName(emp).toLowerCase();
        const email = employeeEmail(emp).toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          (emp.position || '').toLowerCase().includes(q)
        );
      });
    }

    if (filterDepartment) {
      filtered = filtered.filter((emp) => emp.department === filterDepartment);
    }

    return filtered;
  }, [employeeList, searchQuery, filterDepartment]);

  // CreateEmployeeDto: userId, employeeNumber, department, position, hireDate, salary, contractType
  // UpdateEmployeeDto: department, position, salary, bankAccount, taxId only
  const saveEmployee = useMutation({
    mutationFn: () => {
      const base = {
        position: form.position.trim(),
        department: form.department.trim(),
        salary: parseFloat(form.salary),
        bankAccount: form.bankAccount.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
      };

      if (editingId) {
        return hrApi.updateEmployee(editingId, base);
      }
      return hrApi.createEmployee({
        ...base,
        userId: form.userId,
        employeeNumber: form.employeeNumber.trim(),
        hireDate: form.hireDate,
        contractType: form.contractType,
      });
    },
    onSuccess: () => {
      push('success', editingId ? t('hr.employeeUpdated') : t('hr.employeeCreated'));
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      closeModal();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  // Controller reads @Body('reason'); empty reason is rejected by service.
  const terminateEmployee = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      hrApi.terminateEmployee(id, { reason }),
    onSuccess: () => {
      push('success', t('hr.employeeTerminated'));
      setTerminateTarget(null);
      setTerminateReason('');
      setTerminateError(null);
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  const openModal = useCallback((employee?: Employee) => {
    if (employee) {
      setEditingId(employee.id);
      setForm({
        userId: employee.userId || '',
        employeeNumber: employee.employeeNumber || '',
        position: employee.position || '',
        department: employee.department || '',
        contractType: employee.contractType,
        salary: employee.salary?.toString() || '',
        hireDate: (employee.hireDate || '').split('T')[0],
        bankAccount: employee.bankAccount || '',
        taxId: employee.taxId || '',
      });
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(() => {
    const rawErrors = validateEmployeeForm(form, Boolean(editingId));
    const errors: Partial<Record<keyof EmployeeFormState, string>> = {};
    for (const [key, value] of Object.entries(rawErrors)) {
      if (value) errors[key as keyof EmployeeFormState] = t(value);
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveEmployee.mutate();
  }, [form, editingId, saveEmployee, t]);

  const handleTerminate = useCallback((employee: Employee) => {
    setTerminateTarget(employee);
    setTerminateReason('');
    setTerminateError(null);
  }, []);

  const confirmTerminate = useCallback(() => {
    if (!terminateTarget) return;
    if (!terminateReason.trim()) {
      setTerminateError(t('hr.terminationReasonRequired'));
      return;
    }
    terminateEmployee.mutate({ id: terminateTarget.id, reason: terminateReason.trim() });
  }, [terminateTarget, terminateReason, terminateEmployee, t]);

  if (employees.isLoading) {
    return <GlassPageLoader label={t('hr.loading')} />;
  }

  if (employees.isError) {
    return (
      <GlassErrorState
        message={getErrorMessage(employees.error)}
        onRetry={() => employees.refetch()}
      />
    );
  }

  return (
    <div className="page-container">
      
      {toastNode}

      <GlassPageHeader
        title={t('hr.title')}
        description={t('hr.subtitle')}
        actions={
          <GlassButton variant="primary" size="sm" onClick={() => openModal()}>
            {t('hr.addEmployee')}
          </GlassButton>
        }
      />

      <GlassCard padding="none">
        <div className="p-4 border-b border-[var(--border-subtle)] space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <GlassInput
                placeholder={t('hr.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <GlassSelect
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              options={[
                { value: '', label: t('hr.allDepartments') },
                ...DEPARTMENTS.map((dept) => ({
                  value: dept,
                  label: DEPARTMENT_LABEL_KEYS[dept] ? t(DEPARTMENT_LABEL_KEYS[dept]) : dept,
                })),
              ]}
              placeholder={t('hr.allDepartments')}
            />
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <GlassEmptyState
            title={searchQuery || filterDepartment ? t('hr.emptySearch') : t('hr.empty')}
            description={
              searchQuery || filterDepartment
                ? t('hr.emptySearchHint')
                : t('hr.emptyHint')
            }
            action={!searchQuery && !filterDepartment ? { label: t('hr.addEmployee'), onClick: () => openModal() } : undefined}
          />
        ) : (
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>{t('hr.col.name')}</GlassTH>
                <GlassTH>{t('common.email')}</GlassTH>
                <GlassTH>{t('hr.col.position')}</GlassTH>
                <GlassTH>{t('hr.col.department')}</GlassTH>
                <GlassTH>{t('hr.col.contract')}</GlassTH>
                <GlassTH>{t('hr.col.salary')}</GlassTH>
                <GlassTH>{t('hr.col.status')}</GlassTH>
                <GlassTH>{t('hr.col.actions')}</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {filteredEmployees.map((employee) => {
                const badge = getContractTypeBadge(employee.contractType);
                return (
                  <GlassTR key={employee.id}>
                    <GlassTD className="font-medium">{employeeName(employee)}</GlassTD>
                    <GlassTD>{employeeEmail(employee)}</GlassTD>
                    <GlassTD>{employee.position}</GlassTD>
                    <GlassTD>{employee.department || '—'}</GlassTD>
                    <GlassTD>
                      <GlassBadge variant={badge.variant}>{badge.labelKey ? t(badge.labelKey) : employee.contractType}</GlassBadge>
                    </GlassTD>
                    <GlassTD>{formatCurrency(employee.salary)}</GlassTD>
                    <GlassTD>
                      <GlassBadge variant={employee.isActive ? 'success' : 'error'}>
                        {employee.isActive ? t('common.active') : t('common.inactive')}
                      </GlassBadge>
                    </GlassTD>
                    <GlassTD>
                      <div className="flex gap-2">
                        <GlassButton variant="ghost" size="sm" onClick={() => openModal(employee)}>
                          {t('common.edit')}
                        </GlassButton>
                        {employee.isActive && (
                          <GlassButton
                            variant="danger"
                            size="sm"
                            onClick={() => handleTerminate(employee)}
                          >
                            {t('hr.terminate')}
                          </GlassButton>
                        )}
                      </div>
                    </GlassTD>
                  </GlassTR>
                );
              })}
            </GlassTBody>
          </GlassTable>
        )}
      </GlassCard>

      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('hr.editEmployee') : t('hr.addEmployee')}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>{t('common.cancel')}</GlassButton>
            <GlassButton variant="primary" size="sm" onClick={handleSubmit} disabled={saveEmployee.isPending}>
              {saveEmployee.isPending ? t('common.saving') : t('common.save')}
            </GlassButton>
          </>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {!editingId && (
            <>
              <GlassSelect
                label={t('hr.form.user')}
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                options={[
                  { value: '', label: users.isLoading ? t('hr.loadingUsers') : t('hr.selectUser') },
                  ...userList.map((u) => ({
                    value: u.id,
                    label: [u.firstName, u.lastName].filter(Boolean).join(' ') + (u.email ? ` — ${u.email}` : ''),
                  })),
                ]}
                placeholder={t('hr.selectUser')}
                error={formErrors.userId}
              />

              <GlassInput
                label={t('hr.form.employeeNumber')}
                value={form.employeeNumber}
                onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
                placeholder={t('hr.form.employeeNumberPlaceholder')}
                error={formErrors.employeeNumber}
              />
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label={t('hr.form.position')}
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder={t('hr.form.positionPlaceholder')}
              error={formErrors.position}
            />

            <GlassSelect
              label={t('hr.form.department')}
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              options={[
                { value: '', label: t('hr.selectDepartment') },
                ...DEPARTMENTS.map((dept) => ({
                  value: dept,
                  label: DEPARTMENT_LABEL_KEYS[dept] ? t(DEPARTMENT_LABEL_KEYS[dept]) : dept,
                })),
              ]}
              placeholder={t('hr.selectDepartment')}
              error={formErrors.department}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!editingId && (
              <GlassSelect
                label={t('hr.form.contractType')}
                value={form.contractType}
                onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}
                options={[
                  { value: '', label: t('hr.selectContractType') },
                  ...CONTRACT_TYPES.map((type) => ({ value: type, label: t(CONTRACT_TYPE_LABEL_KEYS[type]) })),
                ]}
                placeholder={t('hr.selectContractType')}
                error={formErrors.contractType}
              />
            )}

            <GlassInput
              label={t('hr.form.salary')}
              type="number"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
              placeholder="0.00"
              min="0"
              step="0.01"
              error={formErrors.salary}
            />
          </div>

          {!editingId && (
            <GlassInput
              label={t('hr.form.hireDate')}
              type="date"
              value={form.hireDate}
              onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              error={formErrors.hireDate}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label={t('hr.form.bankAccount')}
              value={form.bankAccount}
              onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              placeholder={t('hr.form.bankAccountPlaceholder')}
              error={formErrors.bankAccount}
            />

            <GlassInput
              label={t('hr.form.taxId')}
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder={t('hr.form.taxId')}
              error={formErrors.taxId}
            />
          </div>

          {editingId && (
            <p className="text-xs text-[var(--text-muted)]">
              {t('hr.editNotice')}
            </p>
          )}
        </div>
      </GlassModal>

      <GlassModal
        open={terminateTarget !== null}
        onClose={() => setTerminateTarget(null)}
        title={t('hr.terminate')}
        footer={
          <>
            <GlassButton
              variant="secondary"
              onClick={() => setTerminateTarget(null)}
              disabled={terminateEmployee.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              variant="danger"
              onClick={confirmTerminate}
              loading={terminateEmployee.isPending}
              disabled={terminateEmployee.isPending}
            >
              {terminateEmployee.isPending ? t('common.saving') : t('hr.terminate')}
            </GlassButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-primary)]">
            {t('hr.terminationPrompt', { name: terminateTarget ? employeeName(terminateTarget) : '' })}
          </p>
          <GlassInput
            label={t('hr.rejectModal.reasonLabel')}
            value={terminateReason}
            onChange={(e) => {
              setTerminateReason(e.target.value);
              if (terminateError) setTerminateError(null);
            }}
            placeholder={t('hr.rejectModal.reasonPlaceholder')}
            error={terminateError ?? undefined}
            autoFocus
          />
          <p className="text-xs text-[var(--text-muted)]">{t('hr.terminateConfirm')}</p>
        </div>
      </GlassModal>
    </div>
  );
}
