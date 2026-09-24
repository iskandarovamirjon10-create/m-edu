import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import {
  PageHeader,
  Badge,
  PageLoader,
  ErrorState,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Field,
  TextInput,
  Select,
  Modal,
  ConfirmDialog,
  useToasts,
  statusColor,
  GlassButton,
} from '@/components/ui';
import { fullName, formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, User, UserRole } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

// SUPER_ADMIN can only be minted by an existing SUPER_ADMIN (backend-enforced
// and enforced here in the UI so other roles never see a role they cannot use).
const ALL_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'MANAGER',
  'TEACHER',
  'ASSISTANT',
  'STUDENT',
];

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
}

const INITIAL_FORM: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'MANAGER',
};

function roleKey(role: string): string {
  return `users.role.${role}`;
}

function formatUserName(user: User): string {
  return fullName(user.firstName, user.lastName);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function UsersPage() {
  const { t } = useI18n();
  usePageTitle(t('users.title'));
  const { push, toastNode } = useToasts();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();

  // Available roles based on current user. Backend policy (UsersService):
  // only a SUPER_ADMIN may assign SUPER_ADMIN or ORG_ADMIN. Mirror it here so
  // the UI never offers a role that the server rejects with 403.
  const availableRoles = useMemo(
    () =>
      currentUser?.role === 'SUPER_ADMIN'
        ? ALL_ROLES
        : ALL_ROLES.filter((role) => role !== 'SUPER_ADMIN' && role !== 'ORG_ADMIN'),
    [currentUser?.role],
  );

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Form state
  const [form, setForm] = useState<UserFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof UserFormState, string>>
  >({});

  // Data fetching
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = users.data as Paginated<User> | undefined;
  const userList = useMemo(() => data?.items || [], [data]);

  // Create or update user mutation (password only sent on create)
  const create = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
        ...(editingId ? {} : { password: form.password || undefined }),
      };
      return editingId
        ? usersApi.update(editingId, payload)
        : usersApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('users.updated') : t('users.created'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Toggle active mutation
  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      usersApi.update(id, { isActive: active }),
    onSuccess: () => {
      push('success', t('users.statusUpdated'));
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Remove user mutation
  const removeUser = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      push('success', t('users.deleted'));
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof UserFormState, string>> = {};

    if (!form.firstName.trim()) {
      errors.firstName = t('users.validation.firstNameRequired');
    }
    if (!form.lastName.trim()) {
      errors.lastName = t('users.validation.lastNameRequired');
    }
    if (!form.email.trim()) {
      errors.email = t('users.validation.emailRequired');
    } else if (!validateEmail(form.email)) {
      errors.email = t('users.validation.emailInvalid');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof UserFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) {
        return;
      }
      create.mutate();
    },
    [validateForm, create],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((user: User) => {
    setEditingId(user.id);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      role: user.role,
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleToggleActive = useCallback(
    (user: User) => {
      toggleActive.mutate({ id: user.id, active: !user.isActive });
    },
    [toggleActive],
  );

  const handleDelete = useCallback((user: User) => {
    setDeleteTarget({ id: user.id, name: formatUserName(user) });
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    removeUser.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, removeUser]);

  const { refetch: refetchUsers } = users;
  const handleRetry = useCallback(() => {
    void refetchUsers();
  }, [refetchUsers]);

  // Early return for loading state
  if (users.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <PageHeader
            title={t('users.title')}
            subtitle={t('users.pageSubtitle')}
          />
          <div className="glass-card p-8">
            <PageLoader label={t('users.loading')} />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (users.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <PageHeader
            title={t('users.title')}
            subtitle={t('users.pageSubtitle')}
          />
          <div className="glass-card p-8">
            <ErrorState
              title={t('users.loadError')}
              message={getErrorMessage(users.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1"></div>
      <div className="orb orb-cyan-2"></div>
      <div className="orb orb-indigo-1"></div>
      <div className="orb orb-deep-1"></div>
    <div className="page-container space-y-4">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.pageSubtitle')}
        actions={
          <GlassButton
            type="button"
            variant="primary"
            onClick={handleOpenModal}
          >
            {t('users.add')}
          </GlassButton>
        }
      />

      {/* Users table */}
      <div className="glass-card overflow-hidden">
        {userList.length === 0 ? (
          <EmptyState
            title={t('users.emptyTitle')}
            message={t('users.emptyMessage')}
          />
        ) : (
          <div className="glass-table-wrap">
            <Table>
              <THead>
                <TR>
                  <TH>{t('common.name')}</TH>
                  <TH>{t('common.email')}</TH>
                  <TH>{t('users.col.role')}</TH>
                  <TH>{t('users.col.lastLogin')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH className="text-right">{t('common.actions')}</TH>
                </TR>
              </THead>
              <TBody>
                {userList.map((user) => {
                  const isToggling =
                    toggleActive.isPending &&
                    toggleActive.variables?.id === user.id;
                  const isDeleting =
                    removeUser.isPending && removeUser.variables === user.id;
                  const isCurrentUser = currentUser?.id === user.id;

                  return (
                    <TR
                      key={user.id}
                    >
                      <TD className="font-medium">
                        {formatUserName(user)}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-muted">
                            {t('users.you')}
                          </span>
                        )}
                      </TD>
                      <TD>{user.email}</TD>
                      <TD>
                        <Badge color={statusColor(user.role)}>
                          {t(roleKey(user.role))}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {formatDate(user.lastLoginAt)}
                      </TD>
                      <TD>
                        <Badge color={user.isActive ? 'green' : 'red'}>
                          {user.isActive ? t('users.status.ACTIVE') : t('users.status.INACTIVE')}
                        </Badge>
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <GlassButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user)}
                            disabled={isCurrentUser}
                            title={
                              isCurrentUser
                                ? t('users.cannotEditSelf')
                                : undefined
                            }
                          >
                            {t('common.edit')}
                          </GlassButton>
                          <GlassButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user)}
                            disabled={isToggling || isCurrentUser}
                            title={
                              isCurrentUser
                                ? t('users.cannotDeactivateSelf')
                                : undefined
                            }
                          >
                            {isToggling
                              ? t('users.updating')
                              : user.isActive
                                ? t('users.deactivate')
                                : t('users.activate')}
                          </GlassButton>
                          <GlassButton
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            disabled={isDeleting || isCurrentUser}
                            title={
                              isCurrentUser
                                ? t('users.cannotDeleteSelf')
                                : undefined
                            }
                          >
                            {isDeleting ? t('templates.deleting') : t('common.delete')}
                          </GlassButton>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add/edit user modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? t('users.editTitle') : t('users.add')}
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('users.form.firstName')} required error={formErrors.firstName}>
              <TextInput
                value={form.firstName}
                onChange={handleFormChange('firstName')}
                required
                aria-invalid={Boolean(formErrors.firstName)}
                aria-describedby={
                  formErrors.firstName ? 'firstname-error' : undefined
                }
                placeholder="John"
                disabled={create.isPending}
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

            <Field label={t('users.form.lastName')} required error={formErrors.lastName}>
              <TextInput
                value={form.lastName}
                onChange={handleFormChange('lastName')}
                required
                aria-invalid={Boolean(formErrors.lastName)}
                aria-describedby={
                  formErrors.lastName ? 'lastname-error' : undefined
                }
                placeholder="Doe"
                disabled={create.isPending}
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

            <Field label={t('common.email')} required error={formErrors.email}>
              <TextInput
                type="email"
                value={form.email}
                onChange={handleFormChange('email')}
                required
                aria-invalid={Boolean(formErrors.email)}
                aria-describedby={
                  formErrors.email ? 'email-error' : undefined
                }
                placeholder="john@example.com"
                disabled={create.isPending}
              />
              {formErrors.email && (
                <span id="email-error" className="mt-1 text-sm text-red-600">
                  {formErrors.email}
                </span>
              )}
            </Field>

            {!editingId && (
              <Field label={t('users.form.password')} hint={t('users.form.passwordHint')}>
                <TextInput
                  type="password"
                  value={form.password}
                  onChange={handleFormChange('password')}
                  autoComplete="new-password"
                  disabled={create.isPending}
                />
              </Field>
            )}

            <Field label={t('users.form.role')}>
              <Select
                value={form.role}
                onChange={handleFormChange('role')}
                aria-label={t('users.form.roleAria')}
                disabled={create.isPending}
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {t(roleKey(role))}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={create.isPending}
            >
              {create.isPending
                ? t('common.saving')
                : editingId
                  ? t('common.save')
                  : t('users.create')}
            </GlassButton>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={deleteTarget ? t('users.deleteConfirm', { name: deleteTarget.name }) : ''}
        loading={removeUser.isPending}
      />

      {toastNode}
    </div>
    </div>
  );
}