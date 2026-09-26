import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  validateImportUpload,
  sanitizeUploadFileName,
  ALLOWED_IMPORT_MIMES,
  ALLOWED_IMPORT_EXTENSIONS,
  MAX_IMPORT_FILE_SIZE,
} from '../upload-validation';

describe('Upload Security & Validation (Phase 3 Hardening)', () => {
  describe('sanitizeUploadFileName', () => {
    it('should strip path traversal sequences', () => {
      expect(sanitizeUploadFileName('../../etc/passwd')).toBe('passwd');
      expect(sanitizeUploadFileName('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeUploadFileName('nested/dir/file.csv')).toBe('file.csv');
    });

    it('should strip leading dots and null bytes', () => {
      expect(sanitizeUploadFileName('...hidden.csv')).toBe('hidden.csv');
      expect(sanitizeUploadFileName('\0malicious.csv')).toBe('malicious.csv');
    });

    it('should replace special and forbidden shell characters with underscore', () => {
      expect(sanitizeUploadFileName('test file$(whoami);.csv')).toBe('test_file_whoami_.csv');
      expect(sanitizeUploadFileName('bad|file&name`test`.csv')).toBe('bad_file_name_test_.csv');
    });

    it('should fallback to default filename when empty or all invalid', () => {
      expect(sanitizeUploadFileName('')).toBe('uploaded_file');
      expect(sanitizeUploadFileName('...')).toBe('uploaded_file');
    });
  });

  describe('validateImportUpload', () => {
    it('should accept a valid CSV file', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'students.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 1024,
        destination: '',
        filename: 'students.csv',
        path: '',
        buffer: Buffer.from('firstName,lastName,email\nJohn,Doe,john@example.com'),
        stream: null as any,
      };

      const result = validateImportUpload(file);
      expect(result.safeFileName).toBe('students.csv');
    });

    it('should accept a valid XLSX file with ZIP magic bytes (PK\\x03\\x04)', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'courses.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 2048,
        destination: '',
        filename: 'courses.xlsx',
        path: '',
        buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
        stream: null as any,
      };

      const result = validateImportUpload(file);
      expect(result.safeFileName).toBe('courses.xlsx');
    });

    it('should accept a valid XLS file with OLECF magic bytes', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'legacy.xls',
        encoding: '7bit',
        mimetype: 'application/vnd.ms-excel',
        size: 2048,
        destination: '',
        filename: 'legacy.xls',
        path: '',
        buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        stream: null as any,
      };

      const result = validateImportUpload(file);
      expect(result.safeFileName).toBe('legacy.xls');
    });

    it('should reject file exceeding maximum size', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'huge.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: MAX_IMPORT_FILE_SIZE + 1,
        destination: '',
        filename: 'huge.csv',
        path: '',
        buffer: Buffer.alloc(10),
        stream: null as any,
      };

      expect(() => validateImportUpload(file)).toThrow(BadRequestException);
      expect(() => validateImportUpload(file)).toThrow(/exceeds maximum allowed limit/);
    });

    it('should reject prohibited extension even if MIME type is forged', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'malware.exe',
        encoding: '7bit',
        mimetype: 'text/csv', // Spoofed MIME
        size: 1024,
        destination: '',
        filename: 'malware.exe',
        path: '',
        buffer: Buffer.from('hello world'),
        stream: null as any,
      };

      expect(() => validateImportUpload(file)).toThrow(BadRequestException);
      expect(() => validateImportUpload(file)).toThrow(/Invalid file extension/);
    });

    it('should reject prohibited MIME type even if extension is .csv', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.csv',
        encoding: '7bit',
        mimetype: 'application/x-sh',
        size: 1024,
        destination: '',
        filename: 'test.csv',
        path: '',
        buffer: Buffer.from('echo "pwned"'),
        stream: null as any,
      };

      expect(() => validateImportUpload(file)).toThrow(BadRequestException);
      expect(() => validateImportUpload(file)).toThrow(/Invalid MIME type/);
    });

    it('should reject Windows PE executable disguised as CSV (MZ header)', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'trojan.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 1024,
        destination: '',
        filename: 'trojan.csv',
        path: '',
        buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), // MZ header
        stream: null as any,
      };

      expect(() => validateImportUpload(file)).toThrow(BadRequestException);
      expect(() => validateImportUpload(file)).toThrow(/Prohibited executable file signature detected \(MZ\/PE\)/);
    });

    it('should reject Linux ELF executable disguised as CSV', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'rootkit.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 1024,
        destination: '',
        filename: 'rootkit.csv',
        path: '',
        buffer: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]), // 7F ELF
        stream: null as any,
      };

      expect(() => validateImportUpload(file)).toThrow(BadRequestException);
      expect(() => validateImportUpload(file)).toThrow(/Prohibited executable file signature detected \(ELF\)/);
    });

    it('should reject binary null bytes in CSV file', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'corrupt.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        size: 1024,
        destination: '',
        filename: 'corrupt.csv',
        path: '',
        buffer: Buffer.from('firstName,lastName\x00,email'),
        stream: null as any,
      };

      expect(() => validateImportUpload(file)).toThrow(BadRequestException);
      expect(() => validateImportUpload(file)).toThrow(/binary null bytes detected/);
    });

    it('should reject invalid XLSX without ZIP magic bytes', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'fake.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1024,
        destination: '',
        filename: 'fake.xlsx',
        path: '',
        buffer: Buffer.from('NOT_A_ZIP_ARCHIVE_CONTENT'),
        stream: null as any,
      };

      expect(() => validateImportUpload(file)).toThrow(BadRequestException);
      expect(() => validateImportUpload(file)).toThrow(/Corrupted or invalid XLSX file format/);
    });
  });
});
