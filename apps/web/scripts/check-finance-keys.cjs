const fs = require('fs'), path = require('path');
const dir = 'src/i18n/locales';
function loadKeys(file) {
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const keys = [];
  const re = /['"]?([a-zA-Z0-9_.]+)['"]?\s*:\s*(['"`])((?:\\.|(?!\2)[\s\S])*)\2/g;
  let m;
  while ((m = re.exec(src))) keys.push(m[1]);
  return keys;
}
const en = new Set([...loadKeys('en.ts'), ...loadKeys('legacy-slices.ts'), ...loadKeys('analytics-slices.ts')]);
const batch = JSON.parse(fs.readFileSync(path.join(dir, '_pending', 'batch-finance.json'), 'utf8'));
const batchKeys = new Set(Object.keys(batch.keys));
for (const k of batchKeys) en.add(k);

const pages = ['Payments', 'Invoices', 'Payroll', 'Expenses', 'Certificates', 'Leads', 'Reports', 'ImportExport', 'Audit', 'AuditTimeline', 'Users'];
const NS = /^(common|payments|invoices|payroll|expenses|certificates|templates|leads|reports|importExport|audit|auditTimeline|users|enum|nav)\./;

const used = new Set();
for (const p of pages) {
  const src = fs.readFileSync(path.join('src/pages', p + '.tsx'), 'utf8');
  // t('key') and t("key")
  for (const m of src.matchAll(/(?<![a-zA-Z_$])t\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
  // any quoted string that looks like a namespaced key (covers label/map fields)
  for (const m of src.matchAll(/'([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)'/g)) {
    if (NS.test(m[1])) used.add(m[1]);
  }
}

// Dynamic key families used in code — enumerate all members.
const dyn = [];
// payments.method.* (Invoices pay modal + Payments page)
for (const x of ['CASH', 'CARD', 'BANK_TRANSFER', 'PAYME', 'CLICK', 'UZUM', 'OTHER', 'TRANSFER', 'ONLINE']) dyn.push('payments.method.' + x);
// invoice status map members + refund statuses
for (const x of ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'REFUNDED']) dyn.push('invoices.status.' + x);
for (const x of ['REQUESTED', 'PROCESSED', 'REJECTED']) dyn.push('invoices.refundStatus.' + x);
// payroll
for (const x of ['DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED']) dyn.push('payroll.status.' + x);
for (const x of ['MONTHLY', 'HOURLY', 'PER_LESSON']) dyn.push('payroll.salaryType.' + x);
for (let i = 1; i <= 12; i++) dyn.push('payroll.month.' + i);
// expense categories
for (const x of ['SALARY', 'RENT', 'UTILITIES', 'MARKETING', 'SUPPLIES', 'MAINTENANCE', 'SOFTWARE', 'TRAINING', 'OTHER']) dyn.push('expenses.category.' + x);
// lead stages
for (const x of ['NEW', 'CONTACTED', 'TRIAL_LESSON', 'WON', 'LOST']) dyn.push('leads.stage.' + x);
// report dims + statuses
for (const x of ['STUDENTS', 'ATTENDANCE', 'PAYMENTS', 'INVOICES', 'FINANCE', 'TEACHERS', 'GROUPS', 'EXPENSES', 'PAYROLL', 'LEADS']) dyn.push('reports.dim.' + x);
for (const x of ['READY', 'EMPTY', 'INSUFFICIENT_DATA']) dyn.push('reports.status.' + x);
// audit actions (non-enum members)
for (const x of ['RESTORE', 'LOGOUT', 'LOGIN_FAILED', 'BULK_UPDATE', 'PAYMENT_RECEIVED', 'ENROLLMENT_CREATED', 'ENROLLMENT_REVOKED', 'ATTENDANCE_RECORDED', 'GRADE_RECORDED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'WORKFLOW_TRIGGERED', 'WORKFLOW_COMPLETED', 'CUSTOM']) dyn.push('audit.action.' + x);
// import job statuses
for (const x of ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']) dyn.push('importExport.status.' + x);
// user roles + status
for (const x of ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER', 'ASSISTANT', 'STUDENT']) dyn.push('users.role.' + x);
for (const x of ['ACTIVE', 'INACTIVE']) dyn.push('users.status.' + x);
for (const k of dyn) used.add(k);

const sorted = [...used].sort();
const missing = sorted.filter(k => !en.has(k));
const extra = [...batchKeys].filter(k => !used.has(k)).sort();
const tmp = process.env.TEMP || process.env.TMP;
fs.writeFileSync(path.join(tmp, 'used_keys.txt'), sorted.join('\n'));
fs.writeFileSync(path.join(tmp, 'missing_keys.txt'), missing.join('\n'));
console.log('USED=' + sorted.length);
console.log('BATCH=' + batchKeys.size);
console.log('MISSING=' + missing.length);
console.log(missing.join('\n'));
console.log('EXTRA_IN_BATCH=' + extra.length);
console.log(extra.join('\n'));
