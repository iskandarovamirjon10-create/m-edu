const fs = require('fs');
const en = fs.readFileSync('apps/web/src/i18n/locales/en.ts', 'utf8');

const keys = en.match(/['"]inventory\.[^'"]+['"]/g) || [];
console.log('Existing inventory keys count:', keys.length);
console.log(keys.slice(0, 20));
