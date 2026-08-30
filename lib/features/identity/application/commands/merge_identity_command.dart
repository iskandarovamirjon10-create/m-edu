import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../attendance/domain/repositories/attendance_repository.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../../face_recognition/domain/repositories/face_recognition_repository.dart';
import '../../../payments/domain/repositories/payment_repository.dart';
import '../../../students/domain/repositories/student_repository.dart';
import '../../domain/entities/identity.dart';
import '../../domain/entities/identity_activity.dart';
import '../../domain/events/identity_events.dart';
import '../../domain/repositories/identity_repository.dart';

/// Ikki identity'ni birlashtirish so'rovi (Command input).
class MergeIdentityRequest {
  /// Asosiy saqlanadigan identity (survivor).
  final String primaryIdentityId;

  /// Birlashtiriladigan identity (duplicate) — arxivlanadi.
  final String duplicateIdentityId;

  /// Birlashtirish sababi (ixtiyoriy, audit-log uchun).
  final String? reason;

  const MergeIdentityRequest({
    required this.primaryIdentityId,
    required this.duplicateIdentityId,
    this.reason,
  });
}

/// `MergeIdentity` command'i — identity merge/dedup (spec §6 #5).
///
/// Oqim: identifikatsiya → validatsiya → bog'liq yozuvlarni repoint →
/// timeline ko'chirish → survivor'ni to'ldirish → duplicate'ni arxivlash →
/// audit yozuvi → event tarqatish.
///
/// P0-01 (AUDIT): merge faqat Identity va IdentityActivity'ni ko'chirar edi —
/// duplicate arxivlangach uning to'lov tarixi, qarzdorlik, davomat, talaba
/// profili va yuz bazasi "o'lik" identityId'da osilib qolardi. Endi barcha
/// bog'liq kolleksiyalar repoint qilinadi:
/// Student, Payment/Debt, Attendance, Face.
///
/// Xatolik/yaklitlik strategiyasi: repoint amallari IDEMPOTENT (qayta
/// chaqirilsa 0 qaytaradi) — qisman bajarilgan bo'lsa ham command'ni qayta
/// ishga tushirish ishni yakunlaydi, ma'lumot yo'qolmaydi.
class MergeIdentityCommand {
  final IdentityRepository _repository;
  final StudentRepository _studentRepository;
  final PaymentRepository _paymentRepository;
  final AttendanceRepository _attendanceRepository;
  final FaceRecognitionRepository _faceRepository;
  final EventBus _eventBus;
  final AuditService? _audit;

  /// RBAC (AUDIT P2-02): identity birlashtirish — o'quvchilar boshqaruvi.
  final UserRole actorRole;

