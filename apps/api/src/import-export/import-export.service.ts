import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQuery } from '../common/dto/query';
import * as ExcelJS from 'exceljs';

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
    let val = v;
    if (/^[=+\-@\t\r]/.test(val)) val = "'" + val; // FIX: Prevent CSV formula injection (CWE-1236)
    return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
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

  async listImports(_orgId: string, _query: ImportListQuery) {
    // Mock — empty list for now; replace with real DB query when import-jobs table exists
    return { items: [], total: 0 };
  }

  async startImport(orgId: string, _dto: StartImportDto, _file?: Express.Multer.File | unknown) {
    throw new BadRequestException(
      'Data import is not yet available. This feature is under development. ' +
      'Please use the template download and manual data entry in the meantime.',
    );
  }

  // ---- Exports -------------------------------------------------------------

  async listExports(_orgId: string, _query: ExportListQuery) {
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

  async exportData(orgId: string, entityType: string, format: string): Promise<Buffer> {
    const upper = entityType.toUpperCase();
    const headers = TEMPLATES[upper];
    if (!headers) throw new Error(`Unknown entity type: ${entityType}`);

    const rows = await this.queryEntityForExport(orgId, upper);

    if (format === 'xlsx' || format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(upper);
      
      sheet.addRow(headers);
      for (const row of rows) {
        sheet.addRow(headers.map(h => row[h] || ''));
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }

    if (format === 'pdf') {
            const fonts = {
        Roboto: {
          normal: require.resolve('pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
          bold: require.resolve('pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
          italics: require.resolve('pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
          bolditalics: require.resolve('pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf'),
        },
      };
      // Case-sensitive package path: the installed file is js/Printer.js
      // (capital P). Windows is case-insensitive; Linux/Docker is not.
      const PdfPrinterReq = require('pdfmake/js/Printer');
      const PdfPrinterClass = PdfPrinterReq.default || PdfPrinterReq;
      const URLResolverReq = require('pdfmake/js/URLResolver');
      const URLResolverClass = URLResolverReq.default || URLResolverReq;
      const printer = new PdfPrinterClass(fonts, null, new URLResolverClass());
      
      const body = [headers];
      for (const row of rows) {
        body.push(headers.map(h => row[h] || ''));
      }

      const docDefinition = {
        defaultStyle: { font: 'Roboto' },
        content: [
          { text: `${upper} Export`, style: 'header' },
          {
            table: {
              headerRows: 1,
              body,
            }
          }
        ],
        styles: {
          header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] }
        }
      };

      const pdfDoc = await printer.createPdfKitDocument(docDefinition as unknown as Record<string, unknown>);
      return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);
        pdfDoc.end();
      });
    }

    return Buffer.from(toCsv(headers, rows), 'utf-8');
  }

  private async queryEntityForExport(orgId: string, entityType: string): Promise<CsvRow[]> {
    const MAX_EXPORT_LIMIT = 50000;
    const CHUNK_SIZE = 5000;
    const allRows: CsvRow[] = [];

    const fetchChunk = async (skip: number) => {
      switch (entityType) {
        case 'STUDENT': {
          const students = await this.prisma.student.findMany({
            where: { organizationId: orgId },
            include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
            take: CHUNK_SIZE,
            skip,
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
            take: CHUNK_SIZE,
            skip,
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
          const groups = await this.prisma.group.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            skip,
          });
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
          const courses = await this.prisma.course.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            skip,
          });
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
            take: CHUNK_SIZE,
            skip,
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
          const employees = await this.prisma.employee.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            skip,
          });
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
          const books = await this.prisma.libraryBook.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            skip,
          });
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
          const leads = await this.prisma.lead.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            skip,
          });
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
    };

    let skip = 0;
    while (true) {
      const chunk = await fetchChunk(skip);
      // A short chunk means the source is exhausted; an empty one is the
      // degenerate case of that. Both end the loop, so a page that returns
      // fewer rows than requested can never spin the exporter forever.
      if (chunk.length < CHUNK_SIZE) {
        allRows.push(...chunk);
        break;
      }

      allRows.push(...chunk);
      skip += CHUNK_SIZE;

      // Prevent OOM by capping maximum export rows
      if (allRows.length >= MAX_EXPORT_LIMIT) {
        break;
      }
    }

    return allRows;
  }
}


