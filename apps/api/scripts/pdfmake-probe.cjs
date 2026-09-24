const fs = require('fs');
const os = require('os');
const path = require('path');
const pdfmake = require('pdfmake');
pdfmake.setLocalAccessPolicy(() => true);
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setFonts({
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});
const doc = pdfmake.createPdf(
  {
    content: [
      { text: 'Export: STUDENT', style: 'header' },
      { table: { headerRows: 1, widths: ['auto'], body: [['Name'], ['Ada']] } },
    ],
    styles: { header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] } },
    defaultStyle: { font: 'Roboto', fontSize: 8 },
  },
);
doc
  .getBuffer()
  .then((buf) => {
    const tmpFile = path.join(os.tmpdir(), 'probe.pdf');
    fs.writeFileSync(tmpFile, buf);
    console.log('PDF_OK bytes=', buf.length, 'sig=', buf.subarray(0, 5).toString());
  })
  .catch((e) => {
    console.error('PDF_ERROR', e && e.message);
    process.exit(1);
  });
