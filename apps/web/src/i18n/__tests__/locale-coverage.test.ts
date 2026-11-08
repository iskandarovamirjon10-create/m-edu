/**
 * Regression tests for the Pages that shipped hardcoded English (BUG-006/007).
 *
 * Every key the Certificates and Payments screens reference must exist in all
 * three dictionaries, and the Uzbek/Russian entries must actually differ from
 * English (a copied English string is still "untranslated" for the user).
 */
import { describe, it, expect } from 'vitest';
import en from '../locales/en';
import uz from '../locales/uz';
import ru from '../locales/ru';

const DICTS: Record<string, Record<string, string>> = {
  en: en as unknown as Record<string, string>,
  uz: uz as unknown as Record<string, string>,
  ru: ru as unknown as Record<string, string>,
};

const CERTIFICATE_KEYS = [
  'certificates.title',
  'certificates.subtitle',
  'certificates.loading',
  'certificates.loadErrorSubtitle',
  'certificates.tab.certificates',
  'certificates.tab.templates',
  'certificates.generate',
  'certificates.generated',
  'certificates.downloaded',
  'certificates.downloading',
  'certificates.downloadPdf',
  'certificates.searchPlaceholder',
  'certificates.empty',
  'certificates.emptySearch',
  'certificates.emptyHint',
  'certificates.emptySearchHint',
  'certificates.col.student',
  'certificates.col.course',
  'certificates.col.number',
  'certificates.col.verification',
  'certificates.col.issued',
  'certificates.col.actions',
  'certificates.field.student',
  'certificates.field.course',
  'certificates.field.notes',
  'certificates.notesPlaceholder',
  'certificates.selectStudent',
  'certificates.selectCourse',
  'certificates.studentRequired',
  'certificates.courseRequired',
  'certificates.generateTitle',
  'certificates.generateNote',
  'certificates.generateSubmit',
  'certificates.templateOverlay',
  'certificates.templateOverlayHint',
  'certificates.systemDefaultTemplate',
  'certificates.templates.loading',
  'certificates.templates.empty',
  'certificates.templates.emptyHint',
  'certificates.template.new',
  'certificates.template.col.name',
  'certificates.template.col.status',
  'certificates.template.col.created',
  'certificates.template.systemDefault',
  'certificates.template.makeDefault',
  'certificates.template.edit',
  'certificates.template.name',
  'certificates.template.namePlaceholder',
  'certificates.template.html',
  'certificates.template.injectable',
  'certificates.template.css',
  'certificates.template.setDefault',
  'certificates.template.setDefaultHint',
  'certificates.template.compiling',
  'certificates.template.save',
  'certificates.template.create',
  'certificates.template.editTitle',
  'certificates.template.newTitle',
  'certificates.template.deleteTitle',
  'certificates.template.deleteConfirm',
  'certificates.template.deleteWarning',
  'certificates.template.purging',
  'certificates.template.deleteForever',
  'certificates.template.created',
  'certificates.template.updated',
  'certificates.template.defaultUpdated',
  'certificates.template.deleted',
  'certificates.validation.templateNameRequired',
  'certificates.validation.htmlRequired',
  'certificates.validation.htmlTooLong',
  'certificates.validation.cssTooLong',
];

const PAYMENT_KEYS = [
  'payments.title',
  'payments.subtitle',
  'payments.loading',
  'payments.loadError',
  'payments.add',
  'payments.searchPlaceholder',
  'payments.allStatuses',
  'payments.allStudents',
  'payments.created',
  'payments.updated',
  'payments.deleted',
  'payments.countOne',
  'payments.countMany',
  'payments.empty',
  'payments.emptyFiltered',
  'payments.emptyHint',
  'payments.emptyFilteredHint',
  'payments.col.student',
  'payments.col.description',
  'payments.col.status',
  'payments.col.amount',
  'payments.col.actions',
  'payments.status.PAID',
  'payments.status.PENDING',
  'payments.status.OVERDUE',
  'payments.status.CANCELLED',
  'payments.method.CASH',
  'payments.method.CARD',
  'payments.method.TRANSFER',
  'payments.method.ONLINE',
  'payments.saving',
  'payments.deleteConfirm',
  'payments.form.title',
  'payments.form.student',
  'payments.form.selectStudent',
  'payments.form.amount',
  'payments.form.method',
  'payments.form.dueDate',
  'payments.form.description',
  'payments.form.descriptionHint',
  'payments.form.descriptionPlaceholder',
  'payments.processing',
  'payments.validation.studentRequired',
  'payments.validation.amountPositive',
  'payments.validation.amountTooLarge',
  'payments.validation.dueDatePast',
];

const REQUIRED_KEYS = [...CERTIFICATE_KEYS, ...PAYMENT_KEYS];

describe('locale coverage — Certificates & Payments', () => {
  it.each(Object.keys(DICTS))('%s dictionary defines every screen key', (locale) => {
    const dict = DICTS[locale];
    const missing = REQUIRED_KEYS.filter((key) => !dict[key]);
    expect(missing).toEqual([]);
  });

  it.each(['uz', 'ru'])('%s actually translates the visible labels (not English copies)', (locale) => {
    const dict = DICTS[locale];
    const enDict = DICTS.en;
    const untranslated = REQUIRED_KEYS.filter((key) => dict[key] === enDict[key]);
    // Templates/technical placeholders may legitimately match; assert the bulk
    // are distinct rather than requiring every single key to differ.
    expect(untranslated.length).toBeLessThan(REQUIRED_KEYS.length * 0.15);
  });
});

/**
 * DS-05: the block above only covers the hand-listed Certificates + Payments
 * keys (~105 of the dictionary). This block enforces full parity over every
 * key that any locale defines, so a key added to `en` but forgotten in `uz`
 * (or vice versa) fails CI instead of silently falling back at runtime.
 */
describe('locale parity — full dictionary', () => {
  const locales = Object.keys(DICTS) as Array<keyof typeof DICTS>;
  const allKeys = Array.from(
    new Set(locales.flatMap((locale) => Object.keys(DICTS[locale]))),
  ).sort();

  it('has a non-trivial dictionary (guards against an empty/broken import)', () => {
    expect(allKeys.length).toBeGreaterThan(1000);
  });

  it.each(locales)('%s defines every key present in any locale', (locale) => {
    const missing = allKeys.filter((key) => !DICTS[locale][key]);
    expect(missing).toEqual([]);
  });

  it.each(locales)('%s defines no key the other locales do not', (locale) => {
    const others = locales.filter((other) => other !== locale);
    const extra = Object.keys(DICTS[locale]).filter(
      (key) => !others.some((other) => DICTS[other][key]),
    );
    expect(extra).toEqual([]);
  });
});
