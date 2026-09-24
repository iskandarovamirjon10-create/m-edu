import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { libraryApi } from '@/lib/api';
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
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, LibraryBook } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

interface BookFormState {
  title: string;
  author: string;
  isbn: string;
  barcode: string;
  category: string;
  quantity: string;
  location: string;
  publisher: string;
  publishedYear: string;
  language: string;
  description: string;
  coverImage: string;
}

const INITIAL_FORM: BookFormState = {
  title: '',
  author: '',
  isbn: '',
  barcode: '',
  category: '',
  quantity: '1',
  location: '',
  publisher: '',
  publishedYear: '',
  language: '',
  description: '',
  coverImage: '',
};

const CATEGORIES = [
  'FICTION',
  'NON_FICTION',
  'REFERENCE',
  'EDUCATIONAL',
  'SCIENCE',
  'HISTORY',
  'BIOGRAPHY',
  'TECHNOLOGY',
  'BUSINESS',
  'ART',
  'OTHER',
];

function validateBookForm(form: BookFormState): Partial<Record<keyof BookFormState, string>> {
  const errors: Partial<Record<keyof BookFormState, string>> = {};

  if (!form.title.trim()) errors.title = 'library.form.validation.titleRequired';
  if (!form.barcode.trim()) errors.barcode = 'library.form.validation.barcodeRequired';
  if (!form.category.trim()) errors.category = 'library.form.validation.categoryRequired';
  if (form.quantity && (isNaN(parseInt(form.quantity)) || parseInt(form.quantity) < 1)) {
    errors.quantity = 'library.form.validation.quantityMin';
  }

  return errors;
}

