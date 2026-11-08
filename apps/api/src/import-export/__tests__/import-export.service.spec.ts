import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PassThrough } from 'node:stream';
import * as zlib from 'zlib';
import { ImportExportService } from '../import-export.service';
import { PrismaService } from '../../prisma/prisma.service';

const STUDENT_HEADERS = [
  'firstName', 'lastName', 'username', 'email', 'phone', 'dateOfBirth', 'gender',
  'address', 'parentName', 'parentPhone', 'enrollmentDate', 'balance', 'groupName', 'isActive',
];

const MOCK_STUDENT = {
  id: '1',
  organizationId: 'org1',
  dateOfBirth: '2000-01-01',
  gender: 'MALE',
  address: '123 Main St',
  parentName: 'John Doe',
  parentPhone: '555-1234',
  createdAt: new Date(),
  user: {
    firstName: 'Jane',
    lastName: 'Doe',
    username: 'jane.doe',
    email: 'jane@example.com',
    phone: '555-5678',
  },
};

function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const texts: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw)) !== null) {
    let content = Buffer.from(m[1], 'latin1').toString('latin1');
    try {
      content = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {
      // stream not compressed — search it as-is
    }
    for (const hexMatch of content.matchAll(/<([0-9A-Fa-f]+)>/g)) {
      const hex = hexMatch[1];
      let s = '';
      for (let i = 0; i + 1 < hex.length; i += 2) {
        s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
      texts.push(s);
    }
    for (const litMatch of content.matchAll(/\((.*?)\)/g)) {
      texts.push(litMatch[1]);
    }
  }
  return texts.join('');
}

function createMockRes() {
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  let ended = false;

  const pass = new PassThrough();
  pass.on('data', (d: Buffer) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
  const originalEnd = pass.end.bind(pass);

  const setHeader = vi.fn((k: string, v: string) => {
    headers[k] = v;
  });
  const end = vi.fn((chunk?: Buffer | string | (() => void)) => {
    ended = true;
    if (typeof chunk === 'function') {
      chunk();
    } else if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    originalEnd();
    return pass;
  });
  pass.end = end as unknown as typeof pass.end;

  const res = Object.assign(pass, {
    setHeader,
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
    end,
    headers,
    endedFlag: () => ended,
    collected(): Buffer {
      return Buffer.concat(chunks);
    },
    collectedText(): string {
      return Buffer.concat(chunks).toString('utf8');
    },
  });
  return res;
}

describe('ImportExportService', () => {
  let service: ImportExportService;
  let prisma: {
    student: { findMany: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn> };
    teacher: { create: ReturnType<typeof import('vitest').vi.fn> };
    group: { findFirst: ReturnType<typeof import('vitest').vi.fn> };
    user: { findFirst: ReturnType<typeof import('vitest').vi.fn>; create: ReturnType<typeof import('vitest').vi.fn> };
    organizationMembership: { create: ReturnType<typeof import('vitest').vi.fn> };
    passwordHistory: { create: ReturnType<typeof import('vitest').vi.fn> };
    $transaction: ReturnType<typeof import('vitest').vi.fn>;
  };

  beforeEach(async () => {
    const { vi } = await import('vitest');
    prisma = {
      student: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 's1' }) },
      teacher: { create: vi.fn().mockResolvedValue({ id: 't1' }) },
      group: { findFirst: vi.fn().mockResolvedValue({ id: 'g1', name: 'English B1' }) },
      user: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'u1' }) },
      organizationMembership: { create: vi.fn().mockResolvedValue({ id: 'm1' }) },
      passwordHistory: { create: vi.fn().mockResolvedValue({ id: 'ph1' }) },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportExportService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = new ImportExportService(prisma as unknown as PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportDataStream (CSV)', () => {
    it('streams CSV with headers and quoted rows', async () => {
      prisma.student.findMany.mockResolvedValue([MOCK_STUDENT]);
      const res = createMockRes();

      await service.exportDataStream('org1', 'STUDENT', 'csv', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="student_export.csv"',
      );
      const text = res.collectedText();
      expect(text).toContain('"firstName"');
      expect(text).toContain('"Jane"');
      expect(text).toContain('"Doe"');
      expect(res.end).toHaveBeenCalled();
    });

    it('streams a header-only CSV for empty data', async () => {
      const res = createMockRes();
      await service.exportDataStream('org1', 'STUDENT', 'csv', res);
      const text = res.collectedText();
      expect(text).toContain('"firstName"');
      expect(text.trim().split('\n')).toHaveLength(1);
      expect(prisma.student.findMany).toHaveBeenCalled();
    });
  });

  describe('exportDataStream (XLSX)', () => {
    it('streams a structurally valid, reloadable XLSX with expected values', async () => {
      prisma.student.findMany.mockResolvedValue([MOCK_STUDENT]);
      const res = createMockRes();

      await service.exportDataStream('org1', 'STUDENT', 'xlsx', res);
      // WorkbookWriter commits asynchronously into the stream.
      await new Promise((r) => setTimeout(r, 150));
      if (!res.endedFlag()) res.end();

      const buffer = res.collected();
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer[0]).toBe(0x50); // 'P'
      expect(buffer[1]).toBe(0x4b); // 'K'

      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);

      const sheet = wb.getWorksheet('STUDENT');
      expect(sheet).toBeDefined();
      expect(sheet!.rowCount).toBeGreaterThanOrEqual(1);

      const headerRow = sheet!.getRow(1).values as unknown[];
      const headerCells = headerRow.slice(1);
      expect(headerCells).toEqual(STUDENT_HEADERS);

      if (sheet!.rowCount >= 2) {
        const dataRow = sheet!.getRow(2);
        const cellOf = (header: string) =>
          dataRow.getCell(STUDENT_HEADERS.indexOf(header) + 1).value;
        expect(cellOf('firstName')).toBe('Jane');
        expect(cellOf('lastName')).toBe('Doe');
        expect(cellOf('email')).toBe('jane@example.com');
      }
    });

    it('sanitizes formula injection in XLSX cells (M-EDU-API-002)', async () => {
      const maliciousStudent = {
        ...MOCK_STUDENT,
        user: {
          ...MOCK_STUDENT.user,
          firstName: '=cmd|\'/C calc\'!A0',
          lastName: '+1+1',
        },
      };
      prisma.student.findMany.mockResolvedValue([maliciousStudent]);
      const res = createMockRes();

      await service.exportDataStream('org1', 'STUDENT', 'xlsx', res);
      await new Promise((r) => setTimeout(r, 150));
      if (!res.endedFlag()) res.end();

      const buffer = res.collected();
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);

      const sheet = wb.getWorksheet('STUDENT');
      const dataRow = sheet!.getRow(2);
      const cellOf = (header: string) =>
        dataRow.getCell(STUDENT_HEADERS.indexOf(header) + 1).value;

      expect(cellOf('firstName')).toBe("'=cmd|'/C calc'!A0");
      expect(cellOf('lastName')).toBe("'+1+1");
    });
  });

  describe('exportDataStream (PDF)', () => {
    it('streams a structurally valid PDF', async () => {
      prisma.student.findMany.mockResolvedValue([MOCK_STUDENT]);
      const res = createMockRes();

      await service.exportDataStream('org1', 'STUDENT', 'pdf', res);
      if (!res.endedFlag()) res.end();

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="student_export.pdf"',
      );
      expect(res.end).toHaveBeenCalled();

      const buffer = res.collected();
      expect(buffer.length).toBeGreaterThan(500);
      const text = buffer.toString('latin1');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text.includes('%%EOF')).toBe(true);
      expect(text).toContain('/Type /Catalog');
      expect(text).toContain('/Type /Page');
      // Font-embedded PDFs encode glyphs, not raw 'STUDENT' text — structural
      // checks match scripts/verify-export-runtime.ts.
    });
  });

  describe('startImport', () => {
    it('throws error when file is missing or empty', async () => {
      await expect(
        service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, undefined),
      ).rejects.toThrow('Import file is required and must not be empty');

      await expect(
        service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, { buffer: Buffer.from('') }),
      ).rejects.toThrow('Import file is required and must not be empty');
    });

    it('successfully parses and imports CSV student rows with header aliases', async () => {
      const csvData = 'Ism,Familiya,Telefon,Ota_onasi,Ota_ona_tel\nAlisher,Navoiy,+998901234567,Giyosiddin,+998907654321\nBobur,Zahiriddin,+998912345678,Umarshayx,+998918765432';
      const file = {
        buffer: Buffer.from(csvData, 'utf-8'),
        originalname: 'students.csv',
        mimetype: 'text/csv',
      };

      const result = await service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file);

      expect(result.success).toBe(true);
      expect(result.entityType).toBe('STUDENT');
      expect(result.totalRows).toBe(2);
      expect(result.importedCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(prisma.student.create).toHaveBeenCalledTimes(2);
    });

    it('successfully parses and imports Excel (.xlsx) student rows', async () => {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Students');
      ws.addRow(['firstName', 'lastName', 'phone', 'parentPhone']);
      ws.addRow(['Sanjar', 'Karimov', '+998931112233', '+998934445566']);

      const buffer = await wb.xlsx.writeBuffer();
      const file = {
        buffer: Buffer.from(buffer),
        originalname: 'students.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      const result = await service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file);

      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(1);
      expect(result.importedCount).toBe(1);
      expect(prisma.student.create).toHaveBeenCalled();
    });

    it('rejects files exceeding 10MB file size limit (M-EDU-API-003)', async () => {
      const hugeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
      const file = {
        buffer: hugeBuffer,
        originalname: 'huge.csv',
        mimetype: 'text/csv',
      };

      await expect(
        service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file),
      ).rejects.toThrow('Import file size exceeds maximum limit of 10MB');
    });

    it('rejects CSV files exceeding 5000 rows limit (M-EDU-API-003)', async () => {
      let csv = 'firstName,lastName\n';
      for (let i = 0; i < 5002; i++) {
        csv += `User${i},Test${i}\n`;
      }
      const file = {
        buffer: Buffer.from(csv, 'utf-8'),
        originalname: 'bomb.csv',
        mimetype: 'text/csv',
      };

      await expect(
        service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file),
      ).rejects.toThrow('CSV file exceeds maximum allowed limit of 5000 rows');
    });

    it('rejects files exceeding 50 columns (M-EDU-API-003)', async () => {
      const wideHeaders = Array.from({ length: 55 }, (_, i) => `col${i}`).join(',');
      const csv = `${wideHeaders}\n${Array.from({ length: 55 }, () => 'val').join(',')}`;
      const file = {
        buffer: Buffer.from(csv, 'utf-8'),
        originalname: 'wide.csv',
        mimetype: 'text/csv',
      };

      await expect(
        service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file),
      ).rejects.toThrow('CSV file exceeds maximum limit of 50 columns');
    });

    it('performs dry-run preview without writing to database', async () => {
      const csvData = 'Ism,Familiya,Telefon,Balans,Guruh\nOtabek,Zokirov,+998901112233,450000,IELTS-Morning';
      const file = {
        buffer: Buffer.from(csvData, 'utf-8'),
        originalname: 'modme_export.csv',
        mimetype: 'text/csv',
      };

      const result: any = await service.startImport(
        'org1',
        { entityType: 'STUDENT', mode: 'CREATE', dryRun: true },
        file,
      );

      expect(result.dryRun).toBe(true);
      expect(result.totalRows).toBe(1);
      expect(result.validCount).toBe(1);
      expect(result.preview).toHaveLength(1);
      expect(result.preview[0]).toMatchObject({
        firstName: 'Otabek',
        lastName: 'Zokirov',
        balance: 450000,
        groupName: 'IELTS-Morning',
      });
      expect(prisma.student.create).not.toHaveBeenCalled();
    });

    it('maps Modme Uzbek column aliases, attaches balance and connects group', async () => {
      const csvData = 'Ism,Familiya,Telefon,Balans,Guruh\nOtabek,Zokirov,+998901112233,450000,English B1';
      const file = {
        buffer: Buffer.from(csvData, 'utf-8'),
        originalname: 'modme_export.csv',
        mimetype: 'text/csv',
      };

      const result = await service.startImport(
        'org1',
        { entityType: 'STUDENT', mode: 'CREATE', dryRun: false },
        file,
      );

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(prisma.group.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          name: { equals: 'English B1', mode: 'insensitive' },
        },
        select: { id: true },
      });
      expect(prisma.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: 450000,
            groups: {
              create: {
                organization: { connect: { id: 'org1' } },
                group: { connect: { id: 'g1' } },
              },
            },
          }),
        }),
      );
    });

    it('rejects corrupted Excel (.xlsx) file with clean BadRequestException', async () => {
      const file = {
        buffer: Buffer.from('Not a valid zip or excel archive'),
        originalname: 'corrupt.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      await expect(
        service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file),
      ).rejects.toThrow('Corrupted or invalid Excel file');
    });

    it('correctly parses multi-line quoted CSV values without breaking rows', async () => {
      const csvData = 'firstName,lastName,address\n"Ali","Valiyev","Line 1\nLine 2"\n"Hasan","Husanov","Single Line"';
      const file = {
        buffer: Buffer.from(csvData, 'utf-8'),
        originalname: 'multiline.csv',
        mimetype: 'text/csv',
      };

      const result = await service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file);
      expect(result.success).toBe(true);
      expect(result.totalRows).toBe(2);
      expect(result.importedCount).toBe(2);
    });

    it('supports UTF-16LE encoded CSV files with byte-order mark', async () => {
      const text = 'firstName,lastName,email\nAlisher,Navoiy,alisher@example.com';
      const bom = Buffer.from([0xff, 0xfe]);
      const body = Buffer.from(text, 'utf16le');
      const file = {
        buffer: Buffer.concat([bom, body]),
        originalname: 'utf16.csv',
        mimetype: 'text/csv',
      };

      const result = await service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
    });

    it('generates collision-free usernames and onboarding credentials with temporary passwords for imported students', async () => {
      const csv = [
        'firstName,lastName,email,phone',
        'Anvar,Qosimov,anvar1@example.com,+998901112233',
        'Anvar,Qosimov,anvar2@example.com,+998904445566',
      ].join('\n');

      const file = {
        buffer: Buffer.from(csv, 'utf-8'),
        originalname: 'students.csv',
        mimetype: 'text/csv',
      };

      const result = await service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(result.credentials).toBeDefined();
      expect(result.credentials?.length).toBe(2);

      const first = result.credentials![0];
      const second = result.credentials![1];

      expect(first.username).toBe('anvar.qosimov');
      expect(first.temporaryPassword).toMatch(/^Medu!/);
      expect(first.temporaryPassword.length).toBeGreaterThanOrEqual(8);
      expect(first.role).toBe('STUDENT');

      // Second identical name must get resolved collision suffix
      expect(second.username).toBe('anvar.qosimov2');
      expect(second.temporaryPassword).toMatch(/^Medu!/);
    });

    it('transliterates Cyrillic Uzbek names into Latin usernames during bulk import', async () => {
      const csv = [
        'firstName,lastName,email,phone',
        'Шаҳзод,Раҳимов,shahzod@example.com,+998901234567',
      ].join('\n');

      const file = {
        buffer: Buffer.from(csv, 'utf-8'),
        originalname: 'cyrillic_students.csv',
        mimetype: 'text/csv',
      };

      const result = await service.startImport('org1', { entityType: 'STUDENT', mode: 'CREATE' }, file);
      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(result.credentials).toBeDefined();

      const cred = result.credentials![0];
      expect(cred.username).toBe('shahzod.rahimov');
      expect(cred.temporaryPassword).toMatch(/^Medu!/);
    });
  });
});
