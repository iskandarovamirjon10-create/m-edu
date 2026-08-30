import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../event_bus/event_bus.dart';

/// `main()` da `ProviderScope(overrides: ...)` orqali haqiqiy qiymat
/// bilan override qilinadi. Bu test'larga ham xizmat qiladi — test
/// `overrideWithValue` orqali o'z fake database'ini berishi mumkin.
final appDatabaseProvider = Provider<AppDatabase>(
  (ref) => throw UnimplementedError(
    'AppDatabaseProvider main() da override qilinishi shart',
  ),
);

/// Global event bus — barcha feature'lar o'zaro shu orqali bog'lanadi.
final eventBusProvider = Provider<EventBus>((ref) {
  final bus = EventBus();
  ref.onDispose(bus.dispose);
  return bus;
});
