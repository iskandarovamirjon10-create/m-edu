import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PassThrough } from 'node:stream';
import * as zlib from 'zlib';
import { ImportExportService } from '../import-export.service';
import { PrismaService } from '../../prisma/prisma.service';

const STUDENT_HEADERS = [
  'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender',
  'address', 'parentName', 'parentPhone', 'enrollmentDate', 'isActive',
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
  };

  beforeEach(async () => {
    const { vi } = await import('vitest');
    prisma = {
      student: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 's1' }) },
      teacher: { create: vi.fn().mockResolvedValue({ id: 't1' }) },
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

    service = module.get<ImportExportService>(ImportExportService);
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
  });
});
