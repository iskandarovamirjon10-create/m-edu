import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../design/tokens/tokens.dart';

/// Loading Shimmer — skeleton placeholder while content loads.
///
/// Uses DsColors tokens for theme-aware colors.
class LoadingShimmer extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const LoadingShimmer({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Shimmer.fromColors(
      baseColor: colors.fill,
      highlightColor: colors.surface,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: colors.fill,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// Card shimmer — card-shaped loading placeholder.
class CardShimmer extends StatelessWidget {
  const CardShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Shimmer.fromColors(
      baseColor: colors.fill,
      highlightColor: colors.surface,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colors.fill,
          borderRadius: DsRadius.lgAll,
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: colors.fill,
                borderRadius: DsRadius.lgAll,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 120,
                    height: 16,
                    decoration: BoxDecoration(
                      color: colors.fill,
                      borderRadius: DsRadius.xsAll,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: 80,
                    height: 12,
                    decoration: BoxDecoration(
                      color: colors.fill,
                      borderRadius: DsRadius.xsAll,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
