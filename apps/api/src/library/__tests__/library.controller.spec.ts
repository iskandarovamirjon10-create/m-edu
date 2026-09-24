import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LibraryController } from '../library.controller';
import { LibraryService } from '../library.service';

describe('LibraryController', () => {
  let controller: LibraryController;
  let service: LibraryService;

  const mockBook = {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 'org-1',
    title: 'Design Patterns',
    barcode: 'BC001',
    category: 'TECH',
  };

  beforeEach(() => {
    service = {
      findAllBooks: vi.fn().mockResolvedValue({ books: [mockBook], total: 1 }),
      searchBooks: vi.fn().mockResolvedValue([mockBook]),
      findBookById: vi.fn().mockResolvedValue(mockBook),
      createBook: vi.fn().mockResolvedValue(mockBook),
      updateBook: vi.fn().mockResolvedValue(mockBook),
      deleteBook: vi.fn().mockResolvedValue(mockBook),
      borrowBook: vi.fn().mockResolvedValue({ id: 'borrow-1' }),
      returnBook: vi.fn().mockResolvedValue({ id: 'borrow-1', status: 'RETURNED' }),
      getOverdueBooks: vi.fn().mockResolvedValue({ books: [], total: 0 }),
      getStudentBorrows: vi.fn().mockResolvedValue({ activeBorrows: [] }),
      getLibraryStats: vi.fn().mockResolvedValue({ totalBooks: 10 }),
    } as unknown as LibraryService;

    controller = new LibraryController(service);
  });

  it('should find all books', async () => {
    const result = await controller.findAllBooks({ organizationId: 'org-1' }, { page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(service.findAllBooks).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
  });

  it('should search books', async () => {
    const emptyResult = await controller.searchBooks({ organizationId: 'org-1' }, 'a');
    expect(emptyResult).toEqual([]);
    expect(service.searchBooks).not.toHaveBeenCalled();

    const result = await controller.searchBooks({ organizationId: 'org-1' }, 'design');
    expect(result).toHaveLength(1);
    expect(service.searchBooks).toHaveBeenCalledWith('org-1', 'design');
  });

  it('should find book by id', async () => {
    const result = await controller.findBookById({ organizationId: 'org-1' }, mockBook.id);
    expect(result).toEqual(mockBook);
    expect(service.findBookById).toHaveBeenCalledWith('org-1', mockBook.id);
  });

  it('should create book', async () => {
    const dto = { title: 'Design Patterns', barcode: 'BC001', category: 'TECH' };
    const result = await controller.createBook({ organizationId: 'org-1' }, dto);
    expect(result).toEqual(mockBook);
    expect(service.createBook).toHaveBeenCalledWith('org-1', dto);
  });

  it('should update book', async () => {
    const dto = { title: 'Design Patterns 2nd Ed' };
    const result = await controller.updateBook({ organizationId: 'org-1' }, mockBook.id, dto);
    expect(result).toEqual(mockBook);
    expect(service.updateBook).toHaveBeenCalledWith('org-1', mockBook.id, dto);
  });

  it('should delete book', async () => {
    const result = await controller.deleteBook({ organizationId: 'org-1' }, mockBook.id);
    expect(result).toEqual(mockBook);
    expect(service.deleteBook).toHaveBeenCalledWith('org-1', mockBook.id);
  });

  it('should borrow book', async () => {
    const dto = { bookId: mockBook.id, studentId: 'stu-1', dueDate: new Date().toISOString() };
    const result = await controller.borrowBook({ organizationId: 'org-1' }, dto);
    expect(result).toEqual({ id: 'borrow-1' });
    expect(service.borrowBook).toHaveBeenCalledWith('org-1', dto);
  });

  it('should return book', async () => {
    const result = await controller.returnBook({ organizationId: 'org-1' }, 'borrow-1', {});
    expect(result).toEqual({ id: 'borrow-1', status: 'RETURNED' });
    expect(service.returnBook).toHaveBeenCalledWith('org-1', 'borrow-1', {});
  });

  it('should get overdue books', async () => {
    const result = await controller.getOverdueBooks({ organizationId: 'org-1' }, { page: 1, limit: 10 });
    expect(result.total).toBe(0);
    expect(service.getOverdueBooks).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
  });

  it('should get student borrows', async () => {
    const result = await controller.getStudentBorrows({ organizationId: 'org-1' }, 'stu-1');
    expect(result).toHaveProperty('activeBorrows');
    expect(service.getStudentBorrows).toHaveBeenCalledWith('org-1', 'stu-1');
  });

  it('should get library stats', async () => {
    const result = await controller.getLibraryStats({ organizationId: 'org-1' });
    expect(result).toHaveProperty('totalBooks', 10);
    expect(service.getLibraryStats).toHaveBeenCalledWith('org-1');
  });
});
