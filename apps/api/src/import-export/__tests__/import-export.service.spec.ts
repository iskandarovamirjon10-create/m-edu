import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import * as zlib from 'zlib';
import { ImportExportService } from '../import-export.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Export binary verification.
 */
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

describe('ImportExportService', () => {
  let service: ImportExportService;
  let prisma: {
    student: { findMany: ReturnType<typeof import('vitest').vi.fn> };
    teacher: { findMany: ReturnType<typeof import('vitest').vi.fn> };
    group: { findMany: ReturnType<typeof import('vitest').vi.fn> };
    course: { findMany: ReturnType<typeof import('vitest').vi.fn> };
    payment: { findMany: ReturnType<typeof import('vitest').vi.fn> };
    employee: { findMany: ReturnType<typeof import('vitest').vi.fn> };
    libraryBook: { findMany: ReturnType<typeof import('vitest').vi.fn> };
    lead: { findMany: ReturnType<typeof import('vitest').vi.fn> };
  };

  beforeEach(async () => {
    const { vi } = await import('vitest');
    prisma = {
      student: { findMany: vi.fn().mockResolvedValue([]) },
      teacher: { findMany: vi.fn().mockResolvedValue([]) },
      group: { findMany: vi.fn().mockResolvedValue([]) },
      course: { findMany: vi.fn().mockResolvedValue([]) },
      payment: { findMany: vi.fn().mockResolvedValue([]) },
      employee: { findMany: vi.fn().mockResolvedValue([]) },
      libraryBook: { findMany: vi.fn().mockResolvedValue([]) },
      lead: { findMany: vi.fn().mockResolvedValue([]) },
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

  describe('exportData (XLSX)', () => {
    it('generates a structurally valid, reloadable XLSX with expected values', async () => {
      prisma.student.findMany.mockResolvedValue([MOCK_STUDENT]);

      const buffer = await service.exportData('org1', 'STUDENT', 'xlsx');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer[0]).toBe(0x50); // 'P'
      expect(buffer[1]).toBe(0x4b); // 'K'

      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);

      const sheet = wb.getWorksheet('STUDENT');
      expect(sheet).toBeDefined();
      expect(sheet!.rowCount).toBe(2);

      const headerRow = sheet!.getRow(1).values as unknown[];
      const headerCells = headerRow.slice(1);
      expect(headerCells).toEqual(STUDENT_HEADERS);

      const dataRow = sheet!.getRow(2);
      const cellOf = (header: string) => dataRow.getCell(STUDENT_HEADERS.indexOf(header) + 1).value;
      expect(cellOf('firstName')).toBe('Jane');
      expect(cellOf('lastName')).toBe('Doe');
      expect(cellOf('email')).toBe('jane@example.com');
      expect(cellOf('phone')).toBe('555-5678');
      expect(cellOf('parentName')).toBe('John Doe');
    });

    it('generates a valid XLSX for empty data (header-only sheet)', async () => {
      const buffer = await service.exportData('org1', 'STUDENT', 'xlsx');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
      expect(prisma.student.findMany).toHaveBeenCalled();

      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      const sheet = wb.getWorksheet('STUDENT');
      expect(sheet).toBeDefined();
      expect(sheet!.rowCount).toBe(1);
    });
  });

  describe('exportData (PDF)', () => {
    it('generates a structurally valid PDF with expected values', async () => {
      prisma.student.findMany.mockResolvedValue([MOCK_STUDENT]);

      const buffer = await service.exportData('org1', 'STUDENT', 'pdf');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);
      expect(prisma.student.findMany).toHaveBeenCalled();

      const text = buffer.toString('latin1');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
      expect(text).toContain('/Type /Catalog');
      expect(text).toContain('/Type /Page');
      expect(text).toContain('/Contents');

      const decoded = extractPdfText(buffer);
      expect(decoded).toContain('STUDENT');
      expect(decoded).toContain('Jane');
      expect(decoded).toContain('Doe');
      expect(decoded).toContain('jane@example.com');
    });

    it('generates a valid PDF for empty data (header-only table)', async () => {
      const buffer = await service.exportData('org1', 'STUDENT', 'pdf');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);
      expect(prisma.student.findMany).toHaveBeenCalled();

      const text = buffer.toString('latin1');
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    });
  });
});
