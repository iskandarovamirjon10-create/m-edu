import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassCard,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassTD,
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassTextArea,
  GlassBadge,
  GlassButton,
  useToast,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Employee, ContractType } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface EmployeeFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  contractType: ContractType | '';
  salary: string;
  hireDate: string;
  emergencyContact: string;
  address: string;
  nationalId: string;
  bankAccount: string;
  taxId: string;
}

const INITIAL_FORM: EmployeeFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  contractType: '',
  salary: '',
  hireDate: new Date().toISOString().split('T')[0],
  emergencyContact: '',
  address: '',
  nationalId: '',
  bankAccount: '',
  taxId: '',
};

const CONTRACT_TYPES: ContractType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];

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

function validateEmployeeForm(form: EmployeeFormState): Partial<Record<keyof EmployeeFormState, string>> {
  const errors: Partial<Record<keyof EmployeeFormState, string>> = {};

  if (!form.firstName.trim()) errors.firstName = 'First name is required';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required';
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email format';
  if (!form.position.trim()) errors.position = 'Position is required';
  if (!form.contractType) errors.contractType = 'Contract type is required';
  if (!form.salary || isNaN(parseFloat(form.salary)) || parseFloat(form.salary) <= 0) {
    errors.salary = 'Valid salary is required';
  }
  if (!form.hireDate) errors.hireDate = 'Hire date is required';

  return errors;
}

function getContractTypeBadge(type: ContractType): { variant: 'primary' | 'success' | 'warning' | 'muted'; label: string } {
  const badges: Record<ContractType, { variant: 'primary' | 'success' | 'warning' | 'muted'; label: string }> = {
    FULL_TIME: { variant: 'success', label: 'Full Time' },
    PART_TIME: { variant: 'primary', label: 'Part Time' },
    CONTRACT: { variant: 'warning', label: 'Contract' },
    INTERN: { variant: 'muted', label: 'Intern' },
  };
  return badges[type];
}

