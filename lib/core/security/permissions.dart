import '../../features/settings/domain/entities/app_settings.dart';
import '../error/failures.dart';

/// RBAC permission'lari (§32) — GRANULAR.
///
/// Permission tekshiruvi FAQAT UI darajasida emas — command'lar
/// (application layer) ichida ham bajariladi. `Permissions.require` xato
/// tashlasa, UI xabarni ko'rsatadi; tugmani yashirish security emas.
///
/// Yagona SOURCE OF TRUTH: rol × permission matritsasi shu faylda
/// [Permissions.can] orqali bitta joyda aniqlanadi — UI, command'lar va
/// testlar bir xil qoidani ishlatadi (PHASE F).
enum AppPermission {
  // ── O'quvchilar / Shaxslar ──
  /// O'quvchilar ro'yxatini ko'rish.
  studentsView,

  /// Yangi o'quvchi/shaxs yaratish.
  studentsCreate,

  /// O'quvchini tahrirlash (ma'lumot, guruh transferi, merge).
  studentsEdit,

  /// O'quvchini arxivlash / qayta tiklash (status o'zgarishi).
  studentsArchive,

  // ── O'qituvchilar ──
  /// O'qituvchilar ro'yxatini ko'rish.
  teachersView,

  /// Yangi o'qituvchi qo'shish.
  teachersCreate,

  // ── Guruhlar ──
  /// Guruhlar ro'yxatini ko'rish.
  groupsView,

  /// Yangi guruh yaratish.
  groupsCreate,

  /// Guruhni tahrirlash (student/o'qituvchi tayinlash, o'chirish).
  groupsEdit,

  // ── Jadval ──
  /// Jadval va xonalarni ko'rish.
  scheduleView,

  /// Dars jadvali / xona yaratish.
  scheduleCreate,

  // ── Davomat ──
  /// Davomat ma'lumotlarini ko'rish.
  attendanceView,

  /// Davomat belgilash (manual, QR, Face ID).
  attendanceCreate,

  // ── Moliya ──
  /// Moliya ma'lumotlarini ko'rish (to'lovlar, qarzlar, xarajatlar).
  financeView,

  /// Moliya operatsiyalari (to'lov qabul qilish, qarz/xarajat yaratish).
  financeCreate,

  // ── Baholar (o'zlashtirish) ──
  /// Baholar markazini ko'rish.
  gradesView,

  /// Baho qo'shish / o'chirish.
  gradesCreate,

  // ── Hisobotlar ──
  /// Hisobotlarni ko'rish.
  reportsView,

  /// Saqlangan hisobotni o'chirish.
  reportsDelete,

  /// Hisobotni eksport qilish / yuborish.
  reportsExport,

  // ── Sozlamalar ──
  /// Sozlamalarni ko'rish.
  settingsView,

  /// Sozlamalarni o'zgartirish (til, mavzu, xavfsizlik, kamera va h.k.).
  settingsEdit,

  // ── Foydalanuvchilar (faqat superAdmin) ──
  /// Foydalanuvchilar ro'yxatini ko'rish.
  usersView,

  /// Yangi foydalanuvchi yaratish (hisob + rol).
  usersCreate,

  /// Foydalanuvchini tahrirlash / rolini o'zgartirish.
  usersEdit,

  /// Foydalanuvchini faolsizlantirish / to'xtatish (suspend/archive).
  usersDeactivate,

  /// Foydalanuvchini (hisobini) o'chirish.
  usersDelete,

  // ── Face ID ──
  /// Face ID holatini ko'rish.
  faceIdView,

  /// Kamera / Face ID sozlamalarini o'zgartirish.
  faceIdConfigure,

  /// Face ID tizimidan foydalanish (yuzni skanerlash, enrol qilish).
  faceIdUse,

  // ── Telegram ──
  /// Telegram sozlamalarini sozlash (bot token, kontakt sinxronlash).
  telegramConfigure,

  /// Telegram orqali xabar / hisobot yuborish.
  telegramUse,

  // ── Printer ──
  /// Printer sozlamalarini sozlash.
  printerConfigure,

  // ── Zaxira ──
  /// Zaxira nusxasini yaratish.
  backupCreate,

  /// Zaxira'dan tiklash (destructive).
  backupRestore,

  // ── Audit ──
  /// Audit log'ni ko'rish.
  auditView,

  // ── CRM (Lead Pipeline) ──
  /// Lead'lar ro'yxatini / Kanban'ni ko'rish.
  crmLeadsView,

  /// Yangi lead qo'lga kiritish (CaptureLeadCommand).
  crmLeadsCreate,

  /// Lead'ni tahrirlash (bosqich o'zgarishi, follow-up, tayinlash).
  crmLeadsEdit,
}

