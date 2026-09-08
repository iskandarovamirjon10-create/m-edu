/**
 * Russian dictionary (русский).
 *
 * Keys mirror en.ts 1:1. Missing keys fall back to English at runtime and
 * warn in development — keep this file in sync with en.ts.
 */
const ru = {
  // Common
  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',
  'common.create': 'Создать',
  'common.edit': 'Редактировать',
  'common.delete': 'Удалить',
  'common.search': 'Поиск',
  'common.loading': 'Загрузка…',
  'common.saving': 'Сохранение…',
  'common.retry': 'Повторить',
  'common.error': 'Произошла ошибка',
  'common.actions': 'Действия',
  'common.status': 'Статус',
  'common.name': 'Название',
  'common.date': 'Дата',
  'common.close': 'Закрыть',

  // Navigation
  'nav.dashboard': 'Панель управления',
  'nav.students': 'Ученики',
  'nav.teachers': 'Учителя',
  'nav.groups': 'Группы',
  'nav.courses': 'Курсы',
  'nav.schedule': 'Расписание',
  'nav.attendance': 'Посещаемость',
  'nav.payments': 'Платежи',
  'nav.certificates': 'Сертификаты',
  'nav.library': 'Библиотека',
  'nav.inventory': 'Склад',
  'nav.settings': 'Настройки',
  'nav.logout': 'Выйти',
  'nav.language': 'Язык',

  // Auth
  'auth.loginTitle': 'Вход в ваш аккаунт',
  'auth.email': 'Email',
  'auth.password': 'Пароль',
  'auth.login': 'Войти',
  'auth.loggingIn': 'Вход…',
  'auth.forgotPassword': 'Забыли пароль?',
  'auth.invalidCredentials': 'Неверный email или пароль',

  // Dashboard
  'dashboard.title': 'Панель управления',
  'dashboard.subtitle': 'Обзор вашей организации',
  'dashboard.totalStudents': 'Всего учеников',
  'dashboard.totalTeachers': 'Всего учителей',
  'dashboard.activeGroups': 'Активные группы',
  'dashboard.monthlyRevenue': 'Доход за месяц',

  // Certificates page
  'certificates.title': 'Сертификаты',
  'certificates.subtitle': 'Управление сертификатами и шаблонами учеников',
  'certificates.tab.certificates': 'Сертификаты',
  'certificates.tab.templates': 'Шаблоны',
  'certificates.generate': 'Выдать сертификат',
  'certificates.generating': 'Выдача…',
  'certificates.generated': 'Сертификат выдан',
  'certificates.download': 'Скачать',
  'certificates.downloading': 'Скачивание…',
  'certificates.downloaded': 'Сертификат скачан',
  'certificates.searchPlaceholder': 'Поиск по имени ученика, курсу или коду подтверждения…',
  'certificates.empty': 'Пока нет сертификатов',
  'certificates.emptySearch': 'Сертификаты не найдены',
  'certificates.emptySearchHint': 'Попробуйте изменить условия поиска',
  'certificates.emptyHint': 'Выдайте первый сертификат, чтобы начать',
  'certificates.col.student': 'Ученик',
  'certificates.col.course': 'Курс',
  'certificates.col.number': 'Сертификат №',
  'certificates.col.verification': 'Подтверждение',
  'certificates.col.issued': 'Дата выдачи',
  'certificates.selectStudent': 'Выберите ученика',
  'certificates.selectCourse': 'Выберите курс',
  'certificates.field.student': 'Ученик *',
  'certificates.field.course': 'Курс *',
  'certificates.field.notes': 'Заметки',
  'certificates.notesPlaceholder': 'Необязательные заметки, сохраняемые с сертификатом',
  'certificates.studentRequired': 'Выберите ученика',
  'certificates.courseRequired': 'Выберите курс',
  'certificates.generateHint':
    'Сертификат выдаётся выбранному ученику за выбранный курс. Ученик должен быть зачислен в активную группу этого курса.',

  // Certificate templates
  'templates.new': 'Новый шаблон',
  'templates.empty': 'Пока нет шаблонов',
  'templates.emptyHint': 'Создайте шаблон сертификата, чтобы управлять видом выдаваемых сертификатов.',
  'templates.col.name': 'Название',
  'templates.col.default': 'По умолчанию',
  'templates.col.created': 'Создан',
  'templates.badge.default': 'По умолчанию',
  'templates.makeDefault': 'Сделать по умолчанию',
  'templates.defaultUpdated': 'Шаблон по умолчанию обновлён',
  'templates.edit': 'Редактирование шаблона: {name}',
  'templates.createTitle': 'Новый шаблон',
  'templates.field.name': 'Название шаблона *',
  'templates.field.html': 'HTML шаблона *',
  'templates.field.css': 'Свой CSS',
  'templates.field.isDefault': 'Сделать шаблоном организации по умолчанию',
  'templates.namePlaceholder': 'напр. Золотое достижение',
  'templates.nameRequired': 'Укажите название шаблона',
  'templates.htmlRequired': 'Укажите HTML шаблона',
  'templates.htmlTooLong': 'HTML шаблона должен быть не длиннее 100 000 символов',
  'templates.cssTooLong': 'CSS должен быть не длиннее 50 000 символов',
  'templates.created': 'Шаблон создан',
  'templates.updated': 'Шаблон обновлён',
  'templates.saving': 'Сохранение…',
  'templates.saveChanges': 'Сохранить изменения',
  'templates.deleteTitle': 'Удаление шаблона',
  'templates.deleteConfirm': 'Удалить шаблон {name}? Это действие необратимо.',
  'templates.deleteHint':
    'Шаблоны, используемые выданными сертификатами, нельзя удалить — API отклонит запрос, чтобы сохранить историю сертификатов.',
  'templates.deleting': 'Удаление…',
  'templates.deleteAction': 'Удалить шаблон',
  'templates.deleted': 'Шаблон удалён',
  'templates.variablesHint': 'Доступные переменные: {variables}. Значения автоматически экранируются при рендере.',

  // Settings / language
  'settings.title': 'Настройки',
  'settings.language': 'Язык',
  'settings.languageHint': 'Выберите язык интерфейса. Выбор сохраняется на этом устройстве.',

  // Errors
  'error.network': 'Ошибка сети — проверьте подключение и попробуйте снова',
  'error.unauthorized': 'Ваша сессия истекла. Войдите снова.',
  'error.forbidden': 'У вас нет прав для этого действия',
  'error.notFound': 'Запрошенный ресурс не найден',
  'error.server': 'Ошибка сервера — попробуйте позже',
};

export default ru;
