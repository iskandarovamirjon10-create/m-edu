import 'package:isar/isar.dart';

part 'sequence_counter.g.dart';

/// Real ID ketma-ketliklarini saqlovchi atomik hisoblagich.
///
/// "No Demo Data" siyosatining kaliti (spec §5): barcha ID'lar shu
/// hisoblagichdan olinadi, hech qachon hardcode qilinmaydi.
@collection
class SequenceCounter {
  Id id = Isar.autoIncrement;

  /// Hisoblagich nomi, masalan `identity`, `payment`.
  @Index(unique: true, replace: true)
  late String name;

  /// Oxirgi berilgan qiymat.
  late int value;
}
