/**
 * Central friendly-error mapping for the UI (Multi-language: UZ, RU, EN).
 *
 * `getErrorMessage` is the single entry point pages use to turn any thrown
 * value / react-query error into a user-safe, localized message:
 *  - Translates structured domain error codes (attendance, enrollments, face recognition, limits).
 *  - Strips internal server stack traces, database details and ugly raw UUIDs.
 *  - Provides respectful, actionable human explanations in Uzbek, Russian, and English.
 */
import { ApiError } from './api';
import { friendlyFaceError, type SupportedLocale } from './faceErrors';
import { getStoredLocale } from '@/i18n';

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function getErrorMessage(err: unknown, requestedLocale?: string): string {
  const locale: SupportedLocale =
    requestedLocale === 'uz' || requestedLocale === 'ru' || requestedLocale === 'en'
      ? requestedLocale
      : (getStoredLocale() as SupportedLocale);

  if (err === null || err === undefined || (typeof err !== 'object' && typeof err !== 'string')) {
    return locale === 'uz'
      ? "Kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
      : locale === 'ru'
      ? 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте снова.'
      : 'Something went wrong. Please try again.';
  }

  if (err instanceof ApiError) {
    const details = err.details as {
      code?: string;
      studentName?: string | null;
      groupName?: string | null;
      message?: string;
    } | null | undefined;

    const code = details?.code;

    if (code === 'STUDENT_NOT_ENROLLED_IN_GROUP') {
      const sName = details?.studentName;
      const gName = details?.groupName;
      if (sName && gName) {
        if (locale === 'uz') {
          return `"${sName}" o‘quvchisi "${gName}" guruhiga a’zo emas. Iltimos, o‘quvchini avval guruhga biriktiring.`;
        }
        if (locale === 'ru') {
          return `Ученик "${sName}" не зачислен в группу "${gName}". Сначала добавьте ученика в эту группу.`;
        }
        return `Student "${sName}" is not enrolled in group "${gName}". Please enroll the student in this group first.`;
      }
      if (locale === 'uz') {
        return "O‘quvchi ushbu guruhga biriktirilmagan. Iltimos, o‘quvchini avval guruhga biriktiring.";
      }
      if (locale === 'ru') {
        return 'Ученик не зачислен в эту группу. Пожалуйста, сначала добавьте ученика в группу.';
      }
      return 'Student is not enrolled in this group. Please enroll the student in this group first.';
    }

    if (code === 'STUDENT_NOT_ENROLLED_IN_ASSIGNMENT_GROUP') {
      if (locale === 'uz') return 'O‘quvchi ushbu topshiriq guruhiga biriktirilmagan.';
      if (locale === 'ru') return 'Ученик не зачислен в группу этого задания.';
      return 'Student is not enrolled in this assignment group.';
    }

    if (code === 'STUDENT_NOT_ENROLLED_IN_EXAM_GROUP') {
      if (locale === 'uz') return 'O‘quvchi ushbu imtihon guruhiga biriktirilmagan.';
      if (locale === 'ru') return 'Ученик не зачислен в группу этого экзамена.';
      return 'Student is not enrolled in this exam group.';
    }

    if (code === 'STUDENT_NOT_ENROLLED_IN_COURSE') {
      if (locale === 'uz') return 'O‘quvchi ushbu kursning birorta guruhiga ham biriktirilmagan.';
      if (locale === 'ru') return 'Ученик не зачислен ни в одну группу этого курса.';
      return 'Student is not enrolled in any group of this course.';
    }

    if (code === 'LESSON_NOT_FOUND') {
      if (locale === 'uz') return 'Dars topilmadi.';
      if (locale === 'ru') return 'Урок не найден.';
      return 'Lesson not found.';
    }

    if (code === 'LESSON_GROUP_MISMATCH') {
      if (locale === 'uz') return 'Dars tanlangan guruhga tegishli emas.';
      if (locale === 'ru') return 'Урок не принадлежит выбранной группе.';
      return 'Lesson does not belong to the selected group.';
    }

    // Known biometric/face error codes
    if (code) {
      const faceMsg = friendlyFaceError(err, locale);
      if (faceMsg && faceMsg !== err.message) return faceMsg;
    }

    return humanizeErrorMessage(err.message, locale, err.status);
  }

  if (err instanceof Error && err.message) {
    return humanizeErrorMessage(err.message, locale);
  }

  if (typeof err === 'string') {
    return humanizeErrorMessage(err, locale);
  }

  return locale === 'uz'
    ? "Kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
    : locale === 'ru'
    ? 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте снова.'
    : 'Something went wrong. Please try again.';
}

