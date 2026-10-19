const fs = require('fs');
const file = 'apps/web/src/pages/Inventory.tsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace('import { motion, AnimatePresence, type Variants } from \'framer-motion\';', 'import { motion, type Variants } from \'framer-motion\';');
src = src.replace('  GlassBadge,\n', '');
src = src.replace(
  `      <ConfirmDialog
        open={!!deleteTarget}
        title={t('inventory.deleteTitle')}
        message={t('inventory.deleteMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />`,
  `      <ConfirmDialog
        open={!!deleteTarget}
        title={t('inventory.deleteTitle')}
        description={t('inventory.deleteMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />`
);

fs.writeFileSync(file, src, 'utf8');
console.log('Fixed Inventory.tsx');
