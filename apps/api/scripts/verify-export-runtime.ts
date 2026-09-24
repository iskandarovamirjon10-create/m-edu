/**
 * P1 runtime export verification.
 * Actually generates XLSX + PDF through ImportExportService with a stubbed
 * Prisma layer, then programmatically validates the artifacts:
 *  - XLSX: valid ZIP magic, [Content_Types].xml, workbook.xml, worksheet.xml, expected cell data
 *  - PDF:  %PDF- signature, EOF marker, non-trivial size
 * Exit code 0 = all checks passed; 1 = any failure.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';
import AdmZip from 'adm-zip';
import { ImportExportService } from '../src/import-export/import-export.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const failures: string[] = [];
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

async function main() {
  // Minimal Prisma stub: one student row whose flattened export includes expected data.
  const prismaStub = {
    student: {
      findMany: async () => [
        {
          id: 's-1',
          user: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+998901234567' },
          dateOfBirth: new Date('2010-05-01'),
          gender: 'FEMALE',
          address: 'Bukhara',
          parentName: 'Byron Lovelace',
          parentPhone: '+998900000000',
          enrollmentDate: new Date('2026-09-01'),
          isActive: true,
        },
      ],
    },
  };

  const svc = new ImportExportService(prismaStub as unknown as PrismaService);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-export-'));

  // ---------------------------------------------------------------- XLSX
  console.log('\n[XLSX] generating via ImportExportService.exportData(STUDENT, xlsx)…');
  const xlsx = await svc.exportData('org-1', 'STUDENT', 'xlsx');
  const xlsxPath = path.join(tmp, 'students.xlsx');
  fs.writeFileSync(xlsxPath, xlsx);

  check('XLSX non-empty', xlsx.length > 500, `${xlsx.length} bytes`);
  check('XLSX has ZIP magic (PK\\x03\\x04)', xlsx.subarray(0, 4).toString('hex') === '504b0304');

  const zip = new AdmZip(xlsxPath);
  const names = zip.getEntries().map((e) => e.entryName);
  check('ZIP contains [Content_Types].xml', names.includes('[Content_Types].xml'));
  check('ZIP contains xl/workbook.xml', names.includes('xl/workbook.xml'));
  const sheetEntry = names.find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  check('ZIP contains a worksheet part', !!sheetEntry, sheetEntry ?? 'none');

  if (sheetEntry) {
    // ExcelJS stores cell strings in sharedStrings.xml, not inline in the sheet.
    const sheetXml = zip.readAsText(sheetEntry);
    const sharedXml = names.includes('xl/sharedStrings.xml') ? zip.readAsText('xl/sharedStrings.xml') : '';
    const combined = sheetXml + sharedXml;
    check('worksheet contains header "firstName"', combined.includes('firstName'));
    check('worksheet contains expected data "Ada"', combined.includes('Ada'));
    check('worksheet contains expected data "Lovelace"', combined.includes('Lovelace'));
    check('worksheet contains expected data "ada@example.com"', combined.includes('ada@example.com'));
  }
  const workbookXml = zip.readAsText('xl/workbook.xml');
  check('workbook declares the sheet name', workbookXml.includes('STUDENT'));

  // ---------------------------------------------------------------- PDF
  console.log('\n[PDF] generating via ImportExportService.exportData(STUDENT, pdf)…');
  const pdf = await svc.exportData('org-1', 'STUDENT', 'pdf');
  const pdfPath = path.join(tmp, 'students.pdf');
  fs.writeFileSync(pdfPath, pdf);

  check('PDF non-empty', pdf.length > 500, `${pdf.length} bytes`);
  check('PDF starts with %PDF- signature', pdf.subarray(0, 5).toString('ascii') === '%PDF-');
  const tail = pdf.subarray(Math.max(0, pdf.length - 1024)).toString('latin1');
  check('PDF has %%EOF marker', tail.includes('%%EOF'));

  // Content streams are Flate-compressed; inflate every stream and search the
  // decompressed text operators for the expected report content.
  const raw = pdf.toString('latin1');
  let decompressed = '';
  const re = /stream\r?\n?([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    try {
      decompressed += zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {
      /* stream not deflate-encoded — ignore */
    }
  }
  check('PDF has at least one decompressible content stream', decompressed.length > 0, `${decompressed.length} chars`);

  // pdfmake emits text as hex glyph strings inside TJ operators, e.g.
  // [<4578706f72> -40 <743a>] → decode each <…> fragment to ASCII and join.
  const decodedText = Array.from(decompressed.matchAll(/<([0-9A-Fa-f]+)>/g))
    .map((h) => {
      const hex = h[1].length % 2 === 1 ? h[1] + '0' : h[1];
      return Buffer.from(hex, 'hex').toString('latin1');
    })
    .join('');
  check('PDF text layer decodes to non-trivial content', decodedText.length > 20, `${decodedText.length} chars`);
  check('PDF contains report title text "Export:" + "STUDENT"', decodedText.includes('STUDENT'));
  check('PDF contains expected content "Ada"', decodedText.includes('Ada'));

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('');
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.length} check(s): ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('ALL EXPORT RUNTIME CHECKS PASSED');
  process.exit(0);
}

main().catch((e) => {
  console.error('RUNTIME ERROR:', e);
  process.exit(1);
});
