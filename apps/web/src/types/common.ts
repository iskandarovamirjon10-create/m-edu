/**
 * Common shared utility types and pagination wrappers across M-EDU frontend.
 */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
