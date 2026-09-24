import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, ErrorState, EmptyState, GlassButton, TextInput, Select, TextArea, GlassModal, Field, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { documentsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  tags?: string[];
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  expiresAt?: string;
}

const CATEGORIES = [
  { value: '', labelKey: 'documents.category.all' },
  { value: 'CONTRACT', labelKey: 'documents.category.CONTRACT' },
  { value: 'ID', labelKey: 'documents.category.ID' },
  { value: 'CERTIFICATE', labelKey: 'documents.category.CERTIFICATE' },
  { value: 'REPORT', labelKey: 'documents.category.REPORT' },
  { value: 'INVOICE', labelKey: 'documents.category.INVOICE' },
  { value: 'POLICY', labelKey: 'documents.category.POLICY' },
  { value: 'CURRICULUM', labelKey: 'documents.category.CURRICULUM' },
  { value: 'MEDIA', labelKey: 'documents.category.MEDIA' },
  { value: 'OTHER', labelKey: 'documents.category.OTHER' },
];

// Categories available in the create modal (no "All")
const CREATE_CATEGORIES = CATEGORIES.filter((c) => c.value !== '');

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CreateForm {
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  tags: string;
}

const EMPTY_FORM: CreateForm = {
  title: '',
  description: '',
  category: 'OTHER',
  fileUrl: '',
  mimeType: 'application/octet-stream',
  fileSize: 0,
  tags: '',
};

export function DocumentsPage() {
  const { t } = useI18n();
  usePageTitle(t('documents.title'));
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const docsQuery = useQuery({
    queryKey: ['documents', search, category],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category) params.category = category;
      return documentsApi.list(params) as Promise<{ items: Document[]; total: number }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => {
      toast.success(t('documents.deleted'));
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast.error(t('documents.deleteFailed'), getErrorMessage(e)),
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<CreateForm, 'tags'> & { tags: string[] }) =>
      editingId
        ? documentsApi.update(editingId, data)
        : documentsApi.create(data),
    onSuccess: () => {
      toast.success(editingId ? t('documents.updated') : t('documents.added'));
      setCreateOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const items: Document[] = docsQuery.data?.items ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError(t('homework.titleRequired'));
      return;
    }
    if (!form.fileUrl.trim()) {
      setFormError(t('documents.fileUrlRequired'));
      return;
    }
    // Basic URL sanity so we don't create records with garbage links
    try {
      new URL(form.fileUrl.trim());
    } catch {
      setFormError(t('documents.fileUrlInvalid'));
      return;
    }
    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setFormError(null);
    const { tags: tagsCsv, ...rest } = form;
    void tagsCsv;
    createMutation.mutate({
      ...rest,
      title: form.title.trim(),
      fileUrl: form.fileUrl.trim(),
      tags,
    });
  };

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <div className="flex items-start justify-between">
          <PageHeader
            title={t('documents.title')}
            subtitle={t('documents.pageSubtitle')}
          />
          <GlassButton
            variant="primary"
            onClick={() => { setCreateOpen(true); setEditingId(null); setFormError(null); }}
          >
            {t('documents.add')}
          </GlassButton>
        </div>

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
              <TextInput
                placeholder={t('documents.searchPlaceholder')}
                aria-label={t('documents.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
              />
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label={t('documents.filterByCategory')}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </Select>
            </div>
            <div className="text-sm text-muted sm:ml-4 sm:shrink-0">
              {docsQuery.data ? t('documents.count', { n: docsQuery.data.total }) : '—'}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="glass-card overflow-hidden">
          {docsQuery.isLoading ? (
            <div className="p-8"><PageLoader label={t('documents.loading')} /></div>
          ) : docsQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title={t('documents.loadFailed')}
                message={getErrorMessage(docsQuery.error)}
                onRetry={() => docsQuery.refetch()}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={search || category ? t('documents.emptySearch') : t('documents.empty')}
                message={
                  search || category
                    ? t('documents.emptySearchMessage')
                    : t('documents.emptyMessage')
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {items.map((doc) => (
                <li key={doc.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Badge color="primary">{(() => { const k = `documents.category.${doc.category}`; const v = t(k); return v === k ? doc.category : v; })()}</Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">
                      {doc.title}
                    </h3>
                    {doc.description && (
                      <p className="text-xs text-muted mt-0.5 truncate">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted flex-wrap">
                      <span className="font-mono">v{doc.version}</span>
                      <span>·</span>
                      <span>{formatSize(doc.fileSize)}</span>
                      <span>·</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      {doc.tags && doc.tags.length > 0 && (
                        <>
                          <span>·</span>
                          {doc.tags.map((t) => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-[rgba(148,234,239,0.12)] text-[var(--m-vivid)]">{t}</span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex gap-2">
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(doc.id);
                        setForm({
                          title: doc.title,
                          description: doc.description || '',
                          category: doc.category,
                          fileUrl: doc.fileUrl,
                          mimeType: doc.mimeType,
                          fileSize: doc.fileSize,
                          tags: (doc.tags || []).join(', '),
                        });
                        setFormError(null);
                        setCreateOpen(true);
                      }}
                      disabled={createMutation.isPending}
                    >
                      {t('common.edit')}
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')}
                    >
                      {t('common.open')}
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                      disabled={deleteMutation.isPending}
                    >
                      {t('common.delete')}
                    </GlassButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        description={deleteTarget ? t('documents.deleteConfirm', { title: deleteTarget.title }) : ''}
        loading={deleteMutation.isPending}
      />

      <GlassModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditingId(null); setFormError(null); }}
        title={editingId ? t('documents.editTitle') : t('documents.add')}
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <Field label={t('documents.field.title')} required>
            <TextInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t('documents.titlePlaceholder')}
              disabled={createMutation.isPending}
              autoFocus
            />
          </Field>
          <Field label={t('documents.field.description')}>
            <TextArea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('common.optional')}
              disabled={createMutation.isPending}
              rows={2}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('documents.field.category')}>
              <Select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                disabled={createMutation.isPending}
              >
                {CREATE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('documents.field.mimeType')}>
              <TextInput
                value={form.mimeType}
                onChange={(e) => setForm((f) => ({ ...f, mimeType: e.target.value }))}
                placeholder="application/pdf"
                disabled={createMutation.isPending}
              />
            </Field>
          </div>
          <Field label={t('documents.field.fileUrl')} required>
            <TextInput
              value={form.fileUrl}
              onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
              placeholder="https://storage.example.com/files/contract.pdf"
              disabled={createMutation.isPending}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('documents.field.fileSize')}>
              <TextInput
                type="number"
                min={0}
                value={form.fileSize || ''}
                onChange={(e) => setForm((f) => ({ ...f, fileSize: Number(e.target.value) || 0 }))}
                placeholder="0"
                disabled={createMutation.isPending}
              />
            </Field>
            <Field label={t('documents.field.tags')} hint={t('documents.tagsHint')}>
              <TextInput
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="contract, 2026"
                disabled={createMutation.isPending}
              />
            </Field>
          </div>
          {formError && (
            <p className="text-sm text-[var(--state-error)]" role="alert">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => { setCreateOpen(false); setEditingId(null); setFormError(null); }}
              disabled={createMutation.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending
                ? t('common.saving')
                : editingId
                  ? t('common.save')
                  : t('documents.add')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
