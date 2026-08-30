import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../application/commands/setup_organization_command.dart';
import '../../application/queries/organization_queries.dart';
import '../../domain/entities/organization.dart';
import '../../domain/repositories/organization_repository.dart';
import '../../infrastructure/datasources/isar_organization_datasource.dart';
import '../../infrastructure/repositories_impl/organization_repository_impl.dart';

final organizationRepositoryProvider = Provider<OrganizationRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return OrganizationRepositoryImpl(IsarOrganizationDataSource(db.instance));
});

final setupOrganizationCommandProvider = Provider<SetupOrganizationCommand>(
  (ref) => SetupOrganizationCommand(
    repository: ref.watch(organizationRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

final organizationQueriesProvider = Provider<OrganizationQueries>(
  (ref) => OrganizationQueries(repository: ref.watch(organizationRepositoryProvider)),
);

/// O'rnatish holati o'zgarganda ro'yxatlarni yangilash uchun versiya.
final organizationSetupVersionProvider = StateProvider<int>((ref) => 0);

final organizationProvider = FutureProvider<Organization?>((ref) {
  ref.watch(organizationSetupVersionProvider);
  return ref.watch(organizationQueriesProvider).fetchCurrent();
});

/// First-run wizard kerakmi? (tashkilot hali o'rnatilmagan bo'lsa — true)
/// `organizationProvider` dan hosil qilinadi — ortiqcha DB o'qish yo'q.
final organizationRequiresSetupProvider = FutureProvider<bool>((ref) async {
  final organization = await ref.watch(organizationProvider.future);
  return organization == null;
});
