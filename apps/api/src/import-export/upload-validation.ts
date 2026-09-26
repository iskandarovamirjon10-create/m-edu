import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export const ALLOWED_IMPORT_MIMES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const ALLOWED_IMPORT_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

export const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

/**
 * Sanitizes an uploaded filename to prevent directory traversal, control characters,
 * and dangerous shell sequences.
 */
export function sanitizeUploadFileName(fileName: string): string {
  if (!fileName) return 'uploaded_file';
  // Strip paths
  const base = path.basename(fileName);
  // Remove null bytes and non-printable characters
  const clean = base.replace(/[\0\x00-\x1f\x7f]/g, '').trim();
  // Strip leading dots to prevent hidden/dot-dot files
  const noLeadingDots = clean.replace(/^\.+/, '');
  // Whitelist safe characters: alphanumeric, hyphen, underscore, dot, and collapse repeated underscores
  const sanitized = noLeadingDots.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return sanitized.length > 0 ? sanitized : 'uploaded_file';
}

/**
 * Validates file buffer, magic bytes, extension, and MIME type for import uploads.
 */
export function validateImportUpload(file: Express.Multer.File): { safeFileName: string } {
  if (!file) {
    throw new BadRequestException('File is required for import');
  }

  // 1. File size check
  if (file.size && file.size > MAX_IMPORT_FILE_SIZE) {
    throw new BadRequestException(`File size exceeds maximum allowed limit of ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // 2. Extension check
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_IMPORT_EXTENSIONS.includes(ext)) {
    throw new BadRequestException(
      `Invalid file extension "${ext}". Allowed extensions are: ${ALLOWED_IMPORT_EXTENSIONS.join(', ')}`,
    );
  }

  // 3. MIME type check
  if (!ALLOWED_IMPORT_MIMES.includes(file.mimetype)) {
    throw new BadRequestException(
      `Invalid MIME type "${file.mimetype}". Allowed types are: ${ALLOWED_IMPORT_MIMES.join(', ')}`,
    );
  }

  const safeFileName = sanitizeUploadFileName(file.originalname);

  // 4. Magic bytes & Content Inspection (if buffer present)
  if (file.buffer && file.buffer.length > 0) {
    const buf = file.buffer;

    // Check for executable signatures
    // DOS / Windows PE: 'MZ' (0x4D, 0x5A)
    if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) {
      throw new BadRequestException('Prohibited executable file signature detected (MZ/PE)');
    }
    // Linux ELF: 0x7F 'ELF' (0x7F, 0x45, 0x4C, 0x46)
    if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
      throw new BadRequestException('Prohibited executable file signature detected (ELF)');
    }
    // Mach-O binary signatures
    if (buf.length >= 4 && (
      (buf[0] === 0xfe && buf[1] === 0xed && buf[2] === 0xfa && (buf[3] === 0xce || buf[3] === 0xcf)) ||
      (buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe) ||
      (buf[0] === 0xca && buf[1] === 0xfe && buf[2] === 0xba && buf[3] === 0xbe)
    )) {
      throw new BadRequestException('Prohibited binary executable signature detected (Mach-O / Java Class)');
    }

    // Format-specific verification
    if (ext === '.xlsx') {
      // XLSX is a ZIP archive; must start with PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
      if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 0x03 || buf[3] !== 0x04) {
        throw new BadRequestException('Corrupted or invalid XLSX file format (missing ZIP magic bytes)');
      }
    } else if (ext === '.xls') {
      // Legacy XLS is OLECF; starts with D0 CF 11 E0 A1 B1 1A E1
      if (buf.length < 4 || buf[0] !== 0xd0 || buf[1] !== 0xcf || buf[2] !== 0x11 || buf[3] !== 0xe0) {
        throw new BadRequestException('Corrupted or invalid XLS file format (missing OLECF magic bytes)');
      }
    } else if (ext === '.csv') {
      // CSV must be text; inspect sample (first 4KB) for null bytes
      const sampleLength = Math.min(buf.length, 4096);
      for (let i = 0; i < sampleLength; i++) {
        if (buf[i] === 0x00) {
          throw new BadRequestException('Invalid CSV file: binary null bytes detected');
        }
      }
    }
  }

  return { safeFileName };
}
