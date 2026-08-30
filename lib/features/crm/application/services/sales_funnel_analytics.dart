import '../../domain/entities/lead.dart';
import '../../domain/repositories/lead_repository.dart';

/// Sales funnel analitikasi — bosqichlar bo'yicha statistika.
class SalesFunnelAnalytics {
  final LeadRepository _repository;

  SalesFunnelAnalytics(this._repository);

  /// Har bir bosqichdagi lead'lar soni.
  Future<Map<LeadStage, int>> countByStage() async {
    final result = <LeadStage, int>{};
    for (final stage in LeadStage.values) {
      result[stage] = await _repository.countByStage(stage);
    }
    return result;
  }

  /// Bosqichlar bo'yicha conversion rate (foiz).
  ///
  /// Masalan: New→Contacted = contacted_count / total_count * 100
  Future<Map<String, double>> conversionRates() async {
    final counts = await countByStage();
    final total = counts.values.fold(0, (sum, c) => sum + c);
    if (total == 0) return {};

    final rates = <String, double>{};
    final nonFinal = [LeadStage.newLead, LeadStage.contacted, LeadStage.trialScheduled];

    for (var i = 0; i < nonFinal.length; i++) {
      final current = nonFinal[i];
      final next = i + 1 < nonFinal.length ? nonFinal[i + 1] : LeadStage.converted;
      final currentCount = counts[current] ?? 0;
      final nextCount = (counts[next] ?? 0) + (counts[LeadStage.converted] ?? 0);

      if (currentCount > 0) {
        rates['${_stageName(current)} → ${_stageName(next)}'] =
            (nextCount / currentCount * 100).roundToDouble();
      }
    }

    return rates;
  }

  /// Umumiy conversion rate: converted / total.
  Future<double> overallConversionRate() async {
    final counts = await countByStage();
    final total = counts.values.fold(0, (sum, c) => sum + c);
    if (total == 0) return 0;
    return (counts[LeadStage.converted] ?? 0) / total * 100;
  }

  /// Lost rate: lost / total.
  Future<double> lostRate() async {
    final counts = await countByStage();
    final total = counts.values.fold(0, (sum, c) => sum + c);
    if (total == 0) return 0;
    return (counts[LeadStage.lost] ?? 0) / total * 100;
  }

  /// Funnel ma'lumotlari (UI uchun qulay format).
  Future<List<FunnelStageData>> funnelData() async {
    final counts = await countByStage();
    final total = counts.values.fold(0, (sum, c) => sum + c);

    return LeadStage.values.map((stage) {
      final count = counts[stage] ?? 0;
      final percentage = total > 0 ? (count / total * 100).roundToDouble() : 0.0;
      return FunnelStageData(
        stage: stage,
        count: count,
        percentage: percentage,
        label: _stageName(stage),
      );
    }).toList();
  }

  static String _stageName(LeadStage stage) => switch (stage) {
        LeadStage.newLead => 'Yangi',
        LeadStage.contacted => 'Bog\'landi',
        LeadStage.trialScheduled => 'Sinov darsi',
        LeadStage.converted => 'Konvertatsiya',
        LeadStage.lost => 'Yo\'qotilgan',
      };
}

/// Funnel bosqichi ma'lumotlari (UI uchun).
class FunnelStageData {
  final LeadStage stage;
  final int count;
  final double percentage;
  final String label;

  const FunnelStageData({
    required this.stage,
    required this.count,
    required this.percentage,
    required this.label,
  });
}
