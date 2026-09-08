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
  useToasts,
  statusColor,
} from '@/components/ui';
import { fullName, formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, User, UserRole } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

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

function formatRole(role: UserRole): string {
  return role
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatUserName(user: User): string {
  return fullName(user.firstName, user.lastName);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function UsersPage() {
  usePageTitle('Users');
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

  // Create user mutation
  const create = useMutation({
    mutationFn: () =>
      usersApi.create({
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password || undefined,
      }),
    onSuccess: () => {
      push('success', 'User created successfully');
      setModalOpen(false);
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
      push('success', 'User status updated');
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
      push('success', 'User deleted successfully');
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
      errors.firstName = 'First name is required';
    }
    if (!form.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!form.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(form.email)) {
      errors.email = 'Please enter a valid email address';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

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
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleToggleActive = useCallback(
    (user: User) => {
      toggleActive.mutate({ id: user.id, active: !user.isActive });
    },
    [toggleActive],
  );

  const handleDelete = useCallback(
    (user: User) => {
      const userName = formatUserName(user);
      if (
        !window.confirm(
          `Permanently delete ${userName}?\n\nThis removes the account and revokes all sessions. Users with a Student/Teacher profile must be deactivated instead.`,
        )
      ) {
        return;
      }
      removeUser.mutate(user.id);
    },
    [removeUser],
  );

  const { refetch: refetchUsers } = users;
  const handleRetry = useCallback(() => {
    void refetchUsers();
  }, [refetchUsers]);

  // Early return for loading state
  if (users.isLoading && !data) {
    return (
      <div className="orb-container">
        <div className="page-container space-y-4">
          <PageHeader
            title="Users"
            subtitle="Manage organization users and roles"
          />
          <div className="glass-card p-8">
            <PageLoader label="Loading users…" />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (users.isError) {
    return (
      <div className="orb-container">
        <div className="page-container space-y-4">
          <PageHeader
            title="Users"
            subtitle="Manage organization users and roles"
          />
          <div className="glass-card p-8">
            <ErrorState
              title="Failed to load users"
              message={getErrorMessage(users.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1"></div>
      <div className="orb orb-cyan-2"></div>
      <div className="orb orb-indigo-1"></div>
      <div className="orb orb-deep-1"></div>
    <div className="page-container space-y-4">
      <PageHeader
        title="Users"
        subtitle="Manage organization users and roles"
        actions={
          <button
            type="button"
            className="glass-btn glass-btn-primary"
            onClick={handleOpenModal}
          >
            Add user
          </button>
        }
      />

      {/* Users table */}
      <div className="glass-card overflow-hidden">
        {userList.length === 0 ? (
          <EmptyState
            title="No users"
            message="Add team members to collaborate."
          />
        ) : (
          <div className="glass-table-wrap">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Last login</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
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
                            (you)
                          </span>
                        )}
                      </TD>
                      <TD>{user.email}</TD>
                      <TD>
                        <Badge color={statusColor(user.role)}>
                          {formatRole(user.role)}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {formatDate(user.lastLoginAt)}
                      </TD>
                      <TD>
                        <Badge color={user.isActive ? 'green' : 'red'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="glass-btn glass-btn-ghost glass-btn-sm"
                            onClick={() => handleToggleActive(user)}
                            disabled={isToggling || isCurrentUser}
                            title={
                              isCurrentUser
                                ? 'You cannot deactivate your own account'
                                : undefined
                            }
                          >
                            {isToggling
                              ? 'Updating…'
                              : user.isActive
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="glass-btn glass-btn-danger glass-btn-sm"
                            onClick={() => handleDelete(user)}
                            disabled={isDeleting || isCurrentUser}
                            title={
                              isCurrentUser
                                ? 'You cannot delete your own account'
                                : undefined
                            }
                          >
                            {isDeleting ? 'Deleting…' : 'Delete'}
                          </button>
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

      {/* Add user modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title="Add user"
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" required error={formErrors.firstName}>
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

            <Field label="Last name" required error={formErrors.lastName}>
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

            <Field label="Email" required error={formErrors.email}>
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

            <Field label="Password" hint="Optional for OAuth users.">
              <TextInput
                type="password"
                value={form.password}
                onChange={handleFormChange('password')}
                autoComplete="new-password"
                disabled={create.isPending}
              />
            </Field>

            <Field label="Role">
              <Select
                value={form.role}
                onChange={handleFormChange('role')}
                aria-label="Select user role"
                disabled={create.isPending}
              >
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="glass-btn glass-btn-secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="glass-btn glass-btn-primary"
              disabled={create.isPending}
            >
              {create.isPending ? 'Saving…' : 'Create user'}
            </button>
          </div>
        </form>
      </Modal>

      {toastNode}
    </div>
    </div>
  );
}