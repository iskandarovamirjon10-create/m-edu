import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, ErrorState, EmptyState, GlassButton, TextInput, Select, TextArea, GlassModal, Field } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { documentsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';

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
  { value: '', label: 'All categories' },
  { value: 'CONTRACT', label: 'Contracts' },
  { value: 'ID', label: 'ID Documents' },
  { value: 'CERTIFICATE', label: 'Certificates' },
  { value: 'REPORT', label: 'Reports' },
  { value: 'INVOICE', label: 'Invoices' },
  { value: 'POLICY', label: 'Policies' },
  { value: 'CURRICULUM', label: 'Curriculum' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'OTHER', label: 'Other' },
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
  usePageTitle('Documents');
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
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
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => toast.error('Could not delete document', getErrorMessage(e)),
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<CreateForm, 'tags'> & { tags: string[] }) => documentsApi.create(data),
    onSuccess: () => {
      toast.success('Document added');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const items: Document[] = (docsQuery.data as any)?.items ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!form.fileUrl.trim()) {
      setFormError('File URL is required — upload the file to your storage and paste its link.');
      return;
    }
    // Basic URL sanity so we don't create records with garbage links
    try {
      new URL(form.fileUrl.trim());
    } catch {
      setFormError('File URL must be a valid link starting with http:// or https://');
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
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <div className="flex items-start justify-between">
          <PageHeader
            title="Documents"
            subtitle="Centralised file management with versioning, tags, and entity links"
          />
          <GlassButton
            variant="primary"
            onClick={() => { setCreateOpen(true); setFormError(null); }}
          >
            Add document
          </GlassButton>
        </div>

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
              <TextInput
                placeholder="Search documents…"
                aria-label="Search documents"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
              />
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter by category"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div className="text-sm text-muted sm:ml-4 sm:shrink-0">
              {docsQuery.data ? `${docsQuery.data.total} documents` : '—'}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="glass-card overflow-hidden">
          {docsQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading documents…" /></div>
          ) : docsQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load documents"
                message={getErrorMessage(docsQuery.error)}
                onRetry={() => docsQuery.refetch()}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={search || category ? 'No matching documents' : 'No documents yet'}
                message={
                  search || category
                    ? 'Try a different search term or category filter.'
                    : 'Add contracts, IDs, certificates, and any other files here.'
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {items.map((doc) => (
                <li key={doc.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Badge color="primary">{doc.category}</Badge>
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
                      onClick={() => window.open(doc.fileUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Open
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </GlassButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <GlassModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setFormError(null); }}
        title="Add document"
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <Field label="Title" required>
            <TextInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Tuition contract — 2026"
              disabled={createMutation.isPending}
              autoFocus
            />
          </Field>
          <Field label="Description">
            <TextArea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
              disabled={createMutation.isPending}
              rows={2}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                disabled={createMutation.isPending}
              >
                {CREATE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="MIME type">
              <TextInput
                value={form.mimeType}
                onChange={(e) => setForm((f) => ({ ...f, mimeType: e.target.value }))}
                placeholder="application/pdf"
                disabled={createMutation.isPending}
              />
            </Field>
          </div>
          <Field label="File URL" required>
            <TextInput
              value={form.fileUrl}
              onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
              placeholder="https://storage.example.com/files/contract.pdf"
              disabled={createMutation.isPending}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="File size (bytes)">
              <TextInput
                type="number"
                min={0}
                value={form.fileSize || ''}
                onChange={(e) => setForm((f) => ({ ...f, fileSize: Number(e.target.value) || 0 }))}
                placeholder="0"
                disabled={createMutation.isPending}
              />
            </Field>
            <Field label="Tags" hint="Comma-separated">
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
              onClick={() => { setCreateOpen(false); setFormError(null); }}
              disabled={createMutation.isPending}
            >
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding…' : 'Add document'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
