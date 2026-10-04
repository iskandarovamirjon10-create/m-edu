/**
 * Library and book borrowing domain models.
 */

import type { Student } from './students';

export interface LibraryBook {
  id: string;
  organizationId: string;
  title: string;
  author?: string;
  isbn?: string;
  barcode: string;
  category: string;
  quantity: number;
  availableQuantity: number;
  location?: string;
  publisher?: string;
  publishedYear?: number;
  language?: string;
  description?: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
}

export type BorrowStatus = 'BORROWED' | 'RETURNED' | 'OVERDUE';

export interface LibraryBorrow {
  id: string;
  organizationId: string;
  bookId: string;
  studentId: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  lateFee?: number;
  status: BorrowStatus;
  notes?: string;
  book?: LibraryBook;
  student?: Student;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryStats {
  totalBooks: number;
  totalBorrowed: number;
  totalOverdue: number;
  availableBooks: number;
}
