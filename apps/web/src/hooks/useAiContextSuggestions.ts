import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ClipboardCheck,
  BookOpen,
  AlertTriangle,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/auth/AuthContext';
import { ROUTE_TITLES } from '@/routes';

export interface AiQuickActionTool {
  id: 'attendanceSummary' | 'lessonPlan' | 'studentRisk' | 'financialDebt';
  title: string;
  desc: string;
  prompt: string;
  icon: LucideIcon;
  badge: string;
  gradient: string;
}

export interface AiContextSuggestions {
  routeContext: string;
  routeTitle: string;
  role: string;
  quickActionTools: AiQuickActionTool[];
  smartPrompts: string[];
}

function useSafePathname(): string {
  try {
    const loc = useLocation();
    return loc.pathname;
  } catch {
    return typeof window !== 'undefined' ? window.location?.pathname || '/' : '/';
  }
}

function useSafeRole(): string {
  try {
    const auth = useAuth();
    return auth?.user?.role ?? 'ADMIN';
  } catch {
    return 'ADMIN';
  }
}

export function useAiContextSuggestions(): AiContextSuggestions {
  const pathname = useSafePathname();
  const { t, locale } = useSafeI18n();
  const role = useSafeRole();

  const routeMatch = useMemo(() => {
    return ROUTE_TITLES.find((r) => r.pattern.test(pathname));
  }, [pathname]);

  const routeTitle = routeMatch ? routeMatch.title : 'M-EDU';

  const quickActionTools: AiQuickActionTool[] = useMemo(() => {
    return [
      {
        id: 'attendanceSummary',
        title: t('ai.tools.attendanceSummary.title') || 'Davomat tahlili',
        desc: t('ai.tools.attendanceSummary.desc') || 'Bugungi davomat va qatnashmaganlar tahlilini olish',
        prompt: t('ai.tools.attendanceSummary.prompt') || 'Bugungi davomat bo‘yicha to‘liq hisobot ber: kelganlar, kelmaganlar va kechikkanlar.',
        icon: ClipboardCheck,
        badge: 'Live Data',
        gradient: 'linear-gradient(135deg, #007AFF 0%, #32ADE6 100%)',
      },
      {
        id: 'lessonPlan',
        title: t('ai.tools.lessonPlan.title') || 'Dars rejasi yordamchisi',
        desc: t('ai.tools.lessonPlan.desc') || 'Mavzu bo‘yicha 45 daqiqalik dars rejasi va topshiriqlar',
        prompt: t('ai.tools.lessonPlan.prompt') || 'Mavzu bo‘yicha batafsil 45 daqiqalik dars rejasi, vaqt taqsimoti va uy vazifasini tuzib ber.',
        icon: BookOpen,
        badge: 'Curriculum',
        gradient: 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
      },
      {
        id: 'studentRisk',
        title: t('ai.tools.studentRisk.title') || 'O‘quvchilar xavf tahlili',
        desc: t('ai.tools.studentRisk.desc') || 'Davomat va natijalarda orqada qolayotgan o‘quvchilar',
        prompt: t('ai.tools.studentRisk.prompt') || 'Davomat va baholarda pasayish kuzatilgan, xavf ostidagi o‘quvchilar tahlilini ko‘rsat.',
        icon: AlertTriangle,
        badge: 'Early Warning',
        gradient: 'linear-gradient(135deg, #FF9500 0%, #FF2D55 100%)',
      },
      {
        id: 'financialDebt',
        title: t('ai.tools.financialDebt.title') || 'Moliyaviy qarz ogohlantirishi',
        desc: t('ai.tools.financialDebt.desc') || 'Qarzdorlar ro‘yxati, to‘lovlar va kassa tushumi',
        prompt: t('ai.tools.financialDebt.prompt') || 'Qarzdor o‘quvchilar, kechikkan to‘lovlar va umumiy moliyaviy intizom bo‘yicha hisobot ber.',
        icon: Wallet,
        badge: 'Cashflow',
        gradient: 'linear-gradient(135deg, #34C759 0%, #10B981 100%)',
      },
    ];
  }, [t]);

  const smartPrompts: string[] = useMemo(() => {
    const isUz = locale === 'uz';
    const isRu = locale === 'ru';

    // Route-specific prompts
    if (pathname.includes('/attendance')) {
      if (isRu) {
        return [
          'Кто сегодня отсутствует на занятиях?',
          'Сводка посещаемости за текущую неделю',
          'Студенты с хроническими пропусками',
          'Посещаемость по учебным группам',
        ];
      }
      if (isUz) {
        return [
          'Bugun kimlar darsga kelmadi?',
          'Shu haftalik davomat dinamikasi qanday?',
          'Surunkali dars qoldiruvchi talabalar',
          'Guruhlar bo‘yicha davomat ko‘rsatkichlari',
        ];
      }
      return [
        'Who is absent from classes today?',
        'Weekly attendance trend & summary',
        'Students with chronic absenteeism',
        'Attendance breakdown by group',
      ];
    }

    if (pathname.includes('/students')) {
      if (isRu) {
        return [
          'Список студентов в группе риска',
          'Самые успевающие и активные студенты',
          'Недавно зачисленные студенты',
          'Анализ успеваемости по группам',
        ];
      }
      if (isUz) {
        return [
          'Xavf guruhidagi talabalar ro‘yxati',
          'Eng faol va iqtidorli talabalar',
          'Yangi qabul qilingan o‘quvchilar',
          'Guruhlar bo‘yicha umumiy o‘zlashtirish',
        ];
      }
      return [
        'At-risk students identification',
        'Top performing & engaged students',
        'Recently enrolled new students',
        'Academic progress breakdown by group',
      ];
    }

    if (pathname.includes('/payments') || pathname.includes('/finance') || pathname.includes('/invoices')) {
      if (isRu) {
        return [
          'Список студентов с просроченной оплатой',
          'Общая сумма задолженности за этот месяц',
          'Сводка поступивших платежей',
          'Шаблон сообщения для напоминания должникам',
        ];
      }
      if (isUz) {
        return [
          'To‘lov muddati o‘tgan qarzdor talabalar',
          'Bu oyda tushgan to‘lovlar va kutilayotgan summa',
          'Kechikkan to‘lovlar bo‘yicha eslatma tayyorla',
          'Moliyaviy intizom tahlili',
        ];
      }
      return [
        'Overdue debtors list & outstanding amounts',
        'Total revenue collected vs pending this month',
        'Draft reminder notice for overdue accounts',
        'Payment compliance & cashflow analysis',
      ];
    }

    if (pathname.includes('/schedule') || pathname.includes('/timetable')) {
      if (isRu) {
        return [
          'Проверить расписание на накладки и конфликты',
          'Свободные аудитории на сегодня',
          'Нагрузка преподавателей на этой неделе',
          'Расписание занятий на завтра',
        ];
      }
      if (isUz) {
        return [
          'Dars jadvalida to‘qnashuvlar bormi?',
          'Bugungi bo‘sh xonalar va darslar',
          'O‘qituvchilar haftalik dars yuklamasi',
          'Ertangi kunlik darslar ro‘yxati',
        ];
      }
      return [
        'Check timetable for room & teacher conflicts',
        'Available free classrooms for today',
        'Teacher weekly teaching load breakdown',
        "Tomorrow's full schedule breakdown",
      ];
    }

    // Role-specific defaults for dashboard / general views
    const isTeacher = String(role).toUpperCase().includes('TEACHER');
    const isStudent = String(role).toUpperCase().includes('STUDENT');

    if (isTeacher) {
      if (isRu) {
        return [
          'Составить план 45-минутного урока по теме',
          'Посещаемость моих групп за сегодня',
          'Идеи интерактивных заданий и тестов',
          'Отстающие ученики в моих группах',
        ];
      }
      if (isUz) {
        return [
          'Mavzu bo‘yicha 45 daqiqalik dars rejasi tuz',
          'Mening guruhlarim bo‘yicha bugungi davomat',
          'Interaktiv topshiriqlar va test savollari',
          'Mening darslarimdagi orqada qolayotgan o‘quvchilar',
        ];
      }
      return [
        'Create a 45-minute structured lesson plan',
        'My groups attendance status for today',
        'Interactive learning tasks & quick quiz ideas',
        'At-risk students needing extra attention',
      ];
    }

    if (isStudent) {
      if (isRu) {
        return [
          'Мое расписание занятий на сегодня',
          'Список моих домашних заданий',
          'Статистика моей посещаемости',
          'Статус моих оплат и баланс',
        ];
      }
      if (isUz) {
        return [
          'Bugungi darslarim jadvali',
          'Mening uy vazifalarim ro‘yxati',
          'Mening davomat ko‘rsatkichlarim',
          'To‘lovlarim va balansim holati',
        ];
      }
      return [
        'My class schedule for today',
        'My pending homework & assignments',
        'My attendance percentage summary',
        'My payment status & account balance',
      ];
    }

    // Default: Admin / Manager view
    if (isRu) {
      return [
        'Сводный отчет по центру за сегодня',
        'Срочные вопросы, требующие внимания',
        'Статистика посещаемости и оплат',
        'Анализ заполняемости учебных групп',
      ];
    }
    if (isUz) {
      return [
        'Bugungi markaziy operatsion ko‘rsatkichlar',
        'E’tibor talab qiladigan muammolar tahlili',
        'Davomat va to‘lovlar holati qisqacha',
        'Guruhlar to‘laligi va faollik darajasi',
      ];
    }
    return [
      'Today educational center executive summary',
      'High-priority operational alerts',
      'Daily attendance & revenue collection status',
      'Group occupancy and capacity utilization',
    ];
  }, [pathname, locale, role]);

  return {
    routeContext: pathname,
    routeTitle,
    role,
    quickActionTools,
    smartPrompts,
  };
}
