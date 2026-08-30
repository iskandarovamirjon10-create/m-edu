import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/session_manager.dart';
import '../../../../core/di/core_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/audit_log_entry.dart';
import '../../application/queries/audit_queries.dart';
import '../../application/services/audit_service.dart';
import '../../domain/repositories/audit_repository.dart';
import '../../infrastructure/datasources/isar_audit_datasource.dart';
import '../../infrastructure/repositories_impl/audit_repository_impl.dart';

/// Audit repository provider.
final auditRepositoryProvider = Provider<AuditRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return AuditRepositoryImpl(IsarAuditDataSource(db.instance));
});

/// Audit yozuvlarini bajaruvchi aktorni joriy sessiyadan aniqlaydi.
///
/// Sessiya bo'lmasa (masalan, ilova ishga tushayotganda) — [AuditActor.system]
/// ishlatiladi. Xato bo'lsa ham audit ishdan chiqmaydi (actorni log qilmaydi).
Future<AuditActor> _loadActor() async {
  try {
    final session = await SessionManager().loadSession();
    if (session != null) {
      return AuditActor(
        userId: session.userId,
        name: session.displayName,
        role: _roleFromString(session.role),
      );
    }
  } catch (_) {
    // Sessiyani o'qish xatosi — system aktor bilan davom etamiz.
  }
  return AuditActor.system;
}

UserRole _roleFromString(String? role) {
  // AUDIT P2-03: wire format ('super_admin') ↔ enum nomi ('superAdmin').
  // FAIL CLOSED: noma'lum rol — hech qachon admin emas.
  return UserRole.fromWire(role);
}

/// Audit xizmati (application facade).
final auditServiceProvider = Provider<AuditService>((ref) {
  return AuditService(
    repository: ref.watch(auditRepositoryProvider),
    actorLoader: _loadActor,
  );
});

/// Audit log ro'yxati (so'nggi 50 ta).
final auditLogListVersionProvider = StateProvider<int>((ref) => 0);

final auditLogListProvider = FutureProvider<List<AuditLogEntry>>((ref) async {
  ref.watch(auditLogListVersionProvider);
  return ref.watch(auditQueriesProvider).fetchRecent(limit: 50);
});

/// Audit so'rovlari.
final auditQueriesProvider = Provider<AuditQueries>(
  (ref) => AuditQueries(repository: ref.watch(auditRepositoryProvider)),
);