/// Rol → permission matritsasi.
///
/// Business scope (1 ta o'quv markazi):
/// - `superAdmin`: hammasi (foydalanuvchilar + rollar boshqaruvi).
/// - `director`/`admin`: hamma boshqaruv, lekin foydalanuvchilarni
///   o'zgartirish/o'chirish faqat superAdmin (o'zini pastlatishning
///   oldini olish uchun). usersView — ko'rish mumkin.
/// - `manager`: operatsion boshqaruv + moliya ko'rish (to'lov amallari —
///   faqat admin).
/// - `teacher`: davomat, o'quvchilarni ko'rish, jadval, hisobotlar,
///   moliyani ko'rish, Face ID'dan foydalanish (davomat uchun).
/// - `staff`: o'quvchilar/guruhlar bilan ishlash, davomat, jadval.
/// - `student`/`parent`: admin ilovasiga kirmaydi — DENY.
///
/// CRM (spec §5): Manager/Administrator — hammasi; Teacher — hech biri
/// (ko'rish ham yo'q). Staff — spec'da ko'rsatilmagan, fail-closed:
/// ruxsat berilmagan (front-desk walk-in capture kerak bo'lsa — biznes
/// qarori bilan staff'ga crmLeadsCreate qo'shilishi mumkin).
class Permissions {
  const Permissions._();

  /// Berilgan rol ushbu permission'ga ega ekanligini qaytaradi.
  ///
  /// AUDIT P1-04 (FAIL CLOSED): `unknown` rol — barcha permission'larda
  /// `false` (spec §14: "Unknown user/role/permission hech qachon ADMIN
  /// bo'lmasin").
  static bool can(UserRole role, AppPermission permission) {
    return switch (role) {
      UserRole.superAdmin => true,
      // Direktor = admin darajasi (users boshqaruvi faqat superAdmin).
      UserRole.director => _adminLevel(permission),
      UserRole.admin => _adminLevel(permission),
      // Menejer: operatsion boshqaruv + moliyani ko'rish (to'lov
      // amallari — faqat admin).
      UserRole.manager => switch (permission) {
          AppPermission.studentsView ||
          AppPermission.studentsCreate ||
          AppPermission.studentsEdit ||
          AppPermission.studentsArchive ||
          AppPermission.teachersView ||
          AppPermission.groupsView ||
          AppPermission.groupsCreate ||
          AppPermission.groupsEdit ||
          AppPermission.scheduleView ||
          AppPermission.scheduleCreate ||
          AppPermission.attendanceView ||
          AppPermission.attendanceCreate ||
          AppPermission.financeView ||
          AppPermission.reportsView ||
          AppPermission.gradesView ||
          AppPermission.gradesCreate ||
          // CRM (spec §5): Manager — hammasi.
          AppPermission.crmLeadsView ||
          AppPermission.crmLeadsCreate ||
          AppPermission.crmLeadsEdit =>
            true,
          _ => false,
        },
      UserRole.teacher => switch (permission) {
          AppPermission.studentsView ||
          AppPermission.attendanceView ||
          AppPermission.attendanceCreate ||
          AppPermission.reportsView ||
          AppPermission.scheduleView ||
          AppPermission.scheduleCreate ||
          AppPermission.financeView ||
          AppPermission.faceIdUse ||
          AppPermission.gradesView ||
          AppPermission.gradesCreate =>
            true,
          _ => false,
        },
      UserRole.staff => switch (permission) {
          AppPermission.studentsView ||
          AppPermission.studentsCreate ||
          AppPermission.studentsEdit ||
          AppPermission.studentsArchive ||
          AppPermission.teachersView ||
          AppPermission.groupsView ||
          AppPermission.groupsCreate ||
          AppPermission.groupsEdit ||
          AppPermission.scheduleView ||
          AppPermission.scheduleCreate ||
          AppPermission.attendanceView ||
          AppPermission.attendanceCreate ||
          AppPermission.reportsView ||
          AppPermission.gradesView ||
          AppPermission.gradesCreate =>
            true,
          _ => false,
        },
      // Student/parent — admin ilovasiga kirmaydi (faqat Telegram
      // bildirishnomalar oladi). Fail-closed: ruxsat yo'q.
      UserRole.student => false,
      UserRole.parent => false,
      // Fail-closed: noma'lum rol — HECH QANDAY ruxsat yo'q.
      UserRole.unknown => false,
    };
  }

  /// Admin darajasidagi ruxsatlar (director + admin uchun umumiy).
  ///
  /// Foydalanuvchilarni o'zgartirish/o'chirish — faqat superAdmin
  /// (o'zini pastlatishning oldini olish). Ko'rish — mumkin.
  static bool _adminLevel(AppPermission permission) {
    return switch (permission) {
      AppPermission.usersCreate ||
      AppPermission.usersEdit ||
      AppPermission.usersDeactivate ||
      AppPermission.usersDelete =>
        false,
      _ => true,
    };
  }

  /// Ruxsat bo'lmasa [PermissionDeniedFailure] tashlaydi.
  ///
  /// Command'lar ichida shu orqali tekshiriladi — UI'dan mustaqil
  /// (RBAC §32: "UI tugmani yashirish yetarli emas").
  static void require(UserRole role, AppPermission permission) {
    if (!can(role, permission)) {
      throw PermissionDeniedFailure(
        'Bu amalni bajarish uchun ruxsatingiz yetarli emas '
        '(rol: ${_roleLabel(role)})',
      );
    }
  }

  static String _roleLabel(UserRole role) {
    return switch (role) {
      UserRole.superAdmin => 'Super Admin',
      UserRole.director => 'Direktor',
      UserRole.admin => 'Administrator',
      UserRole.manager => 'Menejer',
      UserRole.teacher => "O'qituvchi",
      UserRole.staff => 'Xodim',
      UserRole.student => 'O\'quvchi',
      UserRole.parent => 'Ota-ona',
      UserRole.unknown => 'Noma\'lum',
    };
  }
}
