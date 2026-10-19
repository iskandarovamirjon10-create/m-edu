const fs = require('fs');
const file = 'apps/web/src/pages/ParentPortal.tsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace("import { motion } from 'framer-motion';\n", "");
src = src.replace("import { motion } from 'framer-motion';", "");

fs.writeFileSync(file, src, 'utf8');
console.log('Removed unused motion import in ParentPortal.tsx');
