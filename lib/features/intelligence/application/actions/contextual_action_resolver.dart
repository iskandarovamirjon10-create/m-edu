import '../../domain/entities/command.dart';
import '../../../students/domain/entities/student.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../payments/domain/entities/payment.dart';

/// Bitta kontekstual amal.
class ContextualAction {
  final String id;
  final String title;
  final String iconKey;
  final String route;

  /// Shell branch'iga go() kerakmi.
  final bool isBranchGo;

  /// Amal bajarilishi mumkinligining sababi (transparency).
  final String reason;

  const ContextualAction({
    required this.id,
    required this.title,
    required this.iconKey,
    required this.route,
    required this.reason,
    this.isBranchGo = false,
  });
}

/// Kontekstual amal dvigateli — entity holatiga qarab FAQAT haqiqiy
/// amallarni qaytaradi.
///
/// Agar amal joriy holatda ma'nosiz bo'lsa — ko'rsatilmaydi (spec §7):
/// - Arxivlangan talaba → "Tahrirlash" emas, "Qayta tiklash" ko'rsatiladi.
/// - To'langan to'lov → "To'lovni qayd etish" ko'rsatilmaydi.
class ContextualActionResolver {
  const ContextualActionResolver();

  /// Talaba uchun kontekstual amallar.
  List<ContextualAction> forStudent(Student student) {
    final actions = <ContextualAction>[
      ContextualAction(
        id: 'student.view',
        title: 'Profilni ko\'rish',
        iconKey: 'view',
        route: '/students/${student.identityId}',
        reason: 'Talaba profili',
      ),
    ];

    if (student.isActive) {
      actions.addAll([
        ContextualAction(
          id: 'student.edit',
          title: 'Tahrirlash',
          iconKey: 'edit',
          route: '/identity/register',
          reason: 'Profil ma\'lumotlarini yangilash',
        ),
        ContextualAction(
          id: 'student.attendance',
          title: 'Davomatni belgilash',
          iconKey: 'attendance',
          route: '/attendance',
          reason: 'Bugungi davomat uchun',
        ),
        ContextualAction(
          id: 'student.payment',
          title: 'To\'lov qayd etish',
          iconKey: 'payment',
          route: '/payments/new',
          reason: 'To\'lov qabul qilish',
        ),
        ContextualAction(
          id: 'student.notes',
          title: 'Izoh qo\'shish',
          iconKey: 'notes',
          route: '/students/${student.identityId}',
          reason: 'Talaba haqida eslatma',
        ),
      ]);
    } else if (student.studentStatus == StudentStatus.archived) {
      actions.add(
        ContextualAction(
          id: 'student.restore',
          title: 'Qayta tiklash',
          iconKey: 'restore',
          route: '/students/${student.identityId}',
          reason: 'Arxivdan faol holatga qaytarish',
        ),
      );
    }

    actions.add(
      ContextualAction(
        id: 'student.history',
        title: 'Faoliyat tarixi',
        iconKey: 'history',
        route: '/students/${student.identityId}',
        reason: 'To\'lov/davomat/faoliyat yozuvlari',
      ),
    );

    return actions;
  }

  /// To'lov uchun kontekstual amallar.
  List<ContextualAction> forPayment(Payment payment) {
    final actions = <ContextualAction>[
      ContextualAction(
        id: 'payment.view',
        title: 'To\'lovni ko\'rish',
        iconKey: 'view',
        route: '/finance/payments',
        reason: 'Kvitansiya va tafsilotlar',
      ),
    ];

    if (!payment.isCompleted) {
      actions.add(
        ContextualAction(
          id: 'payment.complete',
          title: 'To\'lovni yakunlash',
          iconKey: 'payment',
          route: '/payments/new',
          reason: 'To\'lov hali yakunlanmagan',
        ),
      );
    }

    actions.addAll([
      ContextualAction(
        id: 'payment.receipt',
        title: 'Kvitansiya',
        iconKey: 'receipt',
        route: '/finance/payments',
        reason: 'Kvitansiya raqami: '
            '${payment.receiptNumber ?? 'mavjud emas'}',
      ),
      ContextualAction(
        id: 'payment.history',
        title: 'To\'lovlar tarixi',
        iconKey: 'history',
        route: '/finance',
        reason: 'Talabaning barcha to\'lovlari',
      ),
    ]);

    return actions;
  }

  /// Identity uchun amallar (talaba bo'lmagan shaxslar).
  List<ContextualAction> forIdentity(Identity identity) {
    return [
      ContextualAction(
        id: 'identity.view',
        title: 'Profilni ko\'rish',
        iconKey: 'view',
        route: '/identity/${identity.identityId}',
        reason: 'Shaxs profili',
      ),
      if (identity.isActive)
        ContextualAction(
          id: 'identity.face',
          title: 'Face ID ro\'yxatga olish',
          iconKey: 'face',
          route: '/face-enroll/${identity.identityId}',
          reason: 'Yuzni ro\'yxatga olish (Face ID davomati)',
        ),
    ];
  }

  /// [CommandAction] kontekstual amaldan yaratish (palette uchun).
  CommandAction toCommand(ContextualAction action) {
    return CommandAction(
      id: action.id,
      title: action.title,
      subtitle: action.reason,
      iconKey: action.iconKey,
      category: CommandCategory.navigation,
      route: action.route,
      isBranchGo: action.isBranchGo,
    );
  }
}