export function HRPage() {
  usePageTitle('HR & Payroll');
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<EmployeeFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EmployeeFormState, string>>>({});

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  // Data fetching
  const employees = useQuery({
    queryKey: ['hr-employees'],
    queryFn: () => hrApi.listEmployees({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = employees.data as Paginated<Employee> | undefined;
  const employeeList = useMemo(() => data?.items || [], [data]);

  const filteredEmployees = useMemo(() => {
    let filtered = employeeList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.firstName.toLowerCase().includes(q) ||
          emp.lastName.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.position.toLowerCase().includes(q)
      );
    }

    if (filterDepartment) {
      filtered = filtered.filter((emp) => emp.department === filterDepartment);
    }

    return filtered;
  }, [employeeList, searchQuery, filterDepartment]);

  // Save employee mutation
  const saveEmployee = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        position: form.position.trim(),
        contractType: form.contractType,
        salary: parseFloat(form.salary),
        hireDate: form.hireDate,
      };

      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.department.trim()) payload.department = form.department.trim();
      if (form.emergencyContact.trim()) payload.emergencyContact = form.emergencyContact.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.nationalId.trim()) payload.nationalId = form.nationalId.trim();
      if (form.bankAccount.trim()) payload.bankAccount = form.bankAccount.trim();
      if (form.taxId.trim()) payload.taxId = form.taxId.trim();

      if (editingId) {
        return hrApi.updateEmployee(editingId, payload);
      } else {
        return hrApi.createEmployee(payload);
      }
    },
    onSuccess: () => {
      push('success', editingId ? 'Employee updated' : 'Employee created');
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      closeModal();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  // Terminate employee mutation
  const terminateEmployee = useMutation({
    mutationFn: (id: string) =>
      hrApi.terminateEmployee(id, { terminationDate: new Date().toISOString().split('T')[0] }),
    onSuccess: () => {
      push('success', 'Employee terminated');
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
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone || '',
        position: employee.position,
        department: employee.department || '',
        contractType: employee.contractType,
        salary: employee.salary.toString(),
        hireDate: employee.hireDate.split('T')[0],
        emergencyContact: employee.emergencyContact || '',
        address: employee.address || '',
        nationalId: employee.nationalId || '',
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
    const errors = validateEmployeeForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveEmployee.mutate();
  }, [form, saveEmployee]);

  if (employees.isLoading) {
    return <GlassPageLoader label="Loading employees…" />;
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
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>
      {toastNode}

      <GlassPageHeader
        title="HR & Payroll"
        description="Manage employees and payroll"
        actions={
          <GlassButton variant="primary" size="sm" onClick={() => openModal()}>
            Add Employee
          </GlassButton>
        }
      />

      <GlassCard padding="none">
        <div className="p-4 border-b border-[var(--border-subtle)] space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <GlassInput
                placeholder="Search employees by name, email, or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <GlassSelect
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              options={[{ value: '', label: 'All Departments' }, ...DEPARTMENTS.map((dept) => ({ value: dept, label: dept }))]}
              placeholder="All Departments"
            />
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <GlassEmptyState
            title={searchQuery || filterDepartment ? 'No employees found' : 'No employees yet'}
            description={
              searchQuery || filterDepartment
                ? 'Try adjusting your search criteria'
                : 'Add your first employee to get started'
            }
            action={!searchQuery && !filterDepartment ? { label: 'Add Employee', onClick: () => openModal() } : undefined}
          />
        ) : (
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>Name</GlassTH>
                <GlassTH>Email</GlassTH>
                <GlassTH>Position</GlassTH>
                <GlassTH>Department</GlassTH>
                <GlassTH>Contract</GlassTH>
                <GlassTH>Salary</GlassTH>
                <GlassTH>Status</GlassTH>
                <GlassTH>Actions</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {filteredEmployees.map((employee) => {
                const badge = getContractTypeBadge(employee.contractType);
                return (
                  <GlassTR key={employee.id}>
                    <GlassTD className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </GlassTD>
                    <GlassTD>{employee.email}</GlassTD>
                    <GlassTD>{employee.position}</GlassTD>
                    <GlassTD>{employee.department || '—'}</GlassTD>
                    <GlassTD>
                      <GlassBadge variant={badge.variant}>{badge.label}</GlassBadge>
                    </GlassTD>
                    <GlassTD>{formatCurrency(employee.salary)}</GlassTD>
                    <GlassTD>
                      <GlassBadge variant={employee.isActive ? 'success' : 'error'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </GlassBadge>
                    </GlassTD>
                    <GlassTD>
                      <div className="flex gap-2">
                        <GlassButton variant="ghost" size="sm" onClick={() => openModal(employee)}>
                          Edit
                        </GlassButton>
                        {employee.isActive && (
                          <GlassButton
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (window.confirm('Terminate this employee?')) {
                                terminateEmployee.mutate(employee.id);
                              }
                            }}
                          >
                            Terminate
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

      {/* Employee Form Modal */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Employee' : 'Add Employee'}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>Cancel</GlassButton>
            <GlassButton variant="primary" size="sm" onClick={handleSubmit} disabled={saveEmployee.isPending}>
              {saveEmployee.isPending ? 'Saving...' : 'Save'}
            </GlassButton>
          </>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="First Name *"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Enter first name"
              error={formErrors.firstName}
            />

            <GlassInput
              label="Last Name *"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Enter last name"
              error={formErrors.lastName}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Email *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              error={formErrors.email}
            />

            <GlassInput
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+998 90 123 45 67"
              error={formErrors.phone}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Position *"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="e.g., Senior Teacher"
              error={formErrors.position}
            />

            <GlassSelect
              label="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              options={[{ value: '', label: 'Select department' }, ...DEPARTMENTS.map((dept) => ({ value: dept, label: dept }))]}
              placeholder="Select department"
              error={formErrors.department}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <GlassSelect
              label="Contract Type *"
              value={form.contractType}
              onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}
              options={[{ value: '', label: 'Select type' }, ...CONTRACT_TYPES.map((type) => ({ value: type, label: type.replace(/_/g, ' ') }))]}
              placeholder="Select type"
              error={formErrors.contractType}
            />

            <GlassInput
              label="Salary *"
              type="number"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
              placeholder="0.00"
              min="0"
              step="0.01"
              error={formErrors.salary}
            />
          </div>

          <GlassInput
            label="Hire Date *"
            type="date"
            value={form.hireDate}
            onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
            error={formErrors.hireDate}
          />

          <GlassInput
            label="Emergency Contact"
            value={form.emergencyContact}
            onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
            placeholder="Contact name and phone"
            error={formErrors.emergencyContact}
          />

          <GlassTextArea
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Enter address"
            rows={2}
            error={formErrors.address}
          />

          <div className="grid grid-cols-3 gap-4">
            <GlassInput
              label="National ID"
              value={form.nationalId}
              onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              placeholder="ID number"
              error={formErrors.nationalId}
            />

            <GlassInput
              label="Bank Account"
              value={form.bankAccount}
              onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              placeholder="Account number"
              error={formErrors.bankAccount}
            />

            <GlassInput
              label="Tax ID"
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder="Tax ID"
              error={formErrors.taxId}
            />
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
