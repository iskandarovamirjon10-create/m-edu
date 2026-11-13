/**
 * Friendly, user-facing messages for M-EDU face/recognition error codes.
 * The API returns stable `code` values (see @medu/core domain errors);
 * raw domain messages are technical and confusing in the UI. This mapper
 * translates them for operators/students across Uzbek, Russian and English.
 */
import { ApiError } from './api';
import { getStoredLocale } from '@/i18n';

export type SupportedLocale = 'uz' | 'ru' | 'en';

/**
 * Technical ID regex to distinguish database primary keys (UUID, ULID, ObjectId, NanoID, integer IDs)
 * from human-readable names (e.g. "Ali Valiyev").
 */
const TECHNICAL_ID_REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-HJKMNP-TV-Z]{26}|[0-9a-fA-F]{24}|[A-Za-z0-9_-]{21,32}|\d+)$/i;
const UUID_REGEX = TECHNICAL_ID_REGEX;

export const FACE_ERROR_MESSAGES: Record<SupportedLocale, Record<string, string>> = {
  uz: {
    // --- Enrollment ---
    ENROLLMENT_NOT_FOUND: 'Biometrik ro‘yxat topilmadi. Yangi ro‘yxatdan o‘tishni boshlang.',
    ENROLLMENT_ALREADY_EXISTS: 'Bu o‘quvchi allaqachon biometrik ro‘yxatdan o‘tgan. Qayta kiritishdan oldin eskisini bekor qiling.',
    ENROLLMENT_NOT_ACTIVE: 'Ushbu biometrik ro‘yxat faol emas. Yangi ro‘yxatdan o‘tishni boshlang.',

    // --- Capture pipeline ---
    FACE_NOT_DETECTED: 'Yuz aniqlanmadi. Yuzingiz kadrda to‘liq va yaxshi yoritilgan bo‘lishi kerak.',
    MULTIPLE_FACES_DETECTED: 'Bir nechta yuz aniqlandi. Kadrda faqat bitta shaxs bo‘lishi kerak.',
    FACE_QUALITY_TOO_LOW: 'Yuz tasviri sifati past. Kameraga yaqinroq keling va yorug‘likni yaxshilang.',
    LOW_BRIGHTNESS: 'Yorug‘lik juda past. Yuzingizga yorug‘lik tushishini ta’minlang yoki manbaga yaqinroq keling.',
    HIGH_BRIGHTNESS: 'Yorug‘lik juda kuchli (ortiqcha yaltirash). To‘g‘ridan-to‘g‘ri quyosh yoki chiroq nuridan chetlashing.',
    LOW_SHARPNESS: 'Tasvir xiralashgan. Harakatlanmasdan kameraga qarab turing.',
    HEAD_POSE_EXCEEDED: 'Bosh holati noto‘g‘ri burilgan. Kameraga to‘g‘ridan-to‘g‘ri qarang.',
    HEAD_POSE_TOO_EXTREME: 'Bosh holati noto‘g‘ri burilgan. Kameraga to‘g‘ridan-to‘g‘ri qarang.',
    FACE_TOO_SMALL: 'Yuz kameradan juda uzoqda. Kameraga yaqinroq keling.',
    QUALITY_BELOW_THRESHOLD: 'Yuz tasviri sifati talabga javob bermaydi. Yaxshiroq yorug‘likda to‘g‘ri qarang.',
    QUALITY_FAILED: 'Yuz tasviri sifati talabga javob bermaydi. Yaxshiroq yorug‘likda qayta urinib ko‘ring.',
    LIVENESS_FAILED: 'Jonlilik tekshiruvidan o‘tmadi (foto yoki ekran tasviri shubhasi). Jonli yuz bilan qayta urinib ko‘ring.',
    LIVENESS_UNCERTAIN: 'Jonlilik tekshiruvi noaniq. To‘g‘ri qarab, harakatlanmasdan qayta urinib ko‘ring.',
    LIVENESS_UNAVAILABLE: 'Jonlilik tekshiruvi xizmati vaqtincha ishlamayapti. Iltimos, keyinroq qayta urinib ko‘ring.',
    SPOOF_DETECTED: 'Soxta biometriya (foto/video/ekran) aniqlandi. Ruxsat berilmadi.',
    BLOCKED: 'Xavfsizlik qoidasi buzilganligi sababli ushbu yuz bloklangan.',
    ENGINE_UNAVAILABLE: 'Yuzni tanish tizimi vaqtincha band yoki ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring.',
    ENGINE_TIMEOUT: 'Yuzni tanish vaqti tugadi. Qayta urinib ko‘ring.',

    // --- Matching ---
    FACE_MATCH_NOT_FOUND: 'Mos keluvchi yuz topilmadi. Qayta urinib ko‘ring yoki o‘quvchini qayta ro‘yxatdan o‘tkazing.',
    FACE_MATCH_UNCERTAIN: 'Yuzni tanishda noaniqlik yuz berdi. To‘g‘ri qarab, yaxshi yorug‘likda qayta urinib ko‘ring.',
    UNIDENTIFIED: 'Yuz tizimdagi hech qaysi profil bilan mos kelmadi.',
    TEMPLATE_CORRUPTED: 'Saqlangan biometrik ma’lumotni o‘qib bo‘lmadi. Qayta ro‘yxatdan o‘tish talab qilinishi mumkin.',

    // --- Attendance / grouping ---
    STUDENT_NOT_IN_GROUP: 'O‘quvchi birorta ham faol guruhga biriktirilmagan.',
    STUDENT_NOT_ENROLLED_IN_GROUP: 'O‘quvchi ushbu guruhga biriktirilmagan. Iltimos, avval guruhga biriktiring.',
    STUDENT_NOT_ENROLLED_IN_ASSIGNMENT_GROUP: 'O‘quvchi ushbu topshiriq guruhiga biriktirilmagan.',
    STUDENT_NOT_ENROLLED_IN_EXAM_GROUP: 'O‘quvchi ushbu imtihon guruhiga biriktirilmagan.',
    STUDENT_NOT_ENROLLED_IN_COURSE: 'O‘quvchi ushbu kursning birorta guruhiga ham biriktirilmagan.',
    STUDENT_NOT_FOUND: 'O‘quvchi ma’lumotlar bazasidan topilmadi.',
    ATTENDANCE_ALREADY_EXISTS: 'Bu o‘quvchiga bugungi davomat allaqachon belgilangan.',
    LESSON_INVALID: 'Bu vaqt uchun rejalashtirilgan dars mavjud emas.',
    LESSON_NOT_FOUND: 'Rejalashtirilgan dars topilmadi.',
    LESSON_GROUP_MISMATCH: 'Dars tanlangan guruhga tegishli emas.',
    OUT_OF_SCHEDULE: 'Dars jadvalidan tashqari vaqt. Dars hali boshlanmagan yoki yakunlangan.',
    INSUFFICIENT_FUNDS: 'O‘quvchining to‘lov qarzdorligi mavjud. Markaz ma’muriyatiga murojaat qiling.',
    STUDENT_INACTIVE: 'Ushbu o‘quvchi hisobi faol emas.',

    // --- Devices ---
    DEVICE_NOT_FOUND: 'Qurilma topilmadi.',
    DEVICE_REVOKED: 'Ushbu qurilma bekor qilingan.',
    DEVICE_NOT_AUTHORIZED: 'Ushbu qurilma avtorizatsiyadan o‘tmagan.',

    // --- Security / tenant ---
    BIOMETRIC_ACCESS_DENIED: 'Biometrik ma’lumotlarga kirish huquqiga ega emassiz.',
    TENANT_MISMATCH: 'Tashkilot mos kelmadi — kirish taqiqlangan.',
    CONSENT_REQUIRED: 'Biometrik ro‘yxatga olishdan oldin rozilik talab qilinadi.',
    SESSION_NOT_FOUND: 'Tanib olish seansi topilmadi.',
    SESSION_ALREADY_FINISHED: 'Ushbu seans allaqachon yakunlangan.',
    MAX_CONCURRENT_SESSIONS: 'Bir vaqtning o‘zida juda ko‘p seanslar ochilgan. Boshqasini yoping va qayta urinib ko‘ring.',
    VALIDATION_ERROR: 'Kiritilgan ma’lumotlar tekshiruvdan o‘tmadi. Qayta tekshirib ko‘ring.',
  },
  ru: {
    // --- Enrollment ---
    ENROLLMENT_NOT_FOUND: 'Регистрация лица не найдена. Начните новую регистрацию.',
    ENROLLMENT_ALREADY_EXISTS: 'У этого ученика уже есть активная регистрация. Отозовите её перед повторной регистрацией.',
    ENROLLMENT_NOT_ACTIVE: 'Эта регистрация лица неактивна. Начните новую регистрацию.',

    // --- Capture pipeline ---
    FACE_NOT_DETECTED: 'Лицо не обнаружено. Убедитесь, что лицо хорошо освещено и полностью видно в кадре.',
    MULTIPLE_FACES_DETECTED: 'Обнаружено несколько лиц. В кадре должен быть только один человек.',
    FACE_QUALITY_TOO_LOW: 'Качество изображения лица слишком низкое. Подойдите ближе и улучшите освещение.',
    LOW_BRIGHTNESS: 'Слишком темно. Направьте свет на лицо или подойдите ближе к источнику света.',
    HIGH_BRIGHTNESS: 'Слишком яркий свет или засветка. Избегайте прямого яркого света.',
    LOW_SHARPNESS: 'Изображение размыто. Не двигайтесь и посмотрите прямо в камеру.',
    HEAD_POSE_EXCEEDED: 'Слишком сильный наклон головы. Посмотрите прямо в камеру.',
    HEAD_POSE_TOO_EXTREME: 'Слишком сильный наклон головы. Посмотрите прямо в камеру.',
    FACE_TOO_SMALL: 'Лицо слишком далеко от камеры. Подойдите ближе.',
    QUALITY_BELOW_THRESHOLD: 'Качество изображения лица не соответствует требованиям. Повторите попытку при лучшем освещении.',
    QUALITY_FAILED: 'Качество изображения лица не соответствует требованиям. Повторите попытку при лучшем освещении.',
    LIVENESS_FAILED: 'Проверка на живость не пройдена (возможно фото или экран). Используйте реальное лицо.',
    LIVENESS_UNCERTAIN: 'Неуверенная проверка на живость. Посмотрите прямо и не двигайтесь.',
    LIVENESS_UNAVAILABLE: 'Проверка на живость временно недоступна. Пожалуйста, попробуйте позже.',
    SPOOF_DETECTED: 'Обнаружена попытка подделки биометрии (фото/видео/экран). Доступ запрещен.',
    BLOCKED: 'Это лицо заблокировано из-за нарушения правил безопасности.',
    ENGINE_UNAVAILABLE: 'Система распознавания лиц временно недоступна. Попробуйте позже.',
    ENGINE_TIMEOUT: 'Время ожидания распознавания лица истекло. Попробуйте снова.',

    // --- Matching ---
    FACE_MATCH_NOT_FOUND: 'Совпадений лица не найдено. Попробуйте снова или перерегистрируйте ученика.',
    FACE_MATCH_UNCERTAIN: 'Неуверенное распознавание лица. Попробуйте снова при лучшем освещении и глядя прямо в камеру.',
    UNIDENTIFIED: 'Лицо не соответствует ни одному профилю в системе.',
    TEMPLATE_CORRUPTED: 'Не удалось прочитать сохраненный шаблон лица. Может потребоваться повторная регистрация.',

    // --- Attendance / grouping ---
    STUDENT_NOT_IN_GROUP: 'Ученик не зачислен ни в одну активную группу.',
    STUDENT_NOT_ENROLLED_IN_GROUP: 'Ученик не зачислен в эту группу. Пожалуйста, сначала добавьте ученика в группу.',
    STUDENT_NOT_ENROLLED_IN_ASSIGNMENT_GROUP: 'Ученик не зачислен в группу этого задания.',
    STUDENT_NOT_ENROLLED_IN_EXAM_GROUP: 'Ученик не зачислен в группу этого экзамена.',
    STUDENT_NOT_ENROLLED_IN_COURSE: 'Ученик не зачислен ни в одну группу этого курса.',
    STUDENT_NOT_FOUND: 'Ученик не найден в базе данных.',
    ATTENDANCE_ALREADY_EXISTS: 'Посещаемость этого ученика на сегодня уже отмечена.',
    LESSON_INVALID: 'На это время нет запланированного урока.',
    LESSON_NOT_FOUND: 'Запланированный урок не найден.',
    LESSON_GROUP_MISMATCH: 'Урок не принадлежит выбранной группе.',
    OUT_OF_SCHEDULE: 'Вне расписания. Урок еще не начался или уже закончился.',
    INSUFFICIENT_FUNDS: 'У ученика есть задолженность по оплате. Обратитесь к администрации центра.',
    STUDENT_INACTIVE: 'Этот аккаунт ученика неактивен.',

    // --- Devices ---
    DEVICE_NOT_FOUND: 'Устройство не найдено.',
    DEVICE_REVOKED: 'Это устройство отозвано.',
    DEVICE_NOT_AUTHORIZED: 'Это устройство не авторизовано.',

    // --- Security / tenant ---
    BIOMETRIC_ACCESS_DENIED: 'У вас нет разрешения на доступ к биометрическим данным.',
    TENANT_MISMATCH: 'Несоответствие организации — доступ запрещен.',
    CONSENT_REQUIRED: 'Перед регистрацией лица требуется согласие на обработку биометрии.',
    SESSION_NOT_FOUND: 'Сессия распознавания не найдена.',
    SESSION_ALREADY_FINISHED: 'Эта сессия распознавания уже завершена.',
    MAX_CONCURRENT_SESSIONS: 'Слишком много одновременных сессий. Закройте другую сессию и попробуйте снова.',
    VALIDATION_ERROR: 'Запрос не прошел валидацию. Проверьте введенные данные и повторите попытку.',
  },
  en: {
    // --- Enrollment ---
    ENROLLMENT_NOT_FOUND: 'Enrollment not found. Please start a new enrollment.',
    ENROLLMENT_ALREADY_EXISTS: 'This student already has an active enrollment. Revoke it before re-enrolling.',
    ENROLLMENT_NOT_ACTIVE: 'This enrollment is not active. Start a new enrollment.',

    // --- Capture pipeline ---
    FACE_NOT_DETECTED: 'No face detected. Make sure your face is well-lit and fully visible in the frame.',
    MULTIPLE_FACES_DETECTED: 'Multiple faces detected. Only one person may be in the frame.',
    FACE_QUALITY_TOO_LOW: 'Face quality is too low. Move closer and improve the lighting.',
    LOW_BRIGHTNESS: 'Lighting is too dark. Please face towards a light source.',
    HIGH_BRIGHTNESS: 'Lighting is too bright or overexposed. Avoid direct glare.',
    LOW_SHARPNESS: 'Image is blurry. Please hold still and look at the camera.',
    HEAD_POSE_EXCEEDED: 'Head angle is too extreme. Please look straight into the camera.',
    HEAD_POSE_TOO_EXTREME: 'Head angle is too extreme. Please look straight into the camera.',
    FACE_TOO_SMALL: 'Face is too far from the camera. Please step closer.',
    QUALITY_BELOW_THRESHOLD: 'Face quality check failed. Please try again with better lighting.',
    QUALITY_FAILED: 'Face quality check failed. Please try again with better lighting.',
    LIVENESS_FAILED: 'Liveness check failed — the capture may be a photo or screen replay. Use a live face.',
    LIVENESS_UNCERTAIN: 'Liveness check uncertain. Face the camera straight-on and hold still.',
    LIVENESS_UNAVAILABLE: 'Liveness check is temporarily unavailable. Please try again later.',
    SPOOF_DETECTED: 'Biometric spoofing attempt detected (photo/screen replay). Access denied.',
    BLOCKED: 'This face is blocked due to security violations.',
    ENGINE_UNAVAILABLE: 'The recognition engine is unavailable right now. Please try again later.',
    ENGINE_TIMEOUT: 'The recognition engine timed out. Please try again.',

    // --- Matching ---
    FACE_MATCH_NOT_FOUND: 'No matching face found. Try again, or re-enroll the student.',
    FACE_MATCH_UNCERTAIN: 'The face match is uncertain. Try again with better lighting and a straight-on view.',
    UNIDENTIFIED: 'Face does not match any profile in the database.',
    TEMPLATE_CORRUPTED: 'The stored face template could not be read. Re-enrollment may be required.',

    // --- Attendance / grouping ---
    STUDENT_NOT_IN_GROUP: 'Student is not enrolled in any active group.',
    STUDENT_NOT_ENROLLED_IN_GROUP: 'Student is not enrolled in this group. Please enroll the student in this group first.',
    STUDENT_NOT_ENROLLED_IN_ASSIGNMENT_GROUP: 'Student is not enrolled in this assignment group.',
    STUDENT_NOT_ENROLLED_IN_EXAM_GROUP: 'Student is not enrolled in this exam group.',
    STUDENT_NOT_ENROLLED_IN_COURSE: 'Student is not enrolled in any group of this course.',
    STUDENT_NOT_FOUND: 'Student was not found in the database.',
    ATTENDANCE_ALREADY_EXISTS: 'Attendance for this student is already recorded for today.',
    LESSON_INVALID: 'No valid lesson is scheduled for this time.',
    LESSON_NOT_FOUND: 'Scheduled lesson was not found.',
    LESSON_GROUP_MISMATCH: 'Lesson does not belong to the selected group.',
    OUT_OF_SCHEDULE: 'Out of schedule. Lesson has not started yet or has already ended.',
    INSUFFICIENT_FUNDS: 'Student has outstanding payments. Please contact the administration.',
    STUDENT_INACTIVE: 'This student account is inactive.',

    // --- Devices ---
    DEVICE_NOT_FOUND: 'Device not found.',
    DEVICE_REVOKED: 'This device has been revoked.',
    DEVICE_NOT_AUTHORIZED: 'This device is not authorized.',

    // --- Security / tenant ---
    BIOMETRIC_ACCESS_DENIED: 'You do not have permission to access biometric data.',
    TENANT_MISMATCH: 'Organization mismatch — access denied.',
    CONSENT_REQUIRED: 'Biometric consent is required before enrolling a face.',
    SESSION_NOT_FOUND: 'Recognition session not found.',
    SESSION_ALREADY_FINISHED: 'This recognition session has already finished.',
    MAX_CONCURRENT_SESSIONS: 'Too many concurrent recognition sessions. Close another session and try again.',
    VALIDATION_ERROR: 'The request could not be validated. Check the entered values and try again.',
  },
};

