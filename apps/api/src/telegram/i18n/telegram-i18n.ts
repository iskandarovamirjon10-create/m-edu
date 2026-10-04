/**
 * Server-side Telegram message catalogue (uz / ru / en).
 *
 * The product copy for the web app lives in `apps/web/src/i18n/locales`. The
 * API cannot import frontend modules (different build target, no bundler), so
 * this is the server-side half of the same catalogue. Key names deliberately
 * mirror the frontend `telegram.*` namespace so the two stay greppable
 * together. Do not add copy here that is not a Telegram bot string.
 *
 * Language resolution order (see `resolveLanguage`) is:
 *   M-EDU user preference -> organization language -> Telegram languageCode
 *   -> 'en'. The Telegram client's locale is only ever a fallback: it is
 * untrusted input and the M-EDU preference is authoritative.
 */

export type TelegramLanguage = 'uz' | 'ru' | 'en';

export const TELEGRAM_LANGUAGES: readonly TelegramLanguage[] = ['uz', 'ru', 'en'];

/** Map an arbitrary language code (e.g. Telegram's `language_code`) to ours. */
export function normalizeLanguage(value?: string | null): TelegramLanguage | null {
  if (!value) return null;
  const base = value.toLowerCase().split(/[-_]/)[0];
  if (base === 'uz' || base === 'ru' || base === 'en') return base;
  return null;
}

/**
 * Resolve the effective bot language.
 *
 * `preference` is the M-EDU user's stored language, `organization` the org
 * default, `telegramCode` the untrusted client locale.
 */
export function resolveLanguage(
  preference?: string | null,
  organization?: string | null,
  telegramCode?: string | null,
): TelegramLanguage {
  return (
    normalizeLanguage(preference) ??
    normalizeLanguage(organization) ??
    normalizeLanguage(telegramCode) ??
    'en'
  );
}

type Catalogue = Record<TelegramLanguage, Record<string, string>>;