export function LibraryPage() {
  const { t } = useI18n();
  usePageTitle(t('library.title'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<BookFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof BookFormState, string>>>({});

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const books = useQuery({
    queryKey: ['library-books'],
    queryFn: () => libraryApi.listBooks({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = books.data as Paginated<LibraryBook> | undefined;
  const bookList = useMemo(() => data?.items || [], [data]);

  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return bookList;
    const q = searchQuery.toLowerCase();
    return bookList.filter(
      (book) =>
        book.title.toLowerCase().includes(q) ||
        book.author?.toLowerCase().includes(q) ||
        book.isbn?.toLowerCase().includes(q) ||
        book.barcode.toLowerCase().includes(q)
    );
  }, [bookList, searchQuery]);

  // Save book mutation
  const saveBook = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        barcode: form.barcode.trim(),
        category: form.category.trim(),
        quantity: form.quantity ? parseInt(form.quantity) : 1,
      };

      if (form.author.trim()) payload.author = form.author.trim();
      if (form.isbn.trim()) payload.isbn = form.isbn.trim();
      if (form.location.trim()) payload.location = form.location.trim();
      if (form.publisher.trim()) payload.publisher = form.publisher.trim();
      if (form.publishedYear) payload.publishedYear = parseInt(form.publishedYear);
      if (form.language.trim()) payload.language = form.language.trim();
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.coverImage.trim()) payload.coverImage = form.coverImage.trim();

      if (editingId) {
        return libraryApi.updateBook(editingId, payload);
      } else {
        return libraryApi.createBook(payload);
      }
    },
    onSuccess: () => {
      push('success', editingId ? t('library.bookUpdated') : t('library.bookCreated'));
      qc.invalidateQueries({ queryKey: ['library-books'] });
      closeModal();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  // Delete book mutation
  const deleteBook = useMutation({
    mutationFn: (id: string) => libraryApi.deleteBook(id),
    onSuccess: () => {
      push('success', t('library.bookDeleted'));
      qc.invalidateQueries({ queryKey: ['library-books'] });
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  const openModal = useCallback((book?: LibraryBook) => {
    if (book) {
      setEditingId(book.id);
      setForm({
        title: book.title,
        author: book.author || '',
        isbn: book.isbn || '',
        barcode: book.barcode,
        category: book.category,
        quantity: book.quantity.toString(),
        location: book.location || '',
        publisher: book.publisher || '',
        publishedYear: book.publishedYear?.toString() || '',
        language: book.language || '',
        description: book.description || '',
        coverImage: book.coverImage || '',
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
    const errors = validateBookForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveBook.mutate();
  }, [form, saveBook]);

  if (books.isLoading) {
    return <GlassPageLoader label={t('library.loading')} />;
  }

  if (books.isError) {
    return (
      <GlassErrorState
        message={getErrorMessage(books.error)}
        onRetry={() => books.refetch()}
      />
    );
  }

  return (
    <div className="page-container">
      
      {toastNode}

      <GlassPageHeader
        title={t('library.title')}
        description={t('library.pageDescription')}
        actions={
          <GlassButton variant="primary" size="sm" onClick={() => openModal()}>
            {t('library.addBook')}
          </GlassButton>
        }
      />

      <GlassCard padding="none">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <GlassInput
            placeholder={t('library.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {filteredBooks.length === 0 ? (
          <GlassEmptyState
            title={searchQuery ? t('library.emptySearch') : t('library.empty')}
            description={
              searchQuery
                ? t('certificates.emptySearchHint')
                : t('library.emptyMessage')
            }
            action={!searchQuery ? { label: t('library.addBook'), onClick: () => openModal() } : undefined}
          />
        ) : (
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>{t('library.col.title')}</GlassTH>
                <GlassTH>{t('library.form.author')}</GlassTH>
                <GlassTH>{t('library.col.category')}</GlassTH>
                <GlassTH>{t('library.col.barcode')}</GlassTH>
                <GlassTH>{t('library.col.quantity')}</GlassTH>
                <GlassTH>{t('library.col.available')}</GlassTH>
                <GlassTH>{t('common.actions')}</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {filteredBooks.map((book) => (
                <GlassTR key={book.id}>
                  <GlassTD className="font-medium">{book.title}</GlassTD>
                  <GlassTD>{book.author || '—'}</GlassTD>
                  <GlassTD>
                    <GlassBadge variant="azure">{(() => { const k = `library.category.${book.category}`; const v = t(k); return v === k ? book.category.replace(/_/g, ' ') : v; })()}</GlassBadge>
                  </GlassTD>
                  <GlassTD className="font-mono text-sm">{book.barcode}</GlassTD>
                  <GlassTD>{book.quantity}</GlassTD>
                  <GlassTD>
                    <GlassBadge variant={book.availableQuantity > 0 ? 'success' : 'error'}>
                      {book.availableQuantity}
                    </GlassBadge>
                  </GlassTD>
                  <GlassTD>
                    <div className="flex gap-2">
                      <GlassButton variant="ghost" size="sm" onClick={() => openModal(book)}>
                        {t('common.edit')}
                      </GlassButton>
                      <GlassButton
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(book.id)}
                      >
                        {t('common.delete')}
                      </GlassButton>
                    </div>
                  </GlassTD>
                </GlassTR>
              ))}
            </GlassTBody>
          </GlassTable>
        )}
      </GlassCard>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteBook.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        description={t('library.confirmDelete')}
        loading={deleteBook.isPending}
      />

      {/* Book Form Modal */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('library.editBook') : t('library.addBook')}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>{t('common.cancel')}</GlassButton>
            <GlassButton variant="primary" size="sm" onClick={handleSubmit} disabled={saveBook.isPending}>
              {saveBook.isPending ? t('common.saving') : t('common.save')}
            </GlassButton>
          </>
        }
      >
        <div className="space-y-4">
          <GlassInput
            label={t('library.form.title')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('library.form.titlePlaceholder')}
            error={formErrors.title ? t(formErrors.title) : undefined}
          />

          <GlassInput
            label={t('library.form.author')}
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
            placeholder={t('library.form.authorPlaceholder')}
            error={formErrors.author ? t(formErrors.author) : undefined}
          />

          <GlassInput
            label={t('library.form.isbn')}
            value={form.isbn}
            onChange={(e) => setForm({ ...form, isbn: e.target.value })}
            placeholder={t('library.form.isbnPlaceholder')}
            error={formErrors.isbn ? t(formErrors.isbn) : undefined}
          />

          <GlassInput
            label={t('library.form.barcode')}
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            placeholder={t('library.form.barcodePlaceholder')}
            error={formErrors.barcode ? t(formErrors.barcode) : undefined}
          />

          <GlassSelect
            label={t('library.form.category')}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={[{ value: '', label: t('library.form.selectCategory') }, ...CATEGORIES.map((cat) => ({ value: cat, label: t(`library.category.${cat}`) }))]}
            placeholder={t('library.form.selectCategory')}
            error={formErrors.category ? t(formErrors.category) : undefined}
          />

          <GlassInput
            label={t('library.form.quantity')}
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            placeholder="1"
            min="1"
            error={formErrors.quantity ? t(formErrors.quantity) : undefined}
          />

          <GlassInput
            label={t('library.form.location')}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder={t('library.form.locationPlaceholder')}
            error={formErrors.location ? t(formErrors.location) : undefined}
          />

          <GlassInput
            label={t('library.form.publisher')}
            value={form.publisher}
            onChange={(e) => setForm({ ...form, publisher: e.target.value })}
            placeholder={t('library.form.publisherPlaceholder')}
            error={formErrors.publisher ? t(formErrors.publisher) : undefined}
          />

          <GlassInput
            label={t('library.form.publishedYear')}
            type="number"
            value={form.publishedYear}
            onChange={(e) => setForm({ ...form, publishedYear: e.target.value })}
            placeholder="2024"
            min="1900"
            max={new Date().getFullYear()}
            error={formErrors.publishedYear ? t(formErrors.publishedYear) : undefined}
          />

          <GlassInput
            label={t('library.form.language')}
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            placeholder={t('library.form.languagePlaceholder')}
            error={formErrors.language ? t(formErrors.language) : undefined}
          />

          <GlassTextArea
            label={t('library.form.description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('library.form.descriptionPlaceholder')}
            rows={3}
            error={formErrors.description ? t(formErrors.description) : undefined}
          />

          <GlassInput
            label={t('library.form.coverImage')}
            value={form.coverImage}
            onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
            placeholder={t('library.form.coverPlaceholder')}
            error={formErrors.coverImage ? t(formErrors.coverImage) : undefined}
          />
        </div>
      </GlassModal>
    </div>
  );
}
