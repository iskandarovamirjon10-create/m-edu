import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
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
  STUDENT: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'parentName', 'parentPhone', 'enrollmentDate', 'balance', 'groupName', 'isActive'],
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
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ImportExportService {
  private readonly logger = new Logger(ImportExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---- Imports -------------------------------------------------------------

  /**
   * Map a Prisma write failure to a client-safe message. The raw
   * `err.message` exposes table/constraint names and may echo submitted
   * values, so it is only written to the server log.
   */
  private safeImportError(err: unknown): string {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') return 'A record with the same unique value already exists';
    if (code === 'P2003') return 'A referenced record does not exist';
    return 'The row could not be imported';
  }

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
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('Import file size exceeds maximum limit of 10MB');
    }

    const MAX_ALLOWED_ROWS = 5000;
    const MAX_ALLOWED_CELLS = 50000;

    const isExcel = filename.endsWith('.xlsx') || filename.endsWith('.xls') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const rawRows: Record<string, string>[] = [];

    if (isExcel) {
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.load(file.buffer as any);
      } catch (err: unknown) {
        throw new BadRequestException(
          `Corrupted or invalid Excel file: ${err instanceof Error ? err.message : 'unreadable file format'}`,
        );
      }
      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount < 2) {
        throw new BadRequestException('Excel file is empty or missing data rows');
      }

      if (worksheet.rowCount > MAX_ALLOWED_ROWS + 1) {
        throw new BadRequestException(`Excel file exceeds maximum allowed limit of ${MAX_ALLOWED_ROWS} rows`);
      }

      let headers: string[] = [];
      let totalCells = 0;
      worksheet.eachRow((row, rowNumber) => {
        const values = row.values as unknown[];
        if (rowNumber === 1) {
          headers = (Array.isArray(values) ? values.slice(1) : []).map(v => String(v ?? '').trim());
          if (headers.length > 50) {
            throw new BadRequestException('Excel file exceeds maximum limit of 50 columns');
          }
        } else if (headers.length > 0) {
          if (rawRows.length >= MAX_ALLOWED_ROWS) {
            throw new BadRequestException(`Import file exceeds maximum allowed limit of ${MAX_ALLOWED_ROWS} rows`);
          }
          const rowObj: Record<string, string> = {};
          let hasContent = false;
          headers.forEach((h, idx) => {
            totalCells++;
            if (totalCells > MAX_ALLOWED_CELLS) {
              throw new BadRequestException(`Import file exceeds maximum allowed cell limit (${MAX_ALLOWED_CELLS})`);
            }
            const val = Array.isArray(values) ? values[idx + 1] : undefined;
            const strVal = val !== undefined && val !== null ? String(val).trim().replace(/\0/g, '') : '';
            if (strVal.length > 0) hasContent = true;
            rowObj[h] = strVal;
          });
          if (hasContent) {
            rawRows.push(rowObj);
          }
        }
      });
    } else {
      // CSV parser with encoding detection (UTF-16LE, UTF-8 BOM, UTF-8)
      let content: string;
      const buf = file.buffer;
      if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
        content = buf.toString('utf16le');
      } else if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        content = buf.subarray(3).toString('utf-8');
      } else {
        content = buf.toString('utf-8');
      }
      content = content.replace(/^\uFEFF/, '').replace(/\0/g, '');

      // RFC-4180 compliant CSV line parsing that respects quoted newlines
      const csvRows: string[][] = [];
      let currentRow: string[] = [];
      let currentCell = '';
      let inQuotes = false;
      let totalCells = 0;

      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"') {
          if (inQuotes && content[i + 1] === '"') {
            currentCell += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          currentRow.push(currentCell.trim());
          currentCell = '';
          totalCells++;
          if (totalCells > MAX_ALLOWED_CELLS) {
            throw new BadRequestException(`Import file exceeds maximum allowed cell limit (${MAX_ALLOWED_CELLS})`);
          }
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
          if (char === '\r' && content[i + 1] === '\n') {
            i++;
          }
          currentRow.push(currentCell.trim());
          currentCell = '';
          totalCells++;
          if (totalCells > MAX_ALLOWED_CELLS) {
            throw new BadRequestException(`Import file exceeds maximum allowed cell limit (${MAX_ALLOWED_CELLS})`);
          }

          if (currentRow.some(c => c.length > 0)) {
            csvRows.push(currentRow);
            if (csvRows.length > MAX_ALLOWED_ROWS + 1) {
              throw new BadRequestException(`CSV file exceeds maximum allowed limit of ${MAX_ALLOWED_ROWS} rows`);
            }
          }
          currentRow = [];
        } else {
          currentCell += char;
        }
      }

      if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          csvRows.push(currentRow);
        }
      }

      if (csvRows.length < 2) {
        throw new BadRequestException('CSV file must have at least a header row and one data row');
      }

      const headers = csvRows[0].map(h => h.trim());
      if (headers.length > 50) {
        throw new BadRequestException('CSV file exceeds maximum limit of 50 columns');
      }

      for (let r = 1; r < csvRows.length; r++) {
        if (rawRows.length >= MAX_ALLOWED_ROWS) {
          throw new BadRequestException(`CSV file exceeds maximum allowed limit of ${MAX_ALLOWED_ROWS} rows`);
        }
        const values = csvRows[r];
        const rowObj: Record<string, string> = {};
        let hasContent = false;
        headers.forEach((h, idx) => {
          const val = (values[idx] ?? '').trim();
          if (val.length > 0) hasContent = true;
          rowObj[h] = val;
        });
        if (hasContent) {
          rawRows.push(rowObj);
        }
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
      if (['balance', 'balans', 'qarz', 'qarzdorlik', 'saldo', 'баланс', 'долг'].includes(k)) return 'balance';
      if (['group', 'groupname', 'guruh', 'guruhnomi', 'sinf', 'kurs', 'класс', 'группа'].includes(k)) return 'groupName';
      return key;
    };

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const previewRows: Array<Record<string, unknown>> = [];

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

        const email = (row.email?.trim() || '').toLowerCase() || `student-${randomUUID().slice(0, 8)}@medu.local`;
        const phone = row.phone?.trim() || null;
        const parentPhone = row.parentPhone?.trim() || null;
        const parentName = row.parentName?.trim() || null;
        const parentEmail = row.parentEmail?.trim() || null;
        const address = row.address?.trim() || null;
        const gender = (row.gender?.toUpperCase() === 'FEMALE' || row.gender?.toLowerCase() === 'ayol') ? 'FEMALE' : 'MALE';
        const dob = row.dateOfBirth ? new Date(row.dateOfBirth) : null;
        const rawBalance = row.balance ? parseFloat(String(row.balance).replace(/[^\d.-]/g, '')) : 0;
        const balance = isNaN(rawBalance) ? 0 : rawBalance;
        const groupName = row.groupName?.trim() || null;

        if (dto.dryRun) {
          if (previewRows.length < 10) {
            previewRows.push({
              rowNumber: index + 2,
              firstName: firstName || 'O’quvchi',
              lastName: lastName || '',
              phone,
              email,
              gender,
              balance,
              groupName,
            });
          }
          importedCount++;
          continue;
        }

        try {
          let existingStudent: any = null;
          if ((row.email || phone) && typeof this.prisma.student?.findFirst === 'function' && dto.mode !== 'CREATE') {
            existingStudent = await this.prisma.student.findFirst({
              where: {
                organizationId: orgId,
                OR: [
                  row.email ? { user: { email } } : undefined,
                  phone ? { user: { phone } } : undefined,
                ].filter(Boolean) as Prisma.StudentWhereInput[],
              },
              include: { user: true },
            });
          }

          if (dto.mode === 'UPDATE' && !existingStudent) {
            errors.push(`Row ${index + 2}: Student not found for update`);
            skippedCount++;
            continue;
          }

          if (dto.mode === 'CREATE' && existingStudent) {
            errors.push(`Row ${index + 2}: A record with the same unique value already exists`);
            skippedCount++;
            continue;
          }

          let resolvedGroupId: string | null = null;
          if (groupName) {
            const group = await this.prisma.group.findFirst({
              where: {
                organizationId: orgId,
                name: { equals: groupName, mode: 'insensitive' },
              },
              select: { id: true },
            });
            if (group) {
              resolvedGroupId = group.id;
            }
          }

          if (existingStudent) {
            // UPSERT / UPDATE path inside atomic transaction
            await this.prisma.$transaction(async (tx) => {
              await tx.student.update({
                where: { id: existingStudent!.id },
                data: {
                  dateOfBirth: dob && !isNaN(dob.getTime()) ? dob : undefined,
                  gender: row.gender ? gender : undefined,
                  address: address ?? undefined,
                  parentName: parentName ?? undefined,
                  parentPhone: parentPhone ?? undefined,
                  parentEmail: parentEmail ?? undefined,
                  balance: row.balance ? balance : undefined,
                },
              });

              await tx.user.update({
                where: { id: existingStudent!.userId },
                data: {
                  firstName: firstName || undefined,
                  lastName: lastName || undefined,
                  phone: phone ?? undefined,
                },
              });

              if (resolvedGroupId) {
                await tx.studentGroup.upsert({
                  where: {
                    studentId_groupId: {
                      studentId: existingStudent!.id,
                      groupId: resolvedGroupId,
                    },
                  },
                  update: { isActive: true, leftAt: null, organizationId: orgId },
                  create: {
                    organizationId: orgId,
                    studentId: existingStudent!.id,
                    groupId: resolvedGroupId,
                    isActive: true,
                  },
                });
              }
            });
            importedCount++;
          } else {
            // CREATE path
            let groupConnect: any = undefined;
            if (resolvedGroupId) {
              groupConnect = {
                create: {
                  organization: { connect: { id: orgId } },
                  group: { connect: { id: resolvedGroupId } },
                },
              };
            }
            await this.prisma.student.create({
              data: {
                organization: { connect: { id: orgId } },
                dateOfBirth: dob && !isNaN(dob.getTime()) ? dob : null,
                gender,
                address,
                parentName,
                parentPhone,
                parentEmail,
                balance,
                groups: groupConnect,
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
          }
        } catch (err: unknown) {
          this.logger.error(
            `Import STUDENT row ${index + 2} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          errors.push(`Row ${index + 2}: ${this.safeImportError(err)}`);
          skippedCount++;
        }
      }
      if (dto.dryRun) {
        return {
          dryRun: true,
          totalRows: rawRows.length,
          validCount: importedCount,
          skippedCount,
          errorCount: errors.length,
          errors,
          preview: previewRows,
        };
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

        const email = (row.email?.trim() || '').toLowerCase() || `teacher-${randomUUID().slice(0, 8)}@medu.local`;
        const phone = row.phone?.trim() || null;
        const specializations = row.specializations ? row.specializations.split(',').map(s => s.trim()) : [];
        const hourlyRate = row.hourlyRate ? parseFloat(row.hourlyRate) : null;

        try {
          let existingTeacher: any = null;
          if ((row.email || phone) && typeof this.prisma.teacher?.findFirst === 'function' && dto.mode !== 'CREATE') {
            existingTeacher = await this.prisma.teacher.findFirst({
              where: {
                organizationId: orgId,
                OR: [
                  row.email ? { user: { email } } : undefined,
                  phone ? { user: { phone } } : undefined,
                ].filter(Boolean) as Prisma.TeacherWhereInput[],
              },
              include: { user: true },
            });
          }

          if (dto.mode === 'UPDATE' && !existingTeacher) {
            errors.push(`Row ${index + 2}: Teacher not found for update`);
            skippedCount++;
            continue;
          }

          if (dto.mode === 'CREATE' && existingTeacher) {
            errors.push(`Row ${index + 2}: A record with the same unique value already exists`);
            skippedCount++;
            continue;
          }

          if (existingTeacher) {
            await this.prisma.$transaction(async (tx) => {
              await tx.teacher.update({
                where: { id: existingTeacher!.id },
                data: {
                  specializations: specializations.length > 0 ? specializations : undefined,
                  hourlyRate: hourlyRate && !isNaN(hourlyRate) ? hourlyRate : undefined,
                },
              });
              await tx.user.update({
                where: { id: existingTeacher!.userId },
                data: {
                  firstName: firstName || undefined,
                  lastName: lastName || undefined,
                  phone: phone ?? undefined,
                },
              });
            });
            importedCount++;
          } else {
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
          }
        } catch (err: unknown) {
          this.logger.error(
            `Import TEACHER row ${index + 2} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          errors.push(`Row ${index + 2}: ${this.safeImportError(err)}`);
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
      workbook.creator = "M-EDU Platform";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet(upper);
      
      // Auto-size columns with readable padding
      sheet.columns = headers.map(h => ({
        key: h,
        width: Math.max(h.length + 6, 14),
      }));

      // CWE-1236: sanitize cells starting with formula triggers (=, +, -, @, \t, \r)
      const sanitizeExcelCell = (v: unknown): string => {
        const s = String(v ?? '');
        return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
      };

      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0066FF' },
      };
      headerRow.height = 24;

      for await (const chunk of this.streamEntityForExport(orgId, upper)) {
        for (const row of chunk) {
          sheet.addRow(headers.map(h => sanitizeExcelCell(row[h])));
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
          { text: "M-EDU PLATFORM · " + entityType.toUpperCase() + " EXPORT", style: "header" },
          { text: "Generated on: " + new Date().toISOString().replace('T', ' ').slice(0, 19) + " UTC · Records: " + allRows.length, style: "subHeader" },
          {
            table: {
              headerRows: 1,
              body: tableBody,
            },
            layout: "lightHorizontalLines",
          },
        ],
        footer: (currentPage: number, pageCount: number) => ({
          text: `Page ${currentPage} of ${pageCount} · M-EDU Education Operating System`,
          alignment: "center",
          fontSize: 8,
          color: "#64748B",
          margin: [0, 10, 0, 0],
        }),
        styles: {
          header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4], color: "#0F172A" },
          subHeader: { fontSize: 9, color: "#64748B", margin: [0, 0, 0, 12] },
          tableHeader: { bold: true, fontSize: 10, color: "#FFFFFF", fillColor: "#0066FF" },
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

