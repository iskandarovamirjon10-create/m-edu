import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU PERFORMANCE TIER — Design Constitution v4.0 §N / §AH / §AG
///
///   T1  — real-time blur (60fps, visual-effect cost ≤10ms/frame)
///   T2  — reduced real-time blur (60fps, cost ≤5ms/frame)
///   T3  — flat tinted material (≥45fps floor, no sustained jank)
///
/// §AG: "Riverpod exposes performance tier through one
/// PerformanceTierProvider; components do not independently detect device
/// performance."
///
/// STATUS: FOUNDATION ONLY — P0 (C-32). Detection is a CHEAP provisional
/// heuristic; exact thresholds are REQUIRES VALIDATION on a device matrix
/// (v4.0 §AL, report §E). No component rendering behavior is gated on this
/// provider yet — glass blur/opacity values (C-33) remain unchanged until
/// validated. Unknown devices default to T3 (conservative, §AH).
///
/// Rule: components read the tier via `context.performanceTier` or
/// `ref.watch(performanceTierProvider)` — never self-detect hardware.
/// ═══════════════════════════════════════════════════════════════════════

/// Qurilma ishlash darajasi.
enum PerformanceTier { t1, t2, t3 }

// ─── PROVISIONAL heuristic thresholds (REQUIRES VALIDATION) ──────────────
// CPU-core count is used only because it is a free, cheap signal
// (dart:io). Device RAM/GPU class is not exposed without a plugin; the
// device matrix benchmark (report §E / GAPS-G3) will replace this mapping.
const int _t1MinCores = 8;
const int _t2MinCores = 4;

/// CPU core sonidan darajani aniqlash — toza funksiya (test uchun).
PerformanceTier performanceTierFromCoreCount(int cores) {
  if (cores >= _t1MinCores) return PerformanceTier.t1;
  if (cores >= _t2MinCores) return PerformanceTier.t2;
  return PerformanceTier.t3;
}

/// Web / noma'lum platformada eng konservativ daraja.
PerformanceTier _detectTier() {
  if (kIsWeb) return PerformanceTier.t3;
  return performanceTierFromCoreCount(Platform.numberOfProcessors);
}

/// Yagona PerformanceTierProvider (§AG).
final performanceTierProvider = Provider<PerformanceTier>(
  (ref) => _detectTier(),
);

/// `context.performanceTier` — joriy daraja (ProviderScope ichida bo'lishi
/// shart; bo'lmasa T3 default — konservativ).
extension PerformanceTierContextX on BuildContext {
  PerformanceTier get performanceTier {
    final container = ProviderScope.containerOf(this, listen: false);
    return container.read(performanceTierProvider);
  }
}
