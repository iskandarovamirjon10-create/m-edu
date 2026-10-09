import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
    // Return recent activity summary
    return { items: [], total: 0 };
  }

  async startImport(orgId: string, dto: StartImportDto, rawFile?: any) {
    const file = rawFile as { buffer?: Buffer; originalname?: string; mimetype?: string } | undefined;
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Import file is required and must not be empty');
    }

    const entityType = (dto.entityType || 'STUDENT').toUpperCase();
    const filename = (file.originalname || '').toLowerCase();
    const isExcel = filename.endsWith('.xlsx') || filename.endsWith('.xls') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const rawRows: Record<string, string>[] = [];

    if (isExcel) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer as any);
      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount < 2) {
        throw new BadRequestException('Excel file is empty or missing data rows');
      }

      let headers: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        const values = row.values as unknown[];
        if (rowNumber === 1) {
          headers = (Array.isArray(values) ? values.slice(1) : []).map(v => String(v ?? '').trim());
        } else if (headers.length > 0) {
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            const val = Array.isArray(values) ? values[idx + 1] : undefined;
            rowObj[h] = val !== undefined && val !== null ? String(val).trim() : '';
          });
          rawRows.push(rowObj);
        }
      });
    } else {
      // CSV parser
      const content = file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
      const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        throw new BadRequestException('CSV file must have at least a header row and one data row');
      }

      const parseCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = parseCsvLine(lines[0]);
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] ?? '';
        });
        rawRows.push(rowObj);
      }
    }

    if (rawRows.length === 0) {
      throw new BadRequestException('No valid rows found in the uploaded file');
    }

    // Helper to normalize keys across EN, UZ, and RU
    const normalizeKey = (key: string): string => {
      const k = key.toLowerCase().replace(/[\s_-]+/g, '');
      if (['firstname', 'first', 'ism', 'имя'].includes(k)) return 'firstName';
      if (['lastname', 'last', 'familiya', 'фамилия'].includes(k)) return 'lastName';
      if (['phone', 'tel', 'telefon', 'телефон', 'phonenumber'].includes(k)) return 'phone';
      if (['email', 'pochta', 'почта', 'mail'].includes(k)) return 'email';
      if (['parentname', 'parent', 'otaonasi', 'otaona', 'родитель'].includes(k)) return 'parentName';
      if (['parentphone', 'parenttel', 'otaonatel', 'телефонродителя'].includes(k)) return 'parentPhone';
      if (['parentemail', 'otaonapochta'].includes(k)) return 'parentEmail';
      if (['gender', 'jinsi', 'пол', 'sex'].includes(k)) return 'gender';
      if (['address', 'manzil', 'адрес'].includes(k)) return 'address';
      if (['dateofbirth', 'dob', 'tugilgankun', 'датарождения'].includes(k)) return 'dateOfBirth';
      if (['notes', 'izoh', 'комментарий'].includes(k)) return 'notes';
      if (['specializations', 'fan', 'predmet', 'subject'].includes(k)) return 'specializations';
      if (['hourlyrate', 'soatlikhaq', 'ставка'].includes(k)) return 'hourlyRate';
      return key;
    };

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    if (entityType === 'STUDENT') {
      for (let index = 0; index < rawRows.length; index++) {
        const raw = rawRows[index];
        const row: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw)) {
          row[normalizeKey(k)] = v;
        }

        const firstName = row.firstName || row.ism || '';
        const lastName = row.lastName || row.familiya || '';

        if (!firstName && !lastName) {
          skippedCount++;
          continue;
        }

        const email = row.email?.trim() || `student-${randomUUID().slice(0, 8)}@medu.local`;
        const phone = row.phone?.trim() || null;
        const parentPhone = row.parentPhone?.trim() || null;
        const parentName = row.parentName?.trim() || null;
        const parentEmail = row.parentEmail?.trim() || null;
        const address = row.address?.trim() || null;
        const gender = (row.gender?.toUpperCase() === 'FEMALE' || row.gender?.toLowerCase() === 'ayol') ? 'FEMALE' : 'MALE';
        const dob = row.dateOfBirth ? new Date(row.dateOfBirth) : null;

        try {
          await this.prisma.student.create({
            data: {
              organization: { connect: { id: orgId } },
              dateOfBirth: dob && !isNaN(dob.getTime()) ? dob : null,
              gender,
              address,
              parentName,
              parentPhone,
              parentEmail,
              user: {
                create: {
                  organization: { connect: { id: orgId } },
                  email,
                  firstName: firstName || 'O’quvchi',
                  lastName: lastName || '',
                  phone,
                  role: 'STUDENT',
                  settings: { create: {} },
                },
              },
            },
          });
          importedCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Row ${index + 2}: ${msg}`);
          skippedCount++;
        }
      }
    } else if (entityType === 'TEACHER') {
      for (let index = 0; index < rawRows.length; index++) {
        const raw = rawRows[index];
        const row: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw)) {
          row[normalizeKey(k)] = v;
        }

        const firstName = row.firstName || '';
        const lastName = row.lastName || '';

        if (!firstName && !lastName) {
          skippedCount++;
          continue;
        }

        const email = row.email?.trim() || `teacher-${randomUUID().slice(0, 8)}@medu.local`;
        const phone = row.phone?.trim() || null;
        const specializations = row.specializations ? row.specializations.split(',').map(s => s.trim()) : [];
        const hourlyRate = row.hourlyRate ? parseFloat(row.hourlyRate) : null;

        try {
          await this.prisma.teacher.create({
            data: {
              organization: { connect: { id: orgId } },
              specializations,
              hourlyRate: hourlyRate && !isNaN(hourlyRate) ? hourlyRate : undefined,
              user: {
                create: {
                  organization: { connect: { id: orgId } },
                  email,
                  firstName: firstName || 'O’qituvchi',
                  lastName: lastName || '',
                  phone,
                  role: 'TEACHER',
                  settings: { create: {} },
                },
              },
            },
          });
          importedCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Row ${index + 2}: ${msg}`);
          skippedCount++;
        }
      }
    } else {
      throw new BadRequestException(`Import for entity ${entityType} is not currently supported.`);
    }

    return {
      success: true,
      id: randomUUID(),
      entityType,
      totalRows: rawRows.length,
      importedCount,
      skippedCount,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
      message: `Successfully processed ${rawRows.length} rows. Imported: ${importedCount}, Skipped: ${skippedCount}.`,
    };
  }

  // ---- Exports -------------------------------------------------------------

  async listExports(_orgId: string, _query: ExportListQuery) {
    // M3: the mock empty-list has been replaced by a real query so the
    // exports history UI reflects actual export runs.
    const page = Math.max(1, Number((_query as { page?: string | number }).page) || 1);
    const takeRaw = Number((_query as { limit?: string | number }).limit ?? 20);
    const take = Math.min(Number.isFinite(takeRaw) && takeRaw > 0 ? Math.trunc(takeRaw) : 20, 100);
    const skip = (page - 1) * take;
    const where = { organizationId: _orgId };
    const [items, total] = await Promise.all([
      this.prisma.dataExportLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.dataExportLog.count({ where }),
    ]);
    return { items, total, page, limit: take };
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
    // CWE-1236: prefix formula-injection cells (leading =,+,-,@,\t,\r) with a
    // single quote, exactly like report-builder.service.ts — a student/lead
    // name starting with "=" would otherwise execute in Excel/LibreOffice.
    const csvCell = (v: unknown) => {
      const s = String(v ?? '');
      return "\"" + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replace(/"/g, '""') + "\"";
    };
    const safeName = entityType.toLowerCase().replace(/[^a-z0-9-]/gi, '_');
    res.setHeader("Content-Disposition", "attachment; filename=\"" + safeName + "_export.csv\"");

    // Write CSV header
    res.write(headers.map(csvCell).join(",") + "\n");

    // Write chunks
    for await (const chunk of this.streamEntityForExport(orgId, upper)) {
      let csvData = "";
      for (const row of chunk) {
        csvData += headers.map((h) => csvCell(row[h])).join(",") + "\n";
      }
      res.write(csvData);
    }
    res.end();
  }

}

