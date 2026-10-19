import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LibraryService } from '../library.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('LibraryService', () => {
  let service: LibraryService;
  let prisma: {
    libraryBook: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    libraryBorrow: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    student: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const mockBook = {
    id: 'book-1',
    organizationId: 'org-1',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    barcode: 'BC123',
    isbn: 'ISBN123',
    category: 'TECH',
    quantity: 5,
    available: 5,
  };

  const mockBorrow = {
    id: 'borrow-1',
    organizationId: 'org-1',
    bookId: 'book-1',
    studentId: 'student-1',
    dueDate: new Date(Date.now() + 86400000),
    status: 'ACTIVE',
    book: mockBook,
  };

  beforeEach(() => {
    prisma = {
      libraryBook: {
        findMany: vi.fn().mockResolvedValue([mockBook]),
        findFirst: vi.fn().mockResolvedValue(mockBook),
        create: vi.fn().mockResolvedValue(mockBook),
        update: vi.fn().mockResolvedValue(mockBook),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        delete: vi.fn().mockResolvedValue(mockBook),
        count: vi.fn().mockResolvedValue(1),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      libraryBorrow: {
        findMany: vi.fn().mockResolvedValue([mockBorrow]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(mockBorrow),
        update: vi.fn().mockResolvedValue({ ...mockBorrow, status: 'RETURNED' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ ...mockBorrow, status: 'RETURNED' }),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      student: {
        findFirst: vi.fn().mockResolvedValue({ id: 'student-1', organizationId: 'org-1' }),
      },
      // borrowBook takes a pessimistic row lock via $queryRaw inside the tx;
      // the callback receives this same mock, so the raw client must exist.
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    service = new LibraryService(prisma as unknown as PrismaService);
  });

  describe('findAllBooks', () => {
    it('should return paginated books', async () => {
      const result = await service.findAllBooks('org-1', { page: 1, limit: 10 });
      expect(result.books).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findBookById', () => {
    it('should return book if found', async () => {
      const result = await service.findBookById('org-1', 'book-1');
      expect(result).toEqual(mockBook);
    });

    it('should throw NotFoundException if missing', async () => {
      prisma.libraryBook.findFirst.mockResolvedValue(null);
      await expect(service.findBookById('org-1', 'book-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBook', () => {
    it('should create book when barcode is unique', async () => {
      prisma.libraryBook.findFirst.mockResolvedValue(null);
      const dto = { title: 'Refactoring', barcode: 'BC999', category: 'TECH' };
      const result = await service.createBook('org-1', dto);
      expect(result).toBeDefined();
      expect(prisma.libraryBook.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ barcode: 'BC999' }),
      });
    });

    it('should reject if barcode or isbn already exists', async () => {
      prisma.libraryBook.findFirst.mockResolvedValue(mockBook);
      const dto = { title: 'Duplicate', barcode: 'BC123', category: 'TECH' };
      await expect(service.createBook('org-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateBook', () => {
    it('should update book metadata', async () => {
      const result = await service.updateBook('org-1', 'book-1', { title: 'Clean Architecture' });
      expect(result).toBeDefined();
      expect(prisma.libraryBook.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: { title: 'Clean Architecture' },
      });
    });

    it('should reject setting quantity below active borrowed count', async () => {
      prisma.libraryBorrow.count.mockResolvedValue(4);
      await expect(service.updateBook('org-1', 'book-1', { quantity: 2 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteBook', () => {
    it('should delete book when not borrowed', async () => {
      prisma.libraryBorrow.count.mockResolvedValue(0);
      const result = await service.deleteBook('org-1', 'book-1');
      expect(result).toEqual(mockBook);
      expect(prisma.libraryBook.delete).toHaveBeenCalledWith({ where: { id: 'book-1' } });
    });

    it('should reject deleting book with active borrows', async () => {
      prisma.libraryBorrow.count.mockResolvedValue(2);
      await expect(service.deleteBook('org-1', 'book-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('borrowBook', () => {
    it('should allow borrowing an available book', async () => {
      const dto = { bookId: 'book-1', studentId: 'student-1', dueDate: new Date().toISOString() };
      const result = await service.borrowBook('org-1', dto);
      expect(result).toBeDefined();
      expect(prisma.libraryBook.updateMany).toHaveBeenCalledWith({
        where: { id: 'book-1', organizationId: 'org-1', available: { gte: 1 } },
        data: { available: { decrement: 1 } },
      });
    });

    it('should reject if student not found', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      const dto = { bookId: 'book-1', studentId: 'student-x', dueDate: new Date().toISOString() };
      await expect(service.borrowBook('org-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should reject if student has overdue books', async () => {
      prisma.libraryBorrow.count.mockResolvedValue(1);
      const dto = { bookId: 'book-1', studentId: 'student-1', dueDate: new Date().toISOString() };
      await expect(service.borrowBook('org-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject if book is out of stock', async () => {
      prisma.libraryBook.updateMany.mockResolvedValue({ count: 0 });
      const dto = { bookId: 'book-1', studentId: 'student-1', dueDate: new Date().toISOString() };
      await expect(service.borrowBook('org-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('returnBook', () => {
    it('should return book and increment available count', async () => {
      prisma.libraryBorrow.findFirst.mockResolvedValue(mockBorrow);
      const result = await service.returnBook('org-1', 'borrow-1', {});
      expect(result).toBeDefined();
      expect(prisma.libraryBook.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: { available: { increment: 1 } },
      });
    });

    it('should calculate late fee when returned overdue', async () => {
      const overdueBorrow = {
        ...mockBorrow,
        dueDate: new Date(Date.now() - 3 * 86400000), // 3 days ago
      };
      prisma.libraryBorrow.findFirst.mockResolvedValue(overdueBorrow);

      await service.returnBook('org-1', 'borrow-1', {});
      expect(prisma.libraryBorrow.updateMany).toHaveBeenCalledWith({
        where: { id: 'borrow-1', organizationId: 'org-1', status: 'ACTIVE' },
        data: expect.objectContaining({ lateFee: 15000 }),
      });
    });
  });

  describe('reports & search', () => {
    it('should get student borrow details', async () => {
      const result = await service.getStudentBorrows('org-1', 'student-1');
      expect(result.student).toBeDefined();
      expect(result.activeBorrows).toHaveLength(1);
    });

    it('should get overdue books', async () => {
      const result = await service.getOverdueBooks('org-1', { page: 1, limit: 10 });
      expect(result.books).toHaveLength(1);
    });

    it('should get library stats', async () => {
      const result = await service.getLibraryStats('org-1');
      expect(result).toHaveProperty('totalBooks');
      expect(result).toHaveProperty('activeBorrows');
    });

    it('should search books', async () => {
      const result = await service.searchBooks('org-1', 'clean');
      expect(result).toHaveLength(1);
    });
  });

  describe('DB-002: Tenant-scoped LibraryBook.barcode uniqueness and isolation', () => {
    it('rejects duplicate barcode within the same organization (intra-tenant rejection)', async () => {
      prisma.libraryBook.findFirst.mockResolvedValueOnce({
        id: 'book-existing',
        organizationId: 'org-1',
        barcode: 'BC-DUPLICATE',
      });

      await expect(
        service.createBook('org-1', {
          title: 'Duplicate Book',
          barcode: 'BC-DUPLICATE',
          category: 'FICTION',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows same barcode in a different organization (cross-tenant allow)', async () => {
      prisma.libraryBook.findFirst.mockImplementation(async ({ where }) => {
        if (where.organizationId === 'org-2' && where.OR?.some((cond: any) => cond.barcode === 'BC-SHARED')) {
          return null;
        }
        return { id: 'book-org1', organizationId: 'org-1', barcode: 'BC-SHARED' };
      });

      prisma.libraryBook.create.mockResolvedValueOnce({
        id: 'book-org2',
        organizationId: 'org-2',
        barcode: 'BC-SHARED',
        title: 'Org 2 Book',
        category: 'SCIENCE',
      });

      const result = await service.createBook('org-2', {
        title: 'Org 2 Book',
        barcode: 'BC-SHARED',
        category: 'SCIENCE',
      });

      expect(result).toBeDefined();
      expect(prisma.libraryBook.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-2',
          barcode: 'BC-SHARED',
        }),
      });
    });

    it('prohibits cross-tenant access to books belonging to another organization', async () => {
      prisma.libraryBook.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.findBookById('org-2', 'book-org-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.libraryBook.findFirst).toHaveBeenCalledWith({
        where: { id: 'book-org-1', organizationId: 'org-2' },
        include: expect.any(Object),
      });
    });

    it('converts Prisma P2002 duplicate constraint violation to BadRequestException on createBook', async () => {
      prisma.libraryBook.findFirst.mockResolvedValueOnce(null);
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target: ['organizationId', 'barcode'] },
      });
      prisma.libraryBook.create.mockRejectedValueOnce(p2002Error);

      await expect(
        service.createBook('org-1', {
          title: 'Concurrent Book',
          barcode: 'BC-RACE',
          category: 'TECH',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts Prisma P2002 duplicate constraint violation to BadRequestException on updateBook', async () => {
      prisma.libraryBook.findFirst
        .mockResolvedValueOnce({ id: 'book-1', organizationId: 'org-1' })
        .mockResolvedValueOnce(null);

      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target: ['organizationId', 'barcode'] },
      });
      prisma.libraryBook.update.mockRejectedValueOnce(p2002Error);

      await expect(
        service.updateBook('org-1', 'book-1', { barcode: 'BC-COLLIDE' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