  MergeIdentityCommand({
    required IdentityRepository repository,
    required StudentRepository studentRepository,
    required PaymentRepository paymentRepository,
    required AttendanceRepository attendanceRepository,
    required FaceRecognitionRepository faceRepository,
    required EventBus eventBus,
    AuditService? auditService,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _studentRepository = studentRepository,
        _paymentRepository = paymentRepository,
        _attendanceRepository = attendanceRepository,
        _faceRepository = faceRepository,
        _eventBus = eventBus,
        _audit = auditService;

  Future<Identity> execute(MergeIdentityRequest request) async {
    Permissions.require(actorRole, AppPermission.studentsEdit);

    final primary =
        await _repository.fetchByIdentityId(request.primaryIdentityId);
    if (primary == null) {
      throw NotFoundFailure(
        'Asosiy identity topilmadi: ${request.primaryIdentityId}',
      );
    }
    final duplicate =
        await _repository.fetchByIdentityId(request.duplicateIdentityId);
    if (duplicate == null) {
      throw NotFoundFailure(
        'Birlashtiriladigan identity topilmadi: ${request.duplicateIdentityId}',
      );
    }
    if (primary.identityId == duplicate.identityId) {
      throw const ValidationFailure(
        'Identity o\'z-o\'zi bilan birlashtirilmaydi',
      );
    }

    final now = DateTime.now();
    final merged = _mergeFields(primary, duplicate, now);
    final droppedFields = _conflictingFields(primary, duplicate);

    // 1) P0-01: duplicate identity'ga bog'langan barcha yozuvlarni
    //    survivor'ga ko'chiramiz. Tartib: moliya → davomat → talaba → yuz
    //    (activity timeline alohida). Har bir amal idempotent.
    final financialCount =
        await _paymentRepository.repointPaymentAndDebtReferences(
      duplicate.identityId,
      primary.identityId,
    );
    final attendanceCount =
        await _attendanceRepository.repointIdentityReferences(
      duplicate.identityId,
      primary.identityId,
    );
    final studentCount = await _studentRepository.repointIdentityReferences(
      duplicate.identityId,
      primary.identityId,
    );
    final faceHandled = await _faceRepository.repointIdentityReferences(
      duplicate.identityId,
      primary.identityId,
    );

    // 2) Duplicate'ning Activity Timeline'ini survivor'ga ko'chirish —
    //    merge'dan so'ng barcha voqealar bitta timeline'da qoladi.
    await _repository.repointActivities(
      duplicate.identityId,
      primary.identityId,
    );

    // 3) Survivor'ni to'ldirilgan maydonlar bilan saqlash.
    final saved = await _repository.update(merged);

    // 4) Duplicate'ni arxivlash (audit izi va havolalar saqlanib qoladi,
    //    hard-delete emas).
    await _repository.updateStatus(
        duplicate.identityId, IdentityStatus.archived);

    // 5) Audit-log: merge hodisasi survivor timeline'iga yoziladi.
    //    Ikkala tomonda ham qiymat bor-u, farq qiladigan maydonlar (masalan,
    //    telefon) duplicate'da qolgani uchun yo'qoladi — bu audit'da qayd
    //    etiladi (ma'lumot yo'qotish izsiz ketmaydi).
    final reasonText =
        request.reason != null && request.reason!.trim().isNotEmpty
            ? ' Sabab: ${request.reason!.trim()}'
            : '';
    final conflictNote = droppedFields.isEmpty
        ? ''
        : ' O\'chirilgan ma\'lumotlar: ${droppedFields.join(', ')}.';
    final repointNote = ' Ko\'chirildi: $financialCount to\'lov/qarz, '
        '$attendanceCount davomat, $studentCount talaba, $faceHandled yuz.';
    await _repository.recordActivity(
      IdentityActivity(
        identityId: saved.identityId,
        type: IdentityActivityTypes.identityMerged,
        description: '${duplicate.fullName} (${duplicate.identityId}) bilan '
            'birlashtirildi. Asosiy: ${saved.fullName} (${saved.identityId}).'
            '$conflictNote$repointNote$reasonText',
        occurredAt: now,
      ),
    );

    // 6) Umumiy audit log (who/what/when/target — §33).
    await _audit?.record(
      action: AuditAction.identityMerged,
      targetType: 'identity',
      targetId: saved.identityId,
      details: '${saved.fullName} ← ${duplicate.fullName} '
          '(${duplicate.identityId})$repointNote',
    );

    // 7) Event-Driven: boshqa modullar merge'ni bilishi uchun.
    _eventBus.publish(IdentityMergedEvent(
      primary: saved,
      duplicate: duplicate,
      occurredAt: now,
    ));

    return saved;
  }

  /// Survivor o'z maydonlarini saqlaydi; faqat bo'sh (null) maydonlar
  /// duplicate'dan to'ldiriladi — hech qachon mavjud qiymat ustiga
  /// yozilmaydi (ma'lumot yo'qotish xavfi yo'q).
  Identity _mergeFields(Identity primary, Identity duplicate, DateTime now) {
    return Identity(
      identityId: primary.identityId,
      firstName: primary.firstName,
      lastName: primary.lastName,
      middleName: primary.middleName ?? duplicate.middleName,
      role: primary.role,
      status: primary.status,
      phone: primary.phone ?? duplicate.phone,
      email: primary.email ?? duplicate.email,
      photoPath: primary.photoPath ?? duplicate.photoPath,
      qrSeed: primary.qrSeed,
      createdAt: primary.createdAt,
      updatedAt: now,
      syncVersion: primary.syncVersion + 1,
      pendingSync: true,
    );
  }

  /// Ikkala tomonda ham qiymat bor-u, farq qiladigan maydonlar ro'yxati
  /// (audit yozuvida ko'rsatiladi). Bunday qiymatlar merge'da duplicate
  /// arxivlangani uchun yo'qoladi.
  List<String> _conflictingFields(Identity primary, Identity duplicate) {
    final fields = <String>[];
    if (primary.phone != null &&
        duplicate.phone != null &&
        primary.phone != duplicate.phone) {
      fields.add('eski telefon: ${duplicate.phone}');
    }
    if (primary.email != null &&
        duplicate.email != null &&
        primary.email != duplicate.email) {
      fields.add('eski email: ${duplicate.email}');
    }
    return fields;
  }
}
