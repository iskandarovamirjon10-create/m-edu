import 'package:isar/isar.dart';

import '../../../../features/identity/infrastructure/models/sequence_counter.dart';
import '../../domain/services/lead_id_generator.dart';

/// `LeadIdGenerator` interfeysining Isar asosidagi implementatsiyasi.
///
/// `LEAD-2026-000123` formatidagi ketma-ket Real ID. Har bir chaqiruv
/// atomik tranzaksiya ichida hisoblagichni oshiradi — parallel yozuvlarda
/// ham ID takrorlanmaydi (IdentitySequenceGenerator pattern'iga mos).
class LeadSequenceGenerator implements LeadIdGenerator {
  static const String counterName = 'lead';

  final Isar _db;

  LeadSequenceGenerator(this._db);

  @override
  Future<String> next() async {
    final sequence = await _db.writeTxn(() async {
      final existing = await _db.sequenceCounters
          .filter()
          .nameEqualTo(counterName)
          .findFirst();

      final nextValue = (existing?.value ?? 0) + 1;
      if (existing == null) {
        await _db.sequenceCounters.put(
          SequenceCounter()..name = counterName..value = nextValue,
        );
      } else {
        existing.value = nextValue;
        await _db.sequenceCounters.put(existing);
      }
      return nextValue;
    });

    final year = DateTime.now().year;
    return 'LEAD-$year-${sequence.toString().padLeft(6, '0')}';
  }
}
