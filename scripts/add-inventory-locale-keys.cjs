const fs = require('fs');

// 1. English
{
  const file = 'apps/web/src/i18n/locales/pages-slices.ts';
  let content = fs.readFileSync(file, 'utf8');
  const enKeys = `  'common.items': 'Items',
  'inventory.col.status': 'Status',
  'inventory.deleteTitle': 'Delete Item',
  'inventory.deleteMessage': 'Are you sure you want to delete this inventory item?',
  'inventory.emptyTitle': 'No inventory items yet',
  'inventory.emptyDescription': 'Add your first inventory item to track supplies and equipment.',
  'inventory.valuation': 'Total Valuation',
`;
  content = content.replace("export const pagesEn = {\n", `export const pagesEn = {\n${enKeys}`);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated pages-slices.ts (en)');
}

// 2. Uzbek
{
  const file = 'apps/web/src/i18n/locales/pages-slices.uz.ts';
  let content = fs.readFileSync(file, 'utf8');
  const uzKeys = `  'common.items': 'Mahsulotlar',
  'inventory.col.status': 'Holat',
  'inventory.deleteTitle': 'Mahsulotni o‘chirish',
  'inventory.deleteMessage': 'Ushbu mahsulotni o‘chirishni tasdiqlaysizmi?',
  'inventory.emptyTitle': 'Hozircha inventar mavjud emas',
  'inventory.emptyDescription': 'Jihoz va resurslarni kuzatish uchun mahsulot qo‘shing.',
  'inventory.valuation': 'Umumiy qiymati',
`;
  content = content.replace("export const pagesUz = {\n", `export const pagesUz = {\n${uzKeys}`);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated pages-slices.uz.ts (uz)');
}

// 3. Russian
{
  const file = 'apps/web/src/i18n/locales/pages-slices.ru.ts';
  let content = fs.readFileSync(file, 'utf8');
  const ruKeys = `  'common.items': 'Предметы',
  'inventory.col.status': 'Статус',
  'inventory.deleteTitle': 'Удалить предмет',
  'inventory.deleteMessage': 'Вы уверены, что хотите удалить этот предмет инвентаря?',
  'inventory.emptyTitle': 'Инвентарь пуст',
  'inventory.emptyDescription': 'Добавьте первый предмет для учета оборудования и ресурсов.',
  'inventory.valuation': 'Общая стоимость',
`;
  content = content.replace("export const pagesRu = {\n", `export const pagesRu = {\n${ruKeys}`);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated pages-slices.ru.ts (ru)');
}