const CATALOGUE: Catalogue = {
  en: {
    'common.none': '—',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.page': 'Page {page} of {total}',
    'common.more': 'Use the buttons below to browse.',

    'menu.title': '🏠 M-EDU menu',
    'menu.admin.title': '🛠️ Admin menu',
    'menu.teacher.title': '👨‍🏫 Teacher menu',
    'menu.student.title': '👨‍🎓 Student menu',
    'menu.parent.title': '👨‍👩‍👧 Parent menu',
    'menu.subtitle': 'Hello, {name}. What would you like to view?',

    'btn.menu': '🏠 Menu',
    'btn.back': '⬅️ Back',
    'btn.help': '❓ Help',
    'btn.profile': '👤 Profile',
    'btn.schedule': '📅 Schedule',
    'btn.attendance': '📝 Attendance',
    'btn.payments': '💰 Payments',
    'btn.notifications': '🔔 Notifications',
    'btn.settings': '⚙️ Settings',
    'btn.language': '🌐 Language',
    'btn.unlink': '🔌 Disconnect',
    'btn.categories': '🔔 Categories',
    'btn.quietHours': '🌙 Quiet hours',
    'btn.admin': '🛠️ Admin',
    'btn.teacher': '👨‍🏫 Teacher',
    'btn.children': '👨‍👩‍👧 My children',
    'btn.students': '👨‍🎓 Students',
    'btn.teachers': '👨‍🏫 Teachers',
    'btn.groups': '👥 Groups',
    'btn.reports': '📈 Reports',
    'btn.today': '📅 Today',
    'btn.myGroups': '👥 My groups',
    'btn.next': 'Next ➡️',
    'btn.prev': '⬅️ Previous',

    'profile.title': '👤 Profile',
    'profile.name': 'Name: {name}',
    'profile.email': 'Email: {email}',
    'profile.phone': 'Phone: {phone}',
    'profile.role': 'Role: {role}',
    'profile.balance': 'Balance: {balance}',
    'profile.groups': 'Groups: {groups}',
    'profile.children': 'Linked children: {count}',

    'schedule.title': '📅 Schedule',
    'schedule.empty': 'No schedule entries found.',
    'schedule.line': '{day} {start}-{end} · {group}{room}',

    'attendance.title': '📝 Attendance',
    'attendance.empty': 'No attendance records found.',
    'attendance.line': '{date} {status}{group}',
    'attendance.summary': 'Present: {present} · Absent: {absent} · Rate: {rate}',

    'payments.title': '💰 Payments',
    'payments.empty': 'No payments found.',
    'payments.line': '{date} {amount} {status}',
    'payments.balance': 'Outstanding balance: {balance}',

    'notifications.title': '🔔 Notifications',
    'notifications.empty': 'You have no notifications.',
    'notifications.unread': 'Unread: {count}',
    'notifications.line': '{date} {title}',

    'settings.title': '⚙️ Settings',
    'settings.linked': 'Telegram: connected{username}',
    'settings.language': 'Language: {language}',
    'settings.notifications': 'Telegram notifications: {state}',
    'settings.state.on': 'ON',
    'settings.state.off': 'OFF',
    'settings.quietHours': 'Quiet hours: {window}',
    'settings.quietHoursOff': 'Off',
    'settings.categories': 'Notification categories',
    'settings.categoriesTitle': '🔔 Notification categories',
    'settings.categoriesHint': 'Tap a category to turn its Telegram notifications on or off.',
    'settings.unavailable': 'These settings are not available for this account type.',
    'settings.saved': '✅ Settings updated.',
    'settings.hint': 'Changes are saved to your M-EDU account and apply immediately.',
    'settings.testNotification': '🔔 Test notification from M-EDU. Your Telegram integration is working.',

    'category.ATTENDANCE': 'Attendance',
    'category.PAYMENT': 'Payments',
    'category.DEBT': 'Debt alerts',
    'category.ACADEMIC': 'Academic',
    'category.CRM': 'CRM',
    'category.SYSTEM': 'System',
    'category.HOMEWORK': 'Homework',
    'category.EVENT': 'Events',

    'language.title': '🌐 Choose a language',
    'language.changed': 'Language updated to {language}.',
    'language.unsupported': 'Language switching is not available for this account type.',

    'children.title': '👨‍👩‍👧 My children',
    'children.select': 'Select a child:',
    'children.empty': 'No children are linked to this account.',

    'unlink.title': '🔌 Disconnect Telegram',
    'unlink.warning':
      'You will stop receiving M-EDU notifications in Telegram. Your M-EDU account stays active.',
    'unlink.confirm': 'Disconnect',
    'unlink.cancelled': 'Cancelled — nothing changed.',
    'unlink.done': '✅ Telegram has been disconnected from your M-EDU account.',

    // The first sentence is the assistant's canonical identity and is kept
    // verbatim in every language (it is also what AiService answers with).
    'copilot.title': '🤖 M-EDU AI Copilot',
    'copilot.description': '🤖 Ask the M-EDU AI Copilot',
    'copilot.intro': 'Salom! Men Amirjon Iskandarov tomonidan yaratilgan M-EDU AI Copilotman.',
    'copilot.introHint':
      'I help with M-EDU: students, groups, schedule, attendance and payments. Send me your question.',
    'copilot.usage': 'Usage: /copilot <your question>',
    'copilot.throttled':
      '⏳ Too many Copilot requests. Please wait a moment and try again.',
    'copilot.error': '⚠️ The Copilot is unavailable right now. Please try again later.',
    'btn.copilot': '🤖 Copilot',

    'help.title': '❓ Available commands',
    'help.hint': 'Send a command or open the menu.',

    'day.MONDAY': 'Mon',
    'day.TUESDAY': 'Tue',
    'day.WEDNESDAY': 'Wed',
    'day.THURSDAY': 'Thu',
    'day.FRIDAY': 'Fri',
    'day.SATURDAY': 'Sat',
    'day.SUNDAY': 'Sun',

    'error.generic': '⚠️ Something went wrong. Please try again.',
    'error.unauthorized': '⛔ You do not have access to that.',
    'error.not_found': '🔍 Not found.',
    'error.notLinked': '🔗 This chat is not linked to M-EDU.',
    'error.notLinkedHint': 'Open M-EDU → Settings → Integrations → Telegram to connect.',
    'error.disconnected': '🔌 This Telegram account has been disconnected.',
    'error.blocked': '⛔ This Telegram account is blocked. Contact your administrator.',
    'error.suspended': '⛔ This Telegram account is suspended. Contact your administrator.',
    'error.rateLimited': '⏳ Too many requests. Please slow down and try again shortly.',
    'error.invalidCallback': '⚠️ That button is no longer valid. Send /menu again.',
    'error.staleCallback': '⌛ That action expired. Send /menu and try again.',
    'error.unsupported': 'ℹ️ This command is not available for your role.',

    'start.linked': '✅ Your Telegram account is linked to M-EDU.',
    'start.invalidToken': '❌ This link is invalid or has expired. Generate a new link in M-EDU.',
    'start.conflict': '⚠️ This Telegram account is already linked to another M-EDU account.',
    'start.rateLimited': '⏳ Too many attempts. Please try again later.',
  },

  ru: {
    'common.none': '—',
    'common.yes': 'Да',
    'common.no': 'Нет',
    'common.page': 'Страница {page} из {total}',
    'common.more': 'Используйте кнопки ниже для навигации.',

    'menu.title': '🏠 Меню M-EDU',
    'menu.admin.title': '🛠️ Меню администратора',
    'menu.teacher.title': '👨‍🏫 Меню преподавателя',
    'menu.student.title': '👨‍🎓 Меню студента',
    'menu.parent.title': '👨‍👩‍👧 Меню родителя',
    'menu.subtitle': 'Здравствуйте, {name}. Что вы хотите посмотреть?',

    'btn.menu': '🏠 Меню',
    'btn.back': '⬅️ Назад',
    'btn.help': '❓ Помощь',
    'btn.profile': '👤 Профиль',
    'btn.schedule': '📅 Расписание',
    'btn.attendance': '📝 Посещаемость',
    'btn.payments': '💰 Платежи',
    'btn.notifications': '🔔 Уведомления',
    'btn.settings': '⚙️ Настройки',
    'btn.language': '🌐 Язык',
    'btn.unlink': '🔌 Отключить',
    'btn.categories': '🔔 Категории',
    'btn.quietHours': '🌙 Тихие часы',
    'btn.admin': '🛠️ Админ',
    'btn.teacher': '👨‍🏫 Преподаватель',
    'btn.children': '👨‍👩‍👧 Мои дети',
    'btn.students': '👨‍🎓 Студенты',
    'btn.teachers': '👨‍🏫 Преподаватели',
    'btn.groups': '👥 Группы',
    'btn.reports': '📈 Отчёты',
    'btn.today': '📅 Сегодня',
    'btn.myGroups': '👥 Мои группы',
    'btn.next': 'Далее ➡️',
    'btn.prev': '⬅️ Назад',

    'profile.title': '👤 Профиль',
    'profile.name': 'Имя: {name}',
    'profile.email': 'Email: {email}',
    'profile.phone': 'Телефон: {phone}',
    'profile.role': 'Роль: {role}',
    'profile.balance': 'Баланс: {balance}',
    'profile.groups': 'Группы: {groups}',
    'profile.children': 'Детей привязано: {count}',

    'schedule.title': '📅 Расписание',
    'schedule.empty': 'Записи расписания не найдены.',
    'schedule.line': '{day} {start}-{end} · {group}{room}',

    'attendance.title': '📝 Посещаемость',
    'attendance.empty': 'Записи о посещаемости не найдены.',
    'attendance.line': '{date} {status}{group}',
    'attendance.summary': 'Присутствовал: {present} · Отсутствовал: {absent} · Процент: {rate}',

    'payments.title': '💰 Платежи',
    'payments.empty': 'Платежи не найдены.',
    'payments.line': '{date} {amount} {status}',
    'payments.balance': 'Текущая задолженность: {balance}',

    'notifications.title': '🔔 Уведомления',
    'notifications.empty': 'У вас нет уведомлений.',
    'notifications.unread': 'Непрочитанных: {count}',
    'notifications.line': '{date} {title}',

    'settings.title': '⚙️ Настройки',
    'settings.linked': 'Telegram: подключён{username}',
    'settings.language': 'Язык: {language}',
    'settings.notifications': 'Уведомления в Telegram: {state}',
    'settings.state.on': 'ВКЛ',
    'settings.state.off': 'ВЫКЛ',
    'settings.quietHours': 'Тихие часы: {window}',
    'settings.quietHoursOff': 'Выключены',
    'settings.categories': 'Категории уведомлений',
    'settings.categoriesTitle': '🔔 Категории уведомлений',
    'settings.categoriesHint': 'Нажмите категорию, чтобы включить или выключить уведомления в Telegram.',
    'settings.unavailable': 'Эти настройки недоступны для данного типа аккаунта.',
    'settings.saved': '✅ Настройки обновлены.',
    'settings.hint': 'Изменения сохраняются в вашем аккаунте M-EDU и применяются сразу.',
    'settings.testNotification': '🔔 Тестовое уведомление от M-EDU. Интеграция с Telegram работает.',

    'category.ATTENDANCE': 'Посещаемость',
    'category.PAYMENT': 'Платежи',
    'category.DEBT': 'Задолженность',
    'category.ACADEMIC': 'Учёба',
    'category.CRM': 'CRM',
    'category.SYSTEM': 'Система',
    'category.HOMEWORK': 'Домашние задания',
    'category.EVENT': 'События',

    'language.title': '🌐 Выберите язык',
    'language.changed': 'Язык изменён на {language}.',
    'language.unsupported': 'Смена языка недоступна для этого типа аккаунта.',

    'children.title': '👨‍👩‍👧 Мои дети',
    'children.select': 'Выберите ребёнка:',
    'children.empty': 'К этому аккаунту не привязаны дети.',

    'unlink.title': '🔌 Отключить Telegram',
    'unlink.warning':
      'Вы перестанете получать уведомления M-EDU в Telegram. Аккаунт M-EDU останется активным.',
    'unlink.confirm': 'Отключить',
    'unlink.cancelled': 'Отменено — ничего не изменено.',
    'unlink.done': '✅ Telegram отключён от вашего аккаунта M-EDU.',

    // Identity sentence is intentionally identical in all catalogues.
    'copilot.title': '🤖 M-EDU AI Copilot',
    'copilot.description': '🤖 Спросить M-EDU AI Copilot',
    'copilot.intro': 'Salom! Men Amirjon Iskandarov tomonidan yaratilgan M-EDU AI Copilotman.',
    'copilot.introHint':
      'Я помогаю по M-EDU: студенты, группы, расписание, посещаемость и платежи. Задайте вопрос.',
    'copilot.usage': 'Использование: /copilot <ваш вопрос>',
    'copilot.throttled': '⏳ Слишком много запросов к Copilot. Подождите немного.',
    'copilot.error': '⚠️ Copilot сейчас недоступен. Попробуйте позже.',
    'btn.copilot': '🤖 Copilot',

    'help.title': '❓ Доступные команды',
    'help.hint': 'Отправьте команду или откройте меню.',

    'day.MONDAY': 'Пн',
    'day.TUESDAY': 'Вт',
    'day.WEDNESDAY': 'Ср',
    'day.THURSDAY': 'Чт',
    'day.FRIDAY': 'Пт',
    'day.SATURDAY': 'Сб',
    'day.SUNDAY': 'Вс',

    'error.generic': '⚠️ Что-то пошло не так. Попробуйте ещё раз.',
    'error.unauthorized': '⛔ У вас нет доступа к этому.',
    'error.not_found': '🔍 Не найдено.',
    'error.notLinked': '🔗 Этот чат не привязан к M-EDU.',
    'error.notLinkedHint': 'Откройте M-EDU → Настройки → Интеграции → Telegram.',
    'error.disconnected': '🔌 Этот Telegram-аккаунт отключён.',
    'error.blocked': '⛔ Этот Telegram-аккаунт заблокирован. Свяжитесь с администратором.',
    'error.suspended': '⛔ Этот Telegram-аккаунт приостановлен. Свяжитесь с администратором.',
    'error.rateLimited': '⏳ Слишком много запросов. Подождите немного.',
    'error.invalidCallback': '⚠️ Кнопка больше недействительна. Отправьте /menu.',
    'error.staleCallback': '⌛ Действие устарело. Отправьте /menu и попробуйте снова.',
    'error.unsupported': 'ℹ️ Эта команда недоступна для вашей роли.',

    'start.linked': '✅ Ваш Telegram привязан к M-EDU.',
    'start.invalidToken': '❌ Ссылка недействительна или истекла. Создайте новую в M-EDU.',
    'start.conflict': '⚠️ Этот Telegram уже привязан к другому аккаунту M-EDU.',
    'start.rateLimited': '⏳ Слишком много попыток. Попробуйте позже.',
  },

  uz: {
    'common.none': '—',
    'common.yes': 'Ha',
    'common.no': "Yo'q",
    'common.page': '{page}-sahifa / {total}',
    'common.more': "Navigatsiya uchun quyidagi tugmalardan foydalaning.",

    'menu.title': '🏠 M-EDU menyusi',
    'menu.admin.title': '🛠️ Administrator menyusi',
    'menu.teacher.title': "👨‍🏫 O'qituvchi menyusi",
    'menu.student.title': '👨‍🎓 Student menyusi',
    'menu.parent.title': '👨‍👩‍👧 Ota-ona menyusi',
    'menu.subtitle': 'Salom, {name}. Nimani ko‘rmoqchisiz?',

    'btn.menu': '🏠 Menyu',
    'btn.back': '⬅️ Orqaga',
    'btn.help': '❓ Yordam',
    'btn.profile': '👤 Profil',
    'btn.schedule': '📅 Jadval',
    'btn.attendance': '📝 Davomat',
    'btn.payments': "💰 To'lovlar",
    'btn.notifications': '🔔 Bildirishnomalar',
    'btn.settings': '⚙️ Sozlamalar',
    'btn.language': '🌐 Til',
    'btn.unlink': '🔌 Uzish',
    'btn.categories': '🔔 Toifalar',
    'btn.quietHours': '🌙 Tinch soatlar',
    'btn.admin': '🛠️ Admin',
    'btn.teacher': "👨‍🏫 O'qituvchi",
    'btn.children': '👨‍👩‍👧 Farzandlarim',
    'btn.students': '👨‍🎓 Studentlar',
    'btn.teachers': "👨‍🏫 O'qituvchilar",
    'btn.groups': '👥 Guruhlar',
    'btn.reports': '📈 Hisobotlar',
    'btn.today': '📅 Bugun',
    'btn.myGroups': '👥 Guruhlarim',
    'btn.next': 'Keyingi ➡️',
    'btn.prev': '⬅️ Oldingi',

    'profile.title': '👤 Profil',
    'profile.name': 'Ism: {name}',
    'profile.email': 'Email: {email}',
    'profile.phone': 'Telefon: {phone}',
    'profile.role': 'Rol: {role}',
    'profile.balance': 'Balans: {balance}',
    'profile.groups': 'Guruhlar: {groups}',
    'profile.children': 'Bog‘langan farzandlar: {count}',

    'schedule.title': '📅 Jadval',
    'schedule.empty': 'Jadval yozuvlari topilmadi.',
    'schedule.line': '{day} {start}-{end} · {group}{room}',

    'attendance.title': '📝 Davomat',
    'attendance.empty': 'Davomat yozuvlari topilmadi.',
    'attendance.line': '{date} {status}{group}',
    'attendance.summary': 'Kelgan: {present} · Kelmagan: {absent} · Foiz: {rate}',

    'payments.title': "💰 To'lovlar",
    'payments.empty': "To'lovlar topilmadi.",
    'payments.line': '{date} {amount} {status}',
    'payments.balance': 'Qarz: {balance}',

    'notifications.title': '🔔 Bildirishnomalar',
    'notifications.empty': 'Sizda bildirishnomalar yo‘q.',
    'notifications.unread': "O'qilmagan: {count}",
    'notifications.line': '{date} {title}',

    'settings.title': '⚙️ Sozlamalar',
    'settings.linked': 'Telegram: ulangan{username}',
    'settings.language': 'Til: {language}',
    'settings.notifications': 'Telegram bildirishnomalari: {state}',
    'settings.state.on': 'YONIQ',
    'settings.state.off': "O'CHIQ",
    'settings.quietHours': 'Tinch soatlar: {window}',
    'settings.quietHoursOff': "O'chiq",
    'settings.categories': 'Bildirishnoma toifalari',
    'settings.categoriesTitle': '🔔 Bildirishnoma toifalari',
    'settings.categoriesHint': "Toifani bosib, Telegram bildirishnomalarini yoqing yoki o‘chiring.",
    'settings.unavailable': 'Bu sozlamalar ushbu hisob turi uchun mavjud emas.',
    'settings.saved': '✅ Sozlamalar yangilandi.',
    'settings.hint': "O‘zgarishlar M-EDU hisobingizda saqlanadi va darhol qo‘llanadi.",
    'settings.testNotification': '🔔 M-EDU dan sinov bildirishnomasi. Telegram integratsiyasi ishlayapti.',

    'category.ATTENDANCE': 'Davomat',
    'category.PAYMENT': "To'lovlar",
    'category.DEBT': 'Qarz',
    'category.ACADEMIC': "O'quv",
    'category.CRM': 'CRM',
    'category.SYSTEM': 'Tizim',
    'category.HOMEWORK': 'Uy vazifasi',
    'category.EVENT': 'Tadbirlar',

    'language.title': '🌐 Tilni tanlang',
    'language.changed': 'Til {language} ga o‘zgartirildi.',
    'language.unsupported': 'Bu turdagi hisob uchun tilni o‘zgartirish mumkin emas.',

    'children.title': '👨‍👩‍👧 Farzandlarim',
    'children.select': 'Farzandni tanlang:',
    'children.empty': 'Bu hisobga farzand bog‘lanmagan.',

    'unlink.title': '🔌 Telegramni uzish',
    'unlink.warning':
      'Telegramda M-EDU bildirishnomalarini olishni to‘xtatasiz. M-EDU hisobingiz faol qoladi.',
    'unlink.confirm': 'Uzish',
    'unlink.cancelled': 'Bekor qilindi — hech narsa o‘zgarmadi.',
    'unlink.done': '✅ Telegram M-EDU hisobingizdan uzildi.',

    // Identity sentence is intentionally identical in all catalogues.
    'copilot.title': '🤖 M-EDU AI Copilot',
    'copilot.description': '🤖 M-EDU AI Copilotga savol bering',
    'copilot.intro': 'Salom! Men Amirjon Iskandarov tomonidan yaratilgan M-EDU AI Copilotman.',
    'copilot.introHint':
      "Men M-EDU bo'yicha yordam beraman: studentlar, guruhlar, dars jadvali, davomat va to'lovlar. Savolingizni yuboring.",
    'copilot.usage': 'Foydalanish: /copilot <savolingiz>',
    'copilot.throttled': "⏳ Copilot so'rovi juda ko'p. Biroz kuting va qayta urinib ko'ring.",
    'copilot.error': '⚠️ Copilot hozircha mavjud emas. Keyinroq urinib koʻring.',
    'btn.copilot': '🤖 Copilot',

    'help.title': '❓ Mavjud buyruqlar',
    'help.hint': 'Buyruq yuboring yoki menyuni oching.',

    'day.MONDAY': 'Du',
    'day.TUESDAY': 'Se',
    'day.WEDNESDAY': 'Ch',
    'day.THURSDAY': 'Pa',
    'day.FRIDAY': 'Ju',
    'day.SATURDAY': 'Sh',
    'day.SUNDAY': 'Ya',

    'error.generic': '⚠️ Nimadir xato ketdi. Qayta urinib ko‘ring.',
    'error.unauthorized': '⛔ Sizda bunga ruxsat yo‘q.',
    'error.not_found': '🔍 Topilmadi.',
    'error.notLinked': '🔗 Bu chat M-EDU ga bog‘lanmagan.',
    'error.notLinkedHint': 'M-EDU → Sozlamalar → Integratsiyalar → Telegram orqali ulan.',
    'error.disconnected': '🔌 Bu Telegram hisobi uzilgan.',
    'error.blocked': '⛔ Bu Telegram hisobi bloklangan. Administratorga murojaat qiling.',
    'error.suspended': "⛔ Bu Telegram hisobi to'xtatilgan. Administratorga murojaat qiling.",
    'error.rateLimited': '⏳ Juda ko‘p so‘rov. Birozdan so‘ng urinib ko‘ring.',
    'error.invalidCallback': '⚠️ Bu tugma endi amal qilmaydi. /menu yuboring.',
    'error.staleCallback': '⌛ Amal muddati tugadi. /menu yuborib qayta urining.',
    'error.unsupported': 'ℹ️ Bu buyruq sizning rolingiz uchun mavjud emas.',

    'start.linked': '✅ Telegram hisobingiz M-EDU ga bog‘landi.',
    'start.invalidToken': '❌ Havola yaroqsiz yoki muddati tugagan. M-EDU da yangisini yarating.',
    'start.conflict': '⚠️ Bu Telegram boshqa M-EDU hisobiga bog‘langan.',
    'start.rateLimited': '⏳ Juda ko‘p urinish. Keyinroq urinib ko‘ring.',
  },
};

/**
 * Translate a key, interpolating `{param}` placeholders.
 *
 * Unknown keys/languages fall back to English, then to the raw key, so a
 * missing translation can never produce an empty bot message.
 */
export function t(
  lang: TelegramLanguage,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = CATALOGUE[lang]?.[key] ?? CATALOGUE.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Exported for tests: every language must expose the same key set. */
export function catalogueKeys(lang: TelegramLanguage): string[] {
  return Object.keys(CATALOGUE[lang]).sort();
}
