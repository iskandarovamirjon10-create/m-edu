/// Yaqinda ishlatilgan buyruq ID'larini kuzatuvchi (session ichida).
///
/// [CommandRanker] recency bonus va "Recent" kategoriyasi uchun ishlatadi.
/// Deterministik va testlanadigan; persistensiya kerak bo'lsa, bu sinf
/// almashtiriladi (interfeys bir xil qoladi).
class RecentUsageTracker {
  /// Buyruq ID → oxirgi ishlatilish sanasi (vaqt).
  final Map<String, DateTime> _lastUsed = {};

  /// Buyruq ID → necha marta ishlatilgani (frequency).
  final Map<String, int> _usageCount = {};

  /// Limit — cheksiz o'sishni oldini olish (memory).
  static const int _maxTracked = 50;

  /// Buyruq ishlatilganini qayd etadi.
  void record(String commandId, {DateTime? now}) {
    final timestamp = now ?? DateTime.now();
    _lastUsed[commandId] = timestamp;
    _usageCount[commandId] = (_usageCount[commandId] ?? 0) + 1;

    // Eng eski yozuvlarni cheklash (LRU-ish — oddiy).
    if (_lastUsed.length > _maxTracked) {
      final oldest = _lastUsed.entries.reduce(
        (a, b) => a.value.isBefore(b.value) ? a : b,
      );
      _lastUsed.remove(oldest.key);
      _usageCount.remove(oldest.key);
    }
  }

  /// Yaqinda ishlatilgan buyruq ID'lari (eng yangi birinchi).
  List<String> get recentIds {
    final sorted = _lastUsed.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return sorted.map((e) => e.key).toList();
  }

  /// Oxirgi ishlatilgan N ta buyruq.
  List<String> recent(int limit) => recentIds.take(limit).toList();

  /// Buyruq necha marta ishlatilgani.
  int countOf(String commandId) => _usageCount[commandId] ?? 0;

  /// Buyruq yaqinda ishlatilganmi.
  bool wasUsedRecently(String commandId) => _lastUsed.containsKey(commandId);
}
