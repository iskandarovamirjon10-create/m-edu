import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../tokens/tokens.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// DS LOADING — Skeleton shimmer + centered spinner
/// ═══════════════════════════════════════════════════════════════════════

/// Shimmer skeleton box
class DsSkeleton extends StatelessWidget {
  final double? width;
  final double? height;
  final BorderRadius? borderRadius;

  const DsSkeleton({
    super.key,
    this.width,
    this.height,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Shimmer.fromColors(
      baseColor: colors.fill,
      highlightColor: colors.surface,
      child: Container(
        width: width,
        height: height ?? 16,
        decoration: BoxDecoration(
          color: colors.fill,
          borderRadius: borderRadius ?? DsRadius.smAll,
        ),
      ),
    );
  }
}

/// Pre-built skeleton for a list item
class DsSkeletonListTile extends StatelessWidget {
  const DsSkeletonListTile({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: DsSpacing.rowH,
      child: Row(
        children: [
          DsSkeleton(width: 44, height: 44, borderRadius: DsRadius.smAll),
          const SizedBox(width: DsSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const DsSkeleton(width: double.infinity, height: 14),
                const SizedBox(height: DsSpacing.sm),
                DsSkeleton(
                  width: MediaQuery.sizeOf(context).width * 0.4,
                  height: 12,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Centered loading spinner
class DsLoading extends StatelessWidget {
  final String? message;

  const DsLoading({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(DsSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: colors.accent),
            if (message != null) ...[
              const SizedBox(height: DsSpacing.lg),
              Text(message!, style: DsType.body(color: colors.textSecondary)),
            ],
          ],
        ),
      ),
    );
  }
}
