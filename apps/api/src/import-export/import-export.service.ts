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

  async *streamEntityForExport(orgId: string, entityType: string): AsyncGenerator<CsvRow[]> {
    const CHUNK_SIZE = 5000;
    const s = (val: any) => (val === null || val === undefined ? "" : String(val));
    const fetchChunk = async (skip: number) => {
      switch (entityType) {
        case "STUDENT": {
          const students = await this.prisma.student.findMany({
            where: { organizationId: orgId },
            include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
            take: CHUNK_SIZE,
            orderBy: { id: 'asc' },
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
            isActive: "true",
          }));
        }
        case "TEACHER": {
          const teachers = await this.prisma.teacher.findMany({
            where: { organizationId: orgId },
            include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
            take: CHUNK_SIZE,
            orderBy: { id: 'asc' },
            skip,
          });
          return teachers.map(t => ({
            firstName: s(t.user?.firstName),
            lastName: s(t.user?.lastName),
            email: s(t.user?.email),
            phone: s(t.user?.phone),
            specializations: s(t.specializations?.join("; ")),
            experience: s(t.experience),
            hourlyRate: s(t.hourlyRate),
            bio: s(t.bio),
          }));
        }
        case "GROUP": {
          const groups = await this.prisma.group.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            orderBy: { id: 'asc' },
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
            isActive: g.isActive ? "true" : "false",
          }));
        }
        case "COURSE": {
          const courses = await this.prisma.course.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            orderBy: { id: 'asc' },
            skip,
          });
          return courses.map(c => ({
            name: s(c.name),
            description: s(c.description),
            duration: s(c.duration),
            price: s(c.price),
            level: s(c.level),
            isActive: c.isActive ? "true" : "false",
          }));
        }
        case "PAYMENT": {
          const payments = await this.prisma.payment.findMany({
            where: { organizationId: orgId },
            include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
            take: CHUNK_SIZE,
            orderBy: { id: 'asc' },
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
        case "EMPLOYEE": {
          const employees = await this.prisma.employee.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            orderBy: { id: 'asc' },
            skip,
          });
          return employees.map(e => ({
            employeeNumber: s(e.employeeNumber),
            department: s(e.department),
            position: s(e.position),
            hireDate: s(e.hireDate),
            salary: s(e.salary),
            contractType: s(e.contractType),
            isActive: e.isActive ? "true" : "false",
          }));
        }
        case "BOOK": {
          const books = await this.prisma.libraryBook.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            orderBy: { id: 'asc' },
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
        case "LEAD": {
          const leads = await this.prisma.lead.findMany({ 
            where: { organizationId: orgId },
            take: CHUNK_SIZE,
            orderBy: { id: 'asc' },
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
      if (chunk.length === 0) break;
      yield chunk;
      if (chunk.length < CHUNK_SIZE) break;
      skip += CHUNK_SIZE;
    }
  }

  async exportDataStream(orgId: string, entityType: string, format: string, res: any): Promise<void> {
    const upper = entityType.toUpperCase();
    const headers = TEMPLATES[upper];
    if (!headers) {
      res.status(400).send("Unknown entity type: " + entityType);
      return;
    }

    if (format === "xlsx" || format === "excel") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=\"" + entityType.toLowerCase() + "_export.xlsx\"");
      
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
      const sheet = workbook.addWorksheet(upper);
      
      sheet.addRow(headers);
      for await (const chunk of this.streamEntityForExport(orgId, upper)) {
        for (const row of chunk) {
          sheet.addRow(headers.map(h => row[h] || ""));
        }
        sheet.commit(); // Optional: clears memory for written rows
      }
      
      await workbook.commit();
      return;
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=\"" + entityType.toLowerCase() + "_export.pdf\"");

      const fonts = {
        NotoSans: {
            normal: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
            bold: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf'),
            italics: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
            bolditalics: require('path').join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf'),
          },
      };

      // pdfmake 0.3.x main export is the client API instance (createPdf),
      // not the legacy PdfPrinter constructor.
      const pdfmakeRaw = require("pdfmake");
      const pdfmake = pdfmakeRaw.default ?? pdfmakeRaw;
      pdfmake.setLocalAccessPolicy(() => true);
      pdfmake.setUrlAccessPolicy(() => false);
      pdfmake.setFonts(fonts);

      const allRows: any[] = [];
      for await (const chunk of this.streamEntityForExport(orgId, upper)) {
        allRows.push(...chunk);
        if (allRows.length > 5000) break; // Hard limit for PDF to avoid OOM
      }

      const tableBody: any[] = [];
      tableBody.push(headers.map(h => ({ text: h, style: "tableHeader" })));
      for (const row of allRows) {
        tableBody.push(headers.map(h => row[h] || ""));
      }

      const docDefinition = {
        pageOrientation: "landscape",
        content: [
          { text: entityType + " Export", style: "header" },
          {
            table: {
              headerRows: 1,
              body: tableBody,
            },
            layout: "lightHorizontalLines",
          },
        ],
        styles: {
          header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
          tableHeader: { bold: true, fontSize: 13, color: "black" },
        },
        defaultStyle: { font: "NotoSans", fontSize: 8 },
      };

      const doc = pdfmake.createPdf(docDefinition);
      const buffer: Buffer = await doc.getBuffer();
      res.end(buffer);
      return;
    }

    // Default to CSV stream
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + entityType.toLowerCase() + "_export.csv\"");
    
    // Write CSV header
    res.write(headers.map(h => "\"" + h + "\"").join(",") + "\n");
    
    // Write chunks
    for await (const chunk of this.streamEntityForExport(orgId, upper)) {
      let csvData = "";
      for (const row of chunk) {
        csvData += headers.map(h => "\"" + String(row[h] || "").replace(/"/g, '""') + "\"").join(",") + "\n";
      }
      res.write(csvData);
    }
    res.end();
  }

}

