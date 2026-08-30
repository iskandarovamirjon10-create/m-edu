import 'package:equatable/equatable.dart';

import '../../../audit/domain/entities/audit_log_entry.dart';

/// Student 360 — AUDIT snapshot.
///
/// Student va unga tegishli barcha entity'lar uchun audit log
/// yozuvlari (targetType='student', targetId=identityId) +
/// `targetType='identity'` va `targetType='payment'` kabi bog'liq
/// yozuvlar birlashtiriladi.
///
/// MUHIM: bu yerda M-EDU audit tizimining kuchi ishlatiladi —
/// har bir muhim amal avtomatik ravishda audit log'ga yoziladi
/// (event projector orqali). Shuning uchun bu snapshot REAL data
/// ko'rsatadi, FABRICATE EMAS.
class AuditSnapshot extends Equatable {
  final List<AuditLogEntry> entries;

  /// Oxirgi 5 ta audit yozuvi (tezkor ko'rsatish uchun).
  final List<AuditLogEntry> recentEntries;

  /// Eng eski yozuv sanasi (snapshot qamrovi).
  final DateTime? oldestAt;

  /// Eng yangi yozuv sanasi.
  final DateTime? newestAt;

  const AuditSnapshot({
    required this.entries,
    required this.recentEntries,
    required this.oldestAt,
    required this.newestAt,
  });

  /// Bo'sh snapshot — student uchun hali audit yozuvlari yo'q.
  const AuditSnapshot.empty()
      : entries = const [],
        recentEntries = const [],
        oldestAt = null,
        newestAt = null;

  bool get hasAny => entries.isNotEmpty;
  int get count => entries.length;

  @override
  List<Object?> get props => [
        entries,
        recentEntries,
        oldestAt,
        newestAt,
      ];
}
