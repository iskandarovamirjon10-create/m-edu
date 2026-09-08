import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '@/lib/api';
import {
  PageHeader,
  PageLoader,
  ErrorState,
  Field,
  TextInput,
  Select,
  TextArea,
  useToasts,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Student } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface StudentFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  notes: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
}

const EMPTY_FORM: StudentFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  notes: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
};

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function StudentFormPage() {
  usePageTitle('Student');
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof StudentFormState, string>>
  >({});

  const existing = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id!),
    enabled: isEdit,
    placeholderData: (previousData) => previousData,
  });

  // Load existing student data when in edit mode
  useEffect(() => {
    if (isEdit && existing.data) {
      const student = existing.data as Student;
      setForm({
        firstName: student.user?.firstName || '',
        lastName: student.user?.lastName || '',
        email: student.user?.email || '',
        password: '',
        phone: student.user?.phone || '',
        dateOfBirth: student.dateOfBirth
          ? student.dateOfBirth.slice(0, 10)
          : '',
        gender: student.gender || '',
        address: student.address || '',
        notes: student.notes || '',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        parentEmail: student.parentEmail || '',
      });
    }
  }, [isEdit, existing.data]);

  const set = useCallback(
    <K extends keyof StudentFormState>(key: K, value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof StudentFormState, string>> = {};

    if (!form.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!form.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!isEdit && form.email && !validateEmail(form.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (form.parentEmail && !validateEmail(form.parentEmail)) {
      errors.parentEmail = 'Please enter a valid email address';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, isEdit]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        parentName: form.parentName.trim() || undefined,
        parentPhone: form.parentPhone.trim() || undefined,
        parentEmail: form.parentEmail.trim() || undefined,
      };

      if (!isEdit) {
        payload.email = form.email.trim() || undefined;
        payload.password = form.password || undefined;
        return studentsApi.create(payload);
      }
      return studentsApi.update(id!, payload);
    },
    onSuccess: (res) => {
      push('success', isEdit ? 'Student updated successfully' : 'Student created successfully');
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student', id] });
      navigate(`/students/${(res as Student).id}`, { replace: true });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) {
        return;
      }
      save.mutate();
    },
    [validateForm, save],
  );

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const { refetch: refetchExisting } = existing;
  const handleRetry = useCallback(() => {
    void refetchExisting();
  }, [refetchExisting]);

  // Early return for loading state (edit mode)
  if (isEdit && existing.isLoading && !existing.data) {
    return (
      <>
        <div className="orb-container" aria-hidden="true">
          <div className="orb orb-cyan-1" />
          <div className="orb orb-cyan-2" />
          <div className="orb orb-indigo-1" />
          <div className="orb orb-deep-1" />
        </div>
        <div className="page-container mx-auto max-w-3xl space-y-4">
          <PageHeader
            title="Edit student"
            subtitle="Student profile information"
          />
          <div className="glass-card p-8">
            <PageLoader label="Loading student…" />
          </div>
        </div>
      </>
    );
  }

  // Early return for error state (edit mode)
  if (isEdit && existing.isError) {
    return (
      <>
        <div className="orb-container" aria-hidden="true">
          <div className="orb orb-cyan-1" />
          <div className="orb orb-cyan-2" />
          <div className="orb orb-indigo-1" />
          <div className="orb orb-deep-1" />
        </div>
        <div className="page-container mx-auto max-w-3xl space-y-4">
          <PageHeader
            title="Edit student"
            subtitle="Student profile information"
          />
          <div className="glass-card p-8">
            <ErrorState
              title="Failed to load student"
              message={getErrorMessage(existing.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="orb-container" aria-hidden="true">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>
      <div className="page-container mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={isEdit ? 'Edit student' : 'Add student'}
        subtitle="Student profile information"
      />

      <div className="glass-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Student information
          </h2>
        </div>
        <div className="p-6">
          <form
            className="space-y-5"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" required error={formErrors.firstName}>
                <TextInput
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  required
                  aria-invalid={Boolean(formErrors.firstName)}
                  aria-describedby={
                    formErrors.firstName ? 'firstname-error' : undefined
                  }
                  placeholder="John"
                  disabled={save.isPending}
                />
                {formErrors.firstName && (
                  <span
                    id="firstname-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {formErrors.firstName}
                  </span>
                )}
              </Field>

              <Field label="Last name" required error={formErrors.lastName}>
                <TextInput
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  required
                  aria-invalid={Boolean(formErrors.lastName)}
                  aria-describedby={
                    formErrors.lastName ? 'lastname-error' : undefined
                  }
                  placeholder="Doe"
                  disabled={save.isPending}
                />
                {formErrors.lastName && (
                  <span
                    id="lastname-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {formErrors.lastName}
                  </span>
                )}
              </Field>

              {!isEdit && (
                <>
                  <Field
                    label="Email"
                    hint="Optional — used for login credentials."
                    error={formErrors.email}
                  >
                    <TextInput
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      aria-invalid={Boolean(formErrors.email)}
                      aria-describedby={
                        formErrors.email ? 'email-error' : undefined
                      }
                      placeholder="john@example.com"
                      disabled={save.isPending}
                    />
                    {formErrors.email && (
                      <span
                        id="email-error"
                        className="mt-1 text-sm text-red-600"
                      >
                        {formErrors.email}
                      </span>
                    )}
                  </Field>

                  <Field
                    label="Password"
                    hint="Optional — leave empty for no login."
                  >
                    <TextInput
                      type="password"
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      autoComplete="new-password"
                      disabled={save.isPending}
                    />
                  </Field>
                </>
              )}

              <Field label="Phone">
                <TextInput
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+998 90 123 4567"
                  disabled={save.isPending}
                />
              </Field>

              <Field label="Date of birth">
                <TextInput
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                  disabled={save.isPending}
                />
              </Field>

              <Field label="Gender">
                <Select
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  aria-label="Select gender"
                  disabled={save.isPending}
                >
                  <option value="">—</option>
                  {GENDERS.map((gender) => (
                    <option key={gender.value} value={gender.value}>
                      {gender.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Address">
                <TextInput
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Street, city"
                  disabled={save.isPending}
                />
              </Field>
            </div>

            <Field label="Notes">
              <TextArea
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Additional notes…"
                disabled={save.isPending}
              />
            </Field>

            {/* Parent/Guardian section */}
            <div className="border-t border-[var(--border-subtle)] pt-5">
              <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
                Parent / Guardian
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Parent name">
                  <TextInput
                    value={form.parentName}
                    onChange={(e) => set('parentName', e.target.value)}
                    placeholder="Jane Doe"
                    disabled={save.isPending}
                  />
                </Field>

                <Field label="Parent phone">
                  <TextInput
                    type="tel"
                    value={form.parentPhone}
                    onChange={(e) => set('parentPhone', e.target.value)}
                    placeholder="+998 90 123 4567"
                    disabled={save.isPending}
                  />
                </Field>

                <Field label="Parent email" error={formErrors.parentEmail}>
                  <TextInput
                    type="email"
                    value={form.parentEmail}
                    onChange={(e) => set('parentEmail', e.target.value)}
                    aria-invalid={Boolean(formErrors.parentEmail)}
                    aria-describedby={
                      formErrors.parentEmail ? 'parent-email-error' : undefined
                    }
                    placeholder="jane@example.com"
                    disabled={save.isPending}
                  />
                  {formErrors.parentEmail && (
                    <span
                      id="parent-email-error"
                      className="mt-1 text-sm text-red-600"
                    >
                      {formErrors.parentEmail}
                    </span>
                  )}
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                className="glass-btn-secondary"
                onClick={handleCancel}
                disabled={save.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="glass-btn-primary"
                disabled={save.isPending}
              >
                {save.isPending
                  ? 'Saving…'
                  : isEdit
                    ? 'Save changes'
                    : 'Create student'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {toastNode}
    </div>
    </>
  );
}