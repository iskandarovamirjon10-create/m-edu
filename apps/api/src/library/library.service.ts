import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLibraryBookDto, UpdateLibraryBookDto } from './dto/create-library-book.dto';
import { BorrowBookDto, ReturnBookDto } from './dto/library-transaction.dto';
import { PaginationParams } from '../common/dto/pagination';
import { parsePagination } from '../lib/pagination';
import { BorrowStatus } from '@prisma/client';

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  // ===================== Book Management =====================

  async findAllBooks(organizationId: string, params: PaginationParams) {
    const { page, limit, search } = params;

    const where: any = { organizationId };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const { skip } = parsePagination(params);
    const pageVal = Math.max(1, parseInt(String(params?.page ?? ''), 10) || 1);
    const limitVal = Math.min(Math.max(1, parseInt(String(params?.limit ?? ''), 10) || 20), 100);

    const [books, total] = await Promise.all([
      this.prisma.libraryBook.findMany({
        where,
        skip,
        take: limitVal,
        orderBy: { createdAt: 'desc' },
        include: {
          borrowRecords: {
            where: { status: 'ACTIVE' as BorrowStatus },
            take: 1,
          },
        },
      }),
      this.prisma.libraryBook.count({ where }),
    ]);

    return {
      books,
      total,
      page: pageVal,
      limit: limitVal,
      totalPages: Math.ceil(total / limitVal),
    };
  }

  async findBookById(organizationId: string, id: string) {
    const book = await this.prisma.libraryBook.findUnique({
      where: { id, organizationId },
      include: {
        borrowRecords: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    return book;
  }

  async createBook(organizationId: string, dto: CreateLibraryBookDto) {
    // Check if barcode already exists
    const existingBook = await this.prisma.libraryBook.findFirst({
      where: {
        organizationId,
        OR: [
          { barcode: dto.barcode },
          { isbn: dto.isbn },
        ],
      },
    });

    if (existingBook) {
      throw new BadRequestException('Book with this barcode or ISBN already exists');
    }

    return this.prisma.libraryBook.create({
      data: {
        ...dto,
        organizationId,
        available: dto.quantity,
      },
    });
  }

  async updateBook(organizationId: string, id: string, dto: UpdateLibraryBookDto) {
    const book = await this.findBookById(organizationId, id);

    let updateData: any = { ...dto };
    if (dto.quantity !== undefined) {
      const borrowedCount = await this.prisma.libraryBorrow.count({
        where: {
          bookId: id,
          status: 'ACTIVE',
        },
      });

      if (dto.quantity < borrowedCount) {
        throw new BadRequestException(`Cannot set quantity lower than ${borrowedCount} (currently borrowed)`);
      }

      updateData.available = (dto.quantity ?? 0) - borrowedCount;
    }

    return this.prisma.libraryBook.update({
      where: { id, organizationId },
      data: updateData,
    });
  }

  async deleteBook(organizationId: string, id: string) {
    const book = await this.findBookById(organizationId, id);

    // Check if book is currently borrowed
    const activeBorrows = await this.prisma.libraryBorrow.count({
      where: {
        bookId: id,
        status: 'ACTIVE',
      },
    });

    if (activeBorrows > 0) {
      throw new BadRequestException(`Cannot delete book with ${activeBorrows} active borrow(s)`);
    }

    return this.prisma.libraryBook.delete({
      where: { id, organizationId },
    });
  }

  // ===================== Borrowing System =====================

  async borrowBook(organizationId: string, dto: BorrowBookDto) {
    const { bookId, studentId, dueDate } = dto;

    // Verify student belongs to this organization and is in valid state.
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, organizationId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Check overdue books (this read is safe because overdue is a property of
    // existing borrow records, not a quantity that could change unexpectedly).
    const overdueCount = await this.prisma.libraryBorrow.count({
      where: {
        studentId,
        organizationId,
        status: 'ACTIVE',
        dueDate: { lt: new Date() },
      },
    });

    if (overdueCount > 0) {
      throw new BadRequestException('Student has overdue books');
    }

    // Check for existing active borrow (read inside logical flow, not critical
    // for concurrency, but kept to prevent duplicate borrow attempts).
    const existingBorrow = await this.prisma.libraryBorrow.findFirst({
      where: {
        bookId,
        studentId,
        organizationId,
        status: 'ACTIVE',
      },
    });

    if (existingBorrow) {
      throw new BadRequestException('Student has already borrowed this book');
    }

    return this.prisma.$transaction(async (tx) => {
      // Atomic availability check with update. The WHERE clause enforces
      // both the tenant (organizationId) and the availability constraint
      // (available >= 1) in a single SQL statement — eliminates the
      // check-then-act race that existed when the check was done outside
      // the transaction.
      const updateResult = await tx.libraryBook.updateMany({
        where: {
          id: bookId,
          organizationId,
          available: { gte: 1 },
        },
        data: { available: { decrement: 1 } },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('Book is not available');
      }

      // Create borrow record only after the atomic availability decrement.
      const borrow = await tx.libraryBorrow.create({
        data: {
          organizationId,
          bookId,
          studentId,
          dueDate: new Date(dueDate),
          status: 'ACTIVE',
        },
      });

      return borrow;
    });
  }

  async returnBook(organizationId: string, borrowId: string, dto: ReturnBookDto) {
    const { condition } = dto;

    const borrow = await this.prisma.libraryBorrow.findFirst({
      where: {
        id: borrowId,
        organizationId,
        status: 'ACTIVE',
      },
      include: {
        book: true,
      },
    });

    if (!borrow) {
      throw new NotFoundException('Active borrow record not found');
    }

    const now = new Date();
    const isLate = now > borrow.dueDate;
    const lateDays = isLate ? Math.ceil((now.getTime() - borrow.dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const lateFee = isLate ? lateDays * 5000 : null; // 5000 UZS per day

    // Start transaction
    return this.prisma.$transaction(async (tx) => {
      // Update borrow record
      const updatedBorrow = await tx.libraryBorrow.update({
        where: { id: borrowId },
        data: {
          returnedAt: now,
          status: 'RETURNED',
          lateFee,
        },
      });

      // Update book availability
      await tx.libraryBook.update({
        where: { id: borrow.bookId },
        data: {
          available: { increment: 1 },
        },
      });

      // Update condition if book was damaged
      if (condition === 'damaged') {
        // Only decrement quantity/available if the book actually exists and has sufficient quantity
        const book = await tx.libraryBook.findUnique({ where: { id: borrow.bookId, organizationId } });
        if (book && book.quantity > 0) {
          await tx.libraryBook.update({
            where: { id: borrow.bookId, organizationId },
            data: {
              quantity: { decrement: 1 },
              available: Math.max(0, book.available - 1),
            },
          });
        }
      }

      return updatedBorrow;
    });
  }

  // ===================== Student & Reports =====================

  async getStudentBorrows(organizationId: string, studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, organizationId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const [activeBorrows, borrowHistory, overdueCount] = await Promise.all([
      this.prisma.libraryBorrow.findMany({
        where: {
          organizationId,
          studentId,
          status: 'ACTIVE',
        },
        include: {
          book: {
            select: {
              title: true,
              author: true,
              barcode: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.libraryBorrow.findMany({
        where: {
          organizationId,
          studentId,
          status: 'RETURNED',
        },
        include: {
          book: {
            select: {
              title: true,
              author: true,
            },
          },
        },
        orderBy: { returnedAt: 'desc' },
        take: 10,
      }),
      this.prisma.libraryBorrow.count({
        where: {
          organizationId,
          studentId,
          status: 'ACTIVE',
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      student,
      activeBorrows,
      borrowHistory,
      overdueCount,
    };
  }

  async getOverdueBooks(organizationId: string, params: PaginationParams) {
    const { skip } = parsePagination(params);
    const pageVal = Math.max(1, parseInt(String(params?.page ?? ''), 10) || 1);
    const limitVal = Math.min(Math.max(1, parseInt(String(params?.limit ?? ''), 10) || 20), 100);

    const where = {
      organizationId,
      status: 'ACTIVE' as BorrowStatus,
      dueDate: { lt: new Date() },
    };

    const [books, total] = await Promise.all([
      this.prisma.libraryBorrow.findMany({
        where,
        include: {
          book: {
            select: {
              title: true,
              author: true,
              barcode: true,
            },
          },
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
        skip,
        take: limitVal,
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.libraryBorrow.count({ where }),
    ]);

    return {
      books,
      total,
      page: pageVal,
      limit: limitVal,
      totalPages: Math.ceil(total / limitVal),
    };
  }

  async getLibraryStats(organizationId: string) {
    const [
      totalBooks,
      totalBorrows,
      activeBorrows,
      overdueBooks,
      mostBorrowedBooks,
      popularCategories,
    ] = await Promise.all([
      this.prisma.libraryBook.count({ where: { organizationId } }),
      this.prisma.libraryBorrow.count({ where: { organizationId } }),
      this.prisma.libraryBorrow.count({
        where: { organizationId, status: 'ACTIVE' },
      }),
      this.prisma.libraryBorrow.count({
        where: {
          organizationId,
          status: 'ACTIVE',
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.libraryBorrow.groupBy({
        by: ['bookId'],
        where: { organizationId },
        _count: { bookId: true },
        orderBy: { _count: { bookId: 'desc' } },
        take: 5,
      }).then(async (results) => {
        const bookIds = results.map((r) => r.bookId);
        const books = await this.prisma.libraryBook.findMany({
          where: { id: { in: bookIds } },
          select: { id: true, title: true, author: true },
        });

        return results.map((r) => ({
          book: books.find((b) => b.id === r.bookId),
          borrowCount: r._count.bookId,
        }));
      }),
      this.prisma.libraryBook.groupBy({
        by: ['category'],
        where: { organizationId },
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
      }),
    ]);

    return {
      totalBooks,
      totalBorrows,
      activeBorrows,
      overdueBooks,
      mostBorrowedBooks,
      popularCategories,
    };
  }

  // ===================== Search =====================

  async searchBooks(organizationId: string, query: string) {
    return this.prisma.libraryBook.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { author: { contains: query, mode: 'insensitive' } },
          { isbn: { contains: query } },
          { barcode: { contains: query } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        author: true,
        barcode: true,
        isbn: true,
        available: true,
        quantity: true,
        coverImage: true,
      },
      take: 20,
    });
  }
}
