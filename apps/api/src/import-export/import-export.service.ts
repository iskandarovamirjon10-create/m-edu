import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQuery } from '../common/dto/query';

// ---------------------------------------------------------------------------
// Entity CSV templates
// ---------------------------------------------------------------------------

type CsvRow = Record<string, string>;

function s(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

const TEMPLATES: Record<string, string[]> = {
  STUDENT: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'parentName', 'parentPhone', 'enrollmentDate', 'isActive'],
  TEACHER: ['firstName', 'lastName', 'email', 'phone', 'specializations', 'experience', 'hourlyRate', 'bio'],
  GROUP: ['name', 'courseId', 'teacherId', 'capacity', 'room', 'startDate', 'endDate', 'isActive'],
  COURSE: ['name', 'description', 'duration', 'price', 'level', 'isActive'],
  PAYMENT: ['studentId', 'amount', 'dueDate', 'method', 'status', 'description'],
  EMPLOYEE: ['employeeNumber', 'department', 'position', 'hireDate', 'salary', 'contractType', 'isActive'],
  BOOK: ['title', 'author', 'isbn', 'quantity', 'available', 'category', 'description'],
  LEAD: ['firstName', 'lastName', 'email', 'phone', 'source', 'stage', 'notes'],
};

function toCsv(headers: string[], rows: CsvRow[]): string {
  const escape = (v: string) => {
    return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const headerLine = headers.join(',');
  const dataLines = rows.map(r => headers.map(h => escape(r[h] ?? '')).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface ImportListQuery extends PaginationQuery {
  status?: string;
}

export interface ExportListQuery extends PaginationQuery {
  entityType?: string;
  format?: string;
}

export interface StartImportDto {
  entityType: string;
  mode: 'CREATE' | 'UPSERT' | 'UPDATE';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ImportExportService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Imports -------------------------------------------------------------

  async listImports(orgId: string, _query: ImportListQuery) {
    // Mock — empty list for now; replace with real DB query when import-jobs table exists
    return { items: [], total: 0 };
  }

  async startImport(orgId: string, _dto: StartImportDto, _file: any) {
    const id = `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return { id, status: 'PENDING' as const, organizationId: orgId };
  }

  // ---- Exports -------------------------------------------------------------

  async listExports(orgId: string, _query: ExportListQuery) {
    // Mock — empty list for now
    return { items: [], total: 0 };
  }

  async downloadTemplate(orgId: string, entityType: string): Promise<Buffer> {
    const headers = TEMPLATES[entityType.toUpperCase()];
    if (!headers) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    const emptyRows: CsvRow[] = [];
    const csv = toCsv(headers, emptyRows);
    return Buffer.from(csv, 'utf-8');
  }

  async exportData(orgId: string, entityType: string, _format: string): Promise<Buffer> {
    const upper = entityType.toUpperCase();
    const headers = TEMPLATES[upper];
    if (!headers) throw new Error(`Unknown entity type: ${entityType}`);

    const rows = await this.queryEntityForExport(orgId, upper);
    return Buffer.from(toCsv(headers, rows), 'utf-8');
  }

  private async queryEntityForExport(orgId: string, entityType: string): Promise<CsvRow[]> {
    switch (entityType) {
      case 'STUDENT': {
        const students = await this.prisma.student.findMany({
          where: { organizationId: orgId },
          include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
        });
        return students.map(stu => ({
          firstName: s(stu.user?.firstName),
          lastName: s(stu.user?.lastName),
          email: s(stu.user?.email),
          phone: s(stu.user?.phone),
          dateOfBirth: s(stu.dateOfBirth),
          gender: s(stu.gender),
          address: s(stu.address),
          parentName: s(stu.parentName),
          parentPhone: s(stu.parentPhone),
          enrollmentDate: s(stu.createdAt),
          isActive: 'true',
        }));
      }
      case 'TEACHER': {
        const teachers = await this.prisma.teacher.findMany({
          where: { organizationId: orgId },
          include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
        });
        return teachers.map(t => ({
          firstName: s(t.user?.firstName),
          lastName: s(t.user?.lastName),
          email: s(t.user?.email),
          phone: s(t.user?.phone),
          specializations: s(t.specializations?.join('; ')),
          experience: s(t.experience),
          hourlyRate: s(t.hourlyRate),
          bio: s(t.bio),
        }));
      }
      case 'GROUP': {
        const groups = await this.prisma.group.findMany({ where: { organizationId: orgId } });
        return groups.map(g => ({
          name: s(g.name),
          courseId: s(g.courseId),
          teacherId: s(g.teacherId),
          capacity: s(g.capacity),
          room: s(g.room),
          startDate: s(g.startDate),
          endDate: s(g.endDate),
          isActive: g.isActive ? 'true' : 'false',
        }));
      }
      case 'COURSE': {
        const courses = await this.prisma.course.findMany({ where: { organizationId: orgId } });
        return courses.map(c => ({
          name: s(c.name),
          description: s(c.description),
          duration: s(c.duration),
          price: s(c.price),
          level: s(c.level),
          isActive: c.isActive ? 'true' : 'false',
        }));
      }
      case 'PAYMENT': {
        const payments = await this.prisma.payment.findMany({
          where: { organizationId: orgId },
          include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        });
        return payments.map(p => ({
          studentId: s(p.studentId),
          amount: s(p.amount),
          dueDate: s(p.dueDate),
          method: s(p.method),
          status: s(p.status),
          description: s(p.description),
        }));
      }
      case 'EMPLOYEE': {
        const employees = await this.prisma.employee.findMany({ where: { organizationId: orgId } });
        return employees.map(e => ({
          employeeNumber: s(e.employeeNumber),
          department: s(e.department),
          position: s(e.position),
          hireDate: s(e.hireDate),
          salary: s(e.salary),
          contractType: s(e.contractType),
          isActive: e.isActive ? 'true' : 'false',
        }));
      }
      case 'BOOK': {
        const books = await this.prisma.libraryBook.findMany({ where: { organizationId: orgId } });
        return books.map(b => ({
          title: s(b.title),
          author: s(b.author),
          isbn: s(b.isbn),
          quantity: s(b.quantity),
          available: s(b.available),
          category: s(b.category),
          description: s(b.description),
        }));
      }
      case 'LEAD': {
        const leads = await this.prisma.lead.findMany({ where: { organizationId: orgId } });
        return leads.map(l => ({
          firstName: s(l.firstName),
          lastName: s(l.lastName),
          email: s(l.email),
          phone: s(l.phone),
          source: s(l.source),
          stage: s(l.stage),
          notes: s(l.notes),
        }));
      }
      default:
        return [];
    }
  }
}
