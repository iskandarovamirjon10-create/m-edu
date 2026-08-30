import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/command.dart';

/// Markaziy buyruq reyestri.
///
/// UI'da hardcode qilingan switch emas — barcha buyruqlar shu reyestr
/// orqali ro'yxatdan o'tadi. Har bir buyruq o'z [CommandAction] ta'rifiga
/// ega (id, sarlavha, kategoriya, kalit so'zlar, ruxsat, marshrut).
///
/// Reyestr sof to'plam: qidiruv/reytinq alohida ([CommandRanker]),
/// bajarish presentation qatlamida (go_router + handler map).
class CommandRegistry {
  final Map<String, CommandAction> _commands = {};

  /// Buyruqni ro'yxatdan o'tkazadi. Xuddi shu ID bilan qayta ro'yxatdan
  /// o'tkazish — eski ta'rifni almashtiradi (deterministik).
  void register(CommandAction command) {
    _commands[command.id] = command;
  }

  /// Bir nechta buyruqni ro'yxatdan o'tkazadi.
  void registerAll(Iterable<CommandAction> commands) {
    for (final command in commands) {
      register(command);
    }
  }

  /// Buyruqni olib tashlaydi.
  void unregister(String id) {
    _commands.remove(id);
  }

  /// Barcha buyruqlar (ro'yxatdan o'tish tartibida).
  List<CommandAction> get all => List.unmodifiable(_commands.values);

  /// ID bo'yicha buyruq.
  CommandAction? byId(String id) => _commands[id];

  /// Foydalanuvchi roli uchun ruxsat etilgan buyruqlar.
  List<CommandAction> availableFor(UserRole role) {
    return all
        .where((c) =>
            c.requiredPermission == null ||
            Permissions.can(role, c.requiredPermission!))
        .toList();
  }

  int get length => _commands.length;
}
