/**
 * Uzbek dictionary (oʻzbekcha).
 *
 * Keys mirror en.ts 1:1. Missing keys fall back to English at runtime and
 * warn in development — keep this file in sync with en.ts.
 */
const uz = {
  // Common
  'common.cancel': 'Bekor qilish',
  'common.save': 'Saqlash',
  'common.create': 'Yaratish',
  'common.edit': 'Tahrirlash',
  'common.delete': 'Oʻchirish',
  'common.search': 'Qidirish',
  'common.loading': 'Yuklanmoqda…',
  'common.saving': 'Saqlanmoqda…',
  'common.retry': 'Qayta urinish',
  'common.error': 'Xatolik yuz berdi',
  'common.actions': 'Amallar',
  'common.status': 'Holat',
  'common.name': 'Nomi',
  'common.date': 'Sana',
  'common.close': 'Yopish',

  // Navigation
  'nav.dashboard': 'Boshqaruv paneli',
  'nav.students': 'Oʻquvchilar',
  'nav.teachers': 'Oʻqituvchilar',
  'nav.groups': 'Guruhlar',
  'nav.courses': 'Kurslar',
  'nav.schedule': 'Jadval',
  'nav.attendance': 'Davomat',
  'nav.payments': 'Toʻlovlar',
  'nav.certificates': 'Sertifikatlar',
  'nav.library': 'Kutubxona',
  'nav.inventory': 'Ombor',
  'nav.settings': 'Sozlamalar',
  'nav.logout': 'Chiqish',
  'nav.language': 'Til',

  // Auth
  'auth.loginTitle': 'Hisobingizga kirish',
  'auth.email': 'Email',
  'auth.password': 'Parol',
  'auth.login': 'Kirish',
  'auth.loggingIn': 'Kirilmoqda…',
  'auth.forgotPassword': 'Parolni unutdingizmi?',
  'auth.invalidCredentials': 'Email yoki parol xato',

  // Dashboard
  'dashboard.title': 'Boshqaruv paneli',
  'dashboard.subtitle': 'Tashkotingiz umumiy koʻrinishi',
  'dashboard.totalStudents': 'Jami oʻquvchilar',
  'dashboard.totalTeachers': 'Jami oʻqituvchilar',
  'dashboard.activeGroups': 'Faol guruhlar',
  'dashboard.monthlyRevenue': 'Oylik daromad',

  // Certificates page
  'certificates.title': 'Sertifikatlar',
  'certificates.subtitle': 'Oʻquvchi sertifikatlari va shablonlarini boshqarish',
  'certificates.tab.certificates': 'Sertifikatlar',
  'certificates.tab.templates': 'Shablonlar',
  'certificates.generate': 'Sertifikat berish',
  'certificates.generating': 'Berilmoqda…',
  'certificates.generated': 'Sertifikat berildi',
  'certificates.download': 'Yuklab olish',
  'certificates.downloading': 'Yuklanmoqda…',
  'certificates.downloaded': 'Sertifikat yuklab olindi',
  'certificates.searchPlaceholder': 'Oʻquvchi, kurs yoki tasdiqlash kodi boʻyicha qidirish…',
  'certificates.empty': 'Hozircha sertifikat yoʻq',
  'certificates.emptySearch': 'Sertifikat topilmadi',
  'certificates.emptySearchHint': 'Qidiruv shartlarini oʻzgartirib koʻring',
  'certificates.emptyHint': 'Boshlash uchun birinchi sertifikatni bering',
  'certificates.col.student': 'Oʻquvchi',
  'certificates.col.course': 'Kurs',
  'certificates.col.number': 'Sertifikat №',
  'certificates.col.verification': 'Tasdiqlash',
  'certificates.col.issued': 'Berilgan sana',
  'certificates.selectStudent': 'Oʻquvchini tanlang',
  'certificates.selectCourse': 'Kursni tanlang',
  'certificates.field.student': 'Oʻquvchi *',
  'certificates.field.course': 'Kurs *',
  'certificates.field.notes': 'Izohlar',
  'certificates.notesPlaceholder': 'Sertifikat bilan saqlanadigan ixtiyoriy izohlar',
  'certificates.studentRequired': 'Oʻquvchi tanlanishi shart',
  'certificates.courseRequired': 'Kurs tanlanishi shart',
  'certificates.generateHint':
    'Sertifikat tanlangan oʻquvchi va kurs uchun beriladi. Oʻquvchi shu kursning faol guruhida oʻqishi kerak.',

  // Certificate templates
  'templates.new': 'Yangi shablon',
  'templates.empty': 'Hozircha shablon yoʻq',
  'templates.emptyHint': 'Sertifikat koʻrinishini belgilash uchun shablon yarating.',
  'templates.col.name': 'Nomi',
  'templates.col.default': 'Standart',
  'templates.col.created': 'Yaratilgan',
  'templates.badge.default': 'Standart',
  'templates.makeDefault': 'Standart qilish',
  'templates.defaultUpdated': 'Standart shablon yangilandi',
  'templates.edit': 'Shablonni tahrirlash: {name}',
  'templates.createTitle': 'Yangi shablon',
  'templates.field.name': 'Shablon nomi *',
  'templates.field.html': 'Shablon HTML *',
  'templates.field.css': 'Maxsus CSS',
  'templates.field.isDefault': 'Tashkot standart shabloni qilib belgilash',
  'templates.namePlaceholder': 'masalan. Oltin yutuq',
  'templates.nameRequired': 'Shablon nomi talab qilinadi',
  'templates.htmlRequired': 'Shablon HTML talab qilinadi',
  'templates.htmlTooLong': 'Shablon HTML koʻpi bilan 100 000 belgi boʻlishi kerak',
  'templates.cssTooLong': 'CSS koʻpi bilan 50 000 belgi boʻlishi kerak',
  'templates.created': 'Shablon yaratildi',
  'templates.updated': 'Shablon yangilandi',
  'templates.saving': 'Saqlanmoqda…',
  'templates.saveChanges': 'Oʻzgarishlarni saqlash',
  'templates.deleteTitle': 'Shablonni oʻchirish',
  'templates.deleteConfirm': '{name} shablonini oʻchirasizmi? Buni qaytarib boʻlmaydi.',
  'templates.deleteHint':
    'Berilgan sertifikatlarda ishlatilgan shablonlarni oʻchirib boʻlmaydi — sertifikat tarixini saqlash uchun API soʻrovni rad etadi.',
  'templates.deleting': 'Oʻchirilmoqda…',
  'templates.deleteAction': 'Shablonni oʻchirish',
  'templates.deleted': 'Shablon oʻchirildi',
  'templates.variablesHint': 'Mavjud oʻzgaruvchilar: {variables}. Qiymatlar render paytida avtomatik HTML-escape qilinadi.',

  // Settings / language
  'settings.title': 'Sozlamalar',
  'settings.language': 'Til',
  'settings.languageHint': 'Interfeys tilini tanlang. Tanlov shu qurilmada saqlanadi.',

  // Errors
  'error.network': 'Tarmoq xatosi — ulanishni tekshirib qayta urinib koʻring',
  'error.unauthorized': 'Sessiyangiz muddati tugadi. Iltimos, qaytadan kiring.',
  'error.forbidden': 'Bu amalni bajarish uchun ruxsatingiz yoʻq',
  'error.notFound': 'Soʻralgan resurs topilmadi',
  'error.server': 'Server xatosi — keyinroq qayta urinib koʻring',
};

export default uz;
