import 'package:equatable/equatable.dart';

/// Tashkilot (ta'lim markazi) agregati — first-run wizard orqali
/// kiritiladigan haqiqiy ma'lumotlar (spec §5).
///
/// "No Demo Data" siyosati: hech qanday namunaviy tashkilot nomi
/// oldindan kiritilmaydi — bu yozuv faqat admin real ma'lumot
/// kiritgandan so'ng paydo bo'ladi.
class Organization extends Equatable {
  final String organizationName;
  final String branchName;
  final String? roomName;
  final String? courseName;

  final DateTime createdAt;

  /// Onlayn/oflayn sinxronizatsiya uchun.
  final int syncVersion;
  final bool pendingSync;

  const Organization({
    required this.organizationName,
    required this.branchName,
    this.roomName,
    this.courseName,
    required this.createdAt,
    this.syncVersion = 1,
    this.pendingSync = true,
  });

  @override
  List<Object?> get props => [
        organizationName,
        branchName,
        roomName,
        courseName,
        createdAt,
        syncVersion,
        pendingSync,
      ];
}
