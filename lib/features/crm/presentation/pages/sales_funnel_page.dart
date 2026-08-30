import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/glass_card.dart';
import '../../application/services/sales_funnel_analytics.dart';
import '../../domain/entities/lead.dart';
import '../providers/lead_providers.dart';

/// Sales funnel analitikasi sahifasi — bosqichlar, conversion rate,
/// lost rate va umumiy statistika.
class SalesFunnelPage extends ConsumerWidget {
  const SalesFunnelPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final colors = context.dsColors;
    final analytics = SalesFunnelAnalytics(ref.watch(leadRepositoryProvider));

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.crmTitle),
        backgroundColor: context.dsColors.accent,
        foregroundColor: Colors.white,
      ),
      body: FutureBuilder<List<Object>>(
        future: Future.wait([
          analytics.funnelData(),
          analytics.overallConversionRate(),
          analytics.lostRate(),
          analytics.conversionRates(),
        ]),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Text(
                userFriendlyMessage(snapshot.error!),
                style: TextStyle(color: colors.textSecondary),
              ),
            );
          }

          final funnelData = snapshot.data![0] as List<FunnelStageData>;
          final conversionRate = snapshot.data![1] as double;
          final lostRate = snapshot.data![2] as double;
          final conversionRates =
              snapshot.data![3] as Map<String, double>;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Umumiy ko'rsatkichlar
                _buildSummaryCards(
                  context,
                  conversionRate: conversionRate,
                  lostRate: lostRate,
                  totalLeads: funnelData.fold(0, (s, d) => s + d.count),
                ),
                const SizedBox(height: 20),

                // Funnel vizualizatsiyasi
                Text(
                  'Sotish voronkasi',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                _buildFunnel(context, funnelData),
                const SizedBox(height: 24),

                // Conversion rate
                if (conversionRates.isNotEmpty) ...[
                  Text(
                    'Bosqichlararo konvertatsiya',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildConversionRates(context, conversionRates),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSummaryCards(
    BuildContext context, {
    required double conversionRate,
    required double lostRate,
    required int totalLeads,
  }) {
    final colors = context.dsColors;
    return Row(
      children: [
        Expanded(
          child: _SummaryCard(
            title: 'Jami lead',
            value: '$totalLeads',
            color: context.dsColors.accent,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _SummaryCard(
            title: 'Konvertatsiya',
            value: '${conversionRate.toStringAsFixed(1)}%',
            color: context.dsColors.success,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _SummaryCard(
            title: 'Yo\'qotilgan',
            value: '${lostRate.toStringAsFixed(1)}%',
            color: context.dsColors.error,
          ),
        ),
      ],
    );
  }

  Widget _buildFunnel(BuildContext context, List<FunnelStageData> data) {
    final colors = context.dsColors;
    final maxCount = data.isEmpty
        ? 1
        : data.map((d) => d.count).reduce((a, b) => a > b ? a : b);

    return Column(
      children: [
        for (final stage in data)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 100,
                  child: Text(
                    stage.label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                Expanded(
                  child: Stack(
                    children: [
                      Container(
                        height: 32,
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      FractionallySizedBox(
                        widthFactor:
                            maxCount > 0 ? stage.count / maxCount : 0,
                        child: Container(
                          height: 32,
                          decoration: BoxDecoration(
                            color: _stageColor(context, stage.stage)
                                .withValues(alpha: 0.7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 50,
                  child: Text(
                    '${stage.count}',
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildConversionRates(
    BuildContext context,
    Map<String, double> rates,
  ) {
    final colors = context.dsColors;
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          for (final entry in rates.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      entry.key,
                      style: TextStyle(
                        fontSize: 13,
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: context.dsColors.success.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${entry.value.toStringAsFixed(0)}%',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: context.dsColors.success,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Color _stageColor(BuildContext context, LeadStage stage) => switch (stage) {
        LeadStage.newLead => context.dsColors.info,
        LeadStage.contacted => context.dsColors.accent,
        LeadStage.trialScheduled => context.dsColors.warning,
        LeadStage.converted => context.dsColors.success,
        LeadStage.lost => context.dsColors.error,
      };
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const _SummaryCard({
    required this.title,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: TextStyle(
              fontSize: 11.5,
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