/**
 * Return a friendly message for an API error if a known face/recognition
 * `code` is present; otherwise fall back to a humanized or raw error message.
 */
export function friendlyFaceError(err: unknown, requestedLocale?: string): string {
  const loc: SupportedLocale =
    requestedLocale === 'uz' || requestedLocale === 'ru' || requestedLocale === 'en'
      ? requestedLocale
      : (getStoredLocale() as SupportedLocale);

  if (err instanceof ApiError) {
    const details = err.details as {
      code?: string;
      studentName?: string | null;
      groupName?: string | null;
      message?: string;
    } | null | undefined;

    const reason = typeof (details as Record<string, unknown> | null | undefined)?.reason === 'string'
      ? ((details as Record<string, unknown>).reason as string)
      : undefined;
    if (reason && (FACE_ERROR_MESSAGES[loc]?.[reason] || FACE_ERROR_MESSAGES.en[reason])) {
      return FACE_ERROR_MESSAGES[loc]?.[reason] || FACE_ERROR_MESSAGES.en[reason];
    }

    const code = details?.code;
    if (code) {
      // Dynamic interpolation for student/group enrollments
      if (code === 'STUDENT_NOT_ENROLLED_IN_GROUP') {
        const sName = details?.studentName;
        const gName = details?.groupName;
        if (sName && gName) {
          if (loc === 'uz') return `"${sName}" o‘quvchisi "${gName}" guruhiga a’zo emas. Iltimos, o‘quvchini avval guruhga biriktiring.`;
          if (loc === 'ru') return `Ученик "${sName}" не зачислен в группу "${gName}". Сначала добавьте ученика в эту группу.`;
          return `Student "${sName}" is not enrolled in group "${gName}". Please enroll the student in this group first.`;
        }
      }

      const localized = FACE_ERROR_MESSAGES[loc]?.[code] || FACE_ERROR_MESSAGES.en[code];
      if (localized) return localized;
    }

    // Check if error message contains the classic enrollment pattern
    if (typeof err.message === 'string') {
      const enrolledMatch = err.message.match(
        /Student\s+(?:(?:"([^"]+)")|([a-f0-9-]{36})|([A-Za-z0-9_ -]+))?\s*is not enrolled in group\s*(?:(?:"([^"]+)")|([a-f0-9-]{36})|([A-Za-z0-9_ -]+))?/i,
      );
      if (enrolledMatch) {
        const sName = enrolledMatch[1] || (!UUID_REGEX.test(enrolledMatch[3] || '') ? enrolledMatch[3]?.trim() : null);
        const gName = enrolledMatch[4] || (!UUID_REGEX.test(enrolledMatch[6] || '') ? enrolledMatch[6]?.trim() : null);

        if (sName && gName) {
          if (loc === 'uz') return `"${sName}" o‘quvchisi "${gName}" guruhiga a’zo emas. Iltimos, o‘quvchini avval guruhga biriktiring.`;
          if (loc === 'ru') return `Ученик "${sName}" не зачислен в группу "${gName}". Сначала добавьте ученика в группу.`;
          return `Student "${sName}" is not enrolled in group "${gName}". Please enroll the student in this group first.`;
        }
        if (loc === 'uz') return 'O‘quvchi ushbu guruhga biriktirilmagan. Iltimos, o‘quvchini avval guruhga biriktiring.';
        if (loc === 'ru') return 'Ученик не зачислен в эту группу. Пожалуйста, сначала добавьте ученика в группу.';
        return 'Student is not enrolled in this group. Please enroll the student in this group first.';
      }
    }
  }

  if (err instanceof Error && typeof err.message === 'string') {
    const enrolledMatch = err.message.match(
      /Student\s+(?:(?:"([^"]+)")|([a-f0-9-]{36})|([A-Za-z0-9_ -]+))?\s*is not enrolled in group\s*(?:(?:"([^"]+)")|([a-f0-9-]{36})|([A-Za-z0-9_ -]+))?/i,
    );
    if (enrolledMatch) {
      if (loc === 'uz') return 'O‘quvchi ushbu guruhga biriktirilmagan. Iltimos, o‘quvchini avval guruhga biriktiring.';
      if (loc === 'ru') return 'Ученик не зачислен в эту группу. Пожалуйста, сначала добавьте ученика в группу.';
      return 'Student is not enrolled in this group. Please enroll the student in this group first.';
    }
  }

  if (typeof err === 'string') {
    const match = FACE_ERROR_MESSAGES[loc]?.[err] || FACE_ERROR_MESSAGES.en[err];
    if (match) return match;
  }

  return err instanceof Error ? err.message : String(err);
}
