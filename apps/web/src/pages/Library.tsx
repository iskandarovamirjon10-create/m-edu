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
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, LibraryBook } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

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

  if (!form.title.trim()) errors.title = 'Title is required';
  if (!form.barcode.trim()) errors.barcode = 'Barcode is required';
  if (!form.category.trim()) errors.category = 'Category is required';
  if (form.quantity && (isNaN(parseInt(form.quantity)) || parseInt(form.quantity) < 1)) {
    errors.quantity = 'Quantity must be at least 1';
  }

  return errors;
}

export function LibraryPage() {
  usePageTitle('Library');
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      push('success', editingId ? 'Book updated' : 'Book created');
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
      push('success', 'Book deleted');
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
    return <GlassPageLoader label="Loading library…" />;
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
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>
      {toastNode}

      <GlassPageHeader
        title="Library"
        description="Manage books and borrowing"
        actions={
          <GlassButton variant="primary" size="sm" onClick={() => openModal()}>
            Add Book
          </GlassButton>
        }
      />

      <GlassCard padding="none">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <GlassInput
            placeholder="Search books by title, author, ISBN, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {filteredBooks.length === 0 ? (
          <GlassEmptyState
            title={searchQuery ? 'No books found' : 'No books yet'}
            description={
              searchQuery
                ? 'Try adjusting your search criteria'
                : 'Create your first book to get started'
            }
            action={!searchQuery ? { label: 'Add Book', onClick: () => openModal() } : undefined}
          />
        ) : (
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>Title</GlassTH>
                <GlassTH>Author</GlassTH>
                <GlassTH>Category</GlassTH>
                <GlassTH>Barcode</GlassTH>
                <GlassTH>Quantity</GlassTH>
                <GlassTH>Available</GlassTH>
                <GlassTH>Actions</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {filteredBooks.map((book) => (
                <GlassTR key={book.id}>
                  <GlassTD className="font-medium">{book.title}</GlassTD>
                  <GlassTD>{book.author || '—'}</GlassTD>
                  <GlassTD>
                    <GlassBadge variant="azure">{book.category.replace(/_/g, ' ')}</GlassBadge>
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
                        Edit
                      </GlassButton>
                      <GlassButton
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (window.confirm('Delete this book?')) {
                            deleteBook.mutate(book.id);
                          }
                        }}
                      >
                        Delete
                      </GlassButton>
                    </div>
                  </GlassTD>
                </GlassTR>
              ))}
            </GlassTBody>
          </GlassTable>
        )}
      </GlassCard>

      {/* Book Form Modal */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Book' : 'Add Book'}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>Cancel</GlassButton>
            <GlassButton variant="primary" size="sm" onClick={handleSubmit} disabled={saveBook.isPending}>
              {saveBook.isPending ? 'Saving...' : 'Save'}
            </GlassButton>
          </>
        }
      >
        <div className="space-y-4">
          <GlassInput
            label="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Enter book title"
            error={formErrors.title}
          />

          <GlassInput
            label="Author"
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
            placeholder="Enter author name"
            error={formErrors.author}
          />

          <GlassInput
            label="ISBN"
            value={form.isbn}
            onChange={(e) => setForm({ ...form, isbn: e.target.value })}
            placeholder="Enter ISBN"
            error={formErrors.isbn}
          />

          <GlassInput
            label="Barcode *"
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            placeholder="Enter barcode"
            error={formErrors.barcode}
          />

          <GlassSelect
            label="Category *"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={[{ value: '', label: 'Select category' }, ...CATEGORIES.map((cat) => ({ value: cat, label: cat.replace(/_/g, ' ') }))]}
            placeholder="Select category"
            error={formErrors.category}
          />

          <GlassInput
            label="Quantity *"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            placeholder="1"
            min="1"
            error={formErrors.quantity}
          />

          <GlassInput
            label="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Enter location (e.g., Shelf A1)"
            error={formErrors.location}
          />

          <GlassInput
            label="Publisher"
            value={form.publisher}
            onChange={(e) => setForm({ ...form, publisher: e.target.value })}
            placeholder="Enter publisher"
            error={formErrors.publisher}
          />

          <GlassInput
            label="Published Year"
            type="number"
            value={form.publishedYear}
            onChange={(e) => setForm({ ...form, publishedYear: e.target.value })}
            placeholder="2024"
            min="1900"
            max={new Date().getFullYear()}
            error={formErrors.publishedYear}
          />

          <GlassInput
            label="Language"
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            placeholder="e.g., English"
            error={formErrors.language}
          />

          <GlassTextArea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Enter book description"
            rows={3}
            error={formErrors.description}
          />

          <GlassInput
            label="Cover Image URL"
            value={form.coverImage}
            onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
            placeholder="https://example.com/cover.jpg"
            error={formErrors.coverImage}
          />
        </div>
      </GlassModal>
    </div>
  );
}