export function humanizeErrorMessage(raw: string, locale: SupportedLocale = 'en', status?: number): string {
  if (!raw || typeof raw !== 'string') {
    return locale === 'uz'
      ? 'Kutilmagan xatolik yuz berdi.'
      : locale === 'ru'
      ? 'Произошла непредвиденная ошибка.'
      : 'Something went wrong.';
  }

  const trimmed = raw.trim();

  // Pattern 1: Student ... is not enrolled in group ...
  const enrolledMatch = trimmed.match(
    /Student\s+(?:(?:"([^"]+)")|([a-f0-9-]{36})|([A-Za-z0-9_ -]+))?\s*is not enrolled in group\s*(?:(?:"([^"]+)")|([a-f0-9-]{36})|([A-Za-z0-9_ -]+))?/i,
  );
  if (enrolledMatch) {
    const sName = enrolledMatch[1] || (!UUID_REGEX.test(enrolledMatch[3] || '') ? enrolledMatch[3]?.trim() : null);
    const gName = enrolledMatch[4] || (!UUID_REGEX.test(enrolledMatch[6] || '') ? enrolledMatch[6]?.trim() : null);

    if (sName && gName) {
      if (locale === 'uz') return `"${sName}" o‘quvchisi "${gName}" guruhiga a’zo emas. Iltimos, o‘quvchini avval guruhga biriktiring.`;
      if (locale === 'ru') return `Ученик "${sName}" не зачислен в группу "${gName}". Сначала добавьте ученика в группу.`;
      return `Student "${sName}" is not enrolled in group "${gName}". Please enroll the student in this group first.`;
    }

    if (locale === 'uz') return 'O‘quvchi ushbu guruhga biriktirilmagan. Iltimos, o‘quvchini avval guruhga biriktiring.';
    if (locale === 'ru') return 'Ученик не зачислен в эту группу. Пожалуйста, добавьте ученика в группу.';
    return 'Student is not enrolled in this group. Please enroll the student in this group first.';
  }

  // Pattern 2: Assignment/Exam/Course group enrollment
  if (/Student is not enrolled in this assignment group/i.test(trimmed)) {
    if (locale === 'uz') return 'O‘quvchi ushbu topshiriq guruhiga biriktirilmagan.';
    if (locale === 'ru') return 'Ученик не зачислен в группу этого задания.';
    return 'Student is not enrolled in this assignment group.';
  }

  if (/Student is not enrolled in this exam group/i.test(trimmed)) {
    if (locale === 'uz') return 'O‘quvchi ushbu imtihon guruhiga biriktirilmagan.';
    if (locale === 'ru') return 'Ученик не зачислен в группу этого экзамена.';
    return 'Student is not enrolled in this exam group.';
  }

  if (/Student is not enrolled in any group of this course/i.test(trimmed)) {
    if (locale === 'uz') return 'O‘quvchi ushbu kursning birorta guruhiga ham biriktirilmagan.';
    if (locale === 'ru') return 'Ученик не зачислен ни в одну группу этого курса.';
    return 'Student is not enrolled in any group of this course.';
  }

  // Pattern 3: Lesson checks
  if (/Lesson\b.*?does not belong to group/i.test(trimmed)) {
    if (locale === 'uz') return 'Dars tanlangan guruhga tegishli emas.';
    if (locale === 'ru') return 'Урок не принадлежит выбранной группе.';
    return 'Lesson does not belong to the selected group.';
  }

  if (/Lesson\b.*?not found/i.test(trimmed)) {
    if (locale === 'uz') return 'Dars topilmadi.';
    if (locale === 'ru') return 'Урок не найден.';
    return 'Lesson not found.';
  }

  // Pattern 4: Resource not found lookups
  if (/^Group not found/i.test(trimmed)) {
    if (locale === 'uz') return 'Guruh topilmadi.';
    if (locale === 'ru') return 'Группа не найдена.';
    return 'Group not found.';
  }

  if (/^Student (?:profile )?not found/i.test(trimmed)) {
    if (locale === 'uz') return 'O‘quvchi profili topilmadi.';
    if (locale === 'ru') return 'Профиль ученика не найден.';
    return 'Student profile not found.';
  }

  if (/^Teacher not found/i.test(trimmed)) {
    if (locale === 'uz') return 'O‘qituvchi topilmadi.';
    if (locale === 'ru') return 'Преподаватель не найден.';
    return 'Teacher not found.';
  }

  if (/^Course not found/i.test(trimmed)) {
    if (locale === 'uz') return 'Kurs topilmadi.';
    if (locale === 'ru') return 'Курс не найден.';
    return 'Course not found.';
  }

  if (/^Lead not found/i.test(trimmed)) {
    if (locale === 'uz') return 'Lid topilmadi.';
    if (locale === 'ru') return 'Лид не найден.';
    return 'Lead not found.';
  }

  if (/^Payment not found/i.test(trimmed)) {
    if (locale === 'uz') return 'To‘lov topilmadi.';
    if (locale === 'ru') return 'Платеж не найден.';
    return 'Payment not found.';
  }

  if (/^Employee not found/i.test(trimmed)) {
    if (locale === 'uz') return 'Xodim topilmadi.';
    if (locale === 'ru') return 'Сотрудник не найден.';
    return 'Employee not found.';
  }

  // Pattern 5: Invoices and finance
  if (/Invoice in status \w+ cannot accept payments/i.test(trimmed)) {
    if (locale === 'uz') return 'Ushbu hisob-faktura holati to‘lov qabul qilishga ruxsat bermaydi.';
    if (locale === 'ru') return 'Счет в текущем статусе не может принимать оплату.';
    return 'Invoice in this status cannot accept payments.';
  }

  if (/Cannot cancel an invoice in status \w+/i.test(trimmed)) {
    if (locale === 'uz') return 'Ushbu holatdagi hisob-fakturani bekor qilib bo‘lmaydi.';
    if (locale === 'ru') return 'Нельзя отменить счет в текущем статусе.';
    return 'Cannot cancel an invoice in this status.';
  }

  if (/Invoice number .*? already exists/i.test(trimmed)) {
    if (locale === 'uz') return 'Bunday raqamli hisob-faktura allaqachon mavjud.';
    if (locale === 'ru') return 'Счет с таким номером уже существует.';
    return 'Invoice number already exists.';
  }

  // Pattern 6: Booking conflicts
  if (/Location .*? is already booked|Assigned Teacher is already booked/i.test(trimmed)) {
    if (locale === 'uz') return 'Tanlangan xona yoki o‘qituvchi ushbu vaqtda boshqa darsga band qilingan.';
    if (locale === 'ru') return 'Выбранная аудитория или преподаватель уже заняты на это время.';
    return 'The selected room or teacher is already booked for another event.';
  }

  // Pattern 7: Library
  if (/Student has overdue books/i.test(trimmed)) {
    if (locale === 'uz') return 'O‘quvchida muddati o‘tgan qaytarilmagan kitoblar mavjud.';
    if (locale === 'ru') return 'У ученика есть просроченные книги.';
    return 'Student has overdue books.';
  }

  if (/Student has already borrowed this book/i.test(trimmed)) {
    if (locale === 'uz') return 'O‘quvchi ushbu kitobni allaqachon olgan.';
    if (locale === 'ru') return 'Ученик уже взял эту книгу.';
    return 'Student has already borrowed this book.';
  }

  if (/Cannot delete book with .*? active borrow/i.test(trimmed)) {
    if (locale === 'uz') return 'Kitob hozirda o‘quvchilarda bo‘lgani sababli uni o‘chirib bo‘lmaydi.';
    if (locale === 'ru') return 'Нельзя удалить книгу, пока она находится на руках.';
    return 'Cannot delete book while it is currently borrowed.';
  }

  // Pattern 8: Scores & limits
  if (/Score cannot exceed maxScore|Grade value .*? cannot exceed maxValue/i.test(trimmed)) {
    if (locale === 'uz') return 'Baho belgilangan maksimal balldan oshmasligi kerak.';
    if (locale === 'ru') return 'Оценка не может превышать максимальный балл.';
    return 'Score cannot exceed the maximum allowed score.';
  }

  if (/Maximum (?:submission )?attempts .*? (?:exceeded|reached)/i.test(trimmed)) {
    if (locale === 'uz') return 'Ushbu topshiriq yoki test uchun urinishlar soni tugagan.';
    if (locale === 'ru') return 'Превышено максимальное количество попыток.';
    return 'Maximum attempts reached for this task.';
  }

  // Pattern 9: Database constraints
  if (/Unique constraint failed/i.test(trimmed)) {
    if (locale === 'uz') return 'Bunday ma’lumot allaqachon mavjud.';
    if (locale === 'ru') return 'Такая запись уже существует.';
    return 'This record already exists.';
  }

  if (/Foreign key constraint failed/i.test(trimmed)) {
    if (locale === 'uz') return 'Ushbu ma’lumot boshqa bo‘limlarga bog‘langanligi sababli amalni bajarib bo‘lmadi.';
    if (locale === 'ru') return 'Невозможно выполнить действие: запись связана с другими данными.';
    return 'Cannot perform action: this record is linked to other items.';
  }

  // Pattern 10: Standard HTTP failure messages (only for generic fallback text)
  if (/^Your session has expired/i.test(trimmed) || (status === 401 && /^Request failed with status 401/i.test(trimmed))) {
    if (locale === 'uz') return 'Sessiyangiz vaqti tugadi. Qaytadan tizimga kiring.';
    if (locale === 'ru') return 'Сессия истекла. Пожалуйста, войдите снова.';
    return 'Your session has expired. Please sign in again.';
  }

  if (/^You do not have permission/i.test(trimmed) || (status === 403 && /^Request failed with status 403/i.test(trimmed))) {
    if (locale === 'uz') return 'Ushbu amalni bajarish uchun sizda yetarli ruxsat yo‘q.';
    if (locale === 'ru') return 'У вас нет прав для выполнения этого действия.';
    return 'You do not have permission to perform this action.';
  }

  if (/^The requested resource was not found/i.test(trimmed) || (status === 404 && /^Request failed with status 404/i.test(trimmed))) {
    if (locale === 'uz') return 'So‘ralgan ma’lumot topilmadi.';
    if (locale === 'ru') return 'Запрашиваемый ресурс не найден.';
    return 'The requested resource was not found.';
  }

  if (/^The request conflicts with/i.test(trimmed) || (status === 409 && /^Request failed with status 409/i.test(trimmed))) {
    if (locale === 'uz') return 'Ma’lumotlar to‘qnashuvi yuz berdi. Sahifani yangilab qayta urinib ko‘ring.';
    if (locale === 'ru') return 'Конфликт данных. Пожалуйста, обновите страницу и повторите попытку.';
    return 'The request conflicts with the current state. Please refresh and retry.';
  }

  if (/^Too many requests/i.test(trimmed) || (status === 429 && /^Request failed with status 429/i.test(trimmed))) {
    if (locale === 'uz') return 'So‘rovlar soni juda ko‘p. Iltimos, biroz kutib qayta urinib ko‘ring.';
    if (locale === 'ru') return 'Слишком много запросов. Пожалуйста, подождите немного.';
    return 'Too many requests — please wait a moment and try again.';
  }

  // Fallback: If unhandled string contains raw UUIDs, strip them out cleanly
  if (UUID_REGEX.test(trimmed)) {
    const sanitized = trimmed
      .replace(UUID_REGEX, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return sanitized || (locale === 'uz' ? 'So‘rov bajarilmadi.' : locale === 'ru' ? 'Запрос не выполнен.' : 'Request failed.');
  }

  return trimmed;
}
