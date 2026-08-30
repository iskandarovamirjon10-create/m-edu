import 'package:flutter/material.dart';
import '../../../../core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../attendance/application/commands/record_attendance_command.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../infrastructure/services/signed_qr_service.dart';
import '../providers/identity_providers.dart';

/// Digital ID Card QR-kodini skanerlab, identity profilini ochadi
/// (spec §3: QR + RFID + Face uch faktorli identifikatsiya — QR qismi).
class IdentityScanPage extends ConsumerStatefulWidget {
  const IdentityScanPage({super.key});

  @override
  ConsumerState<IdentityScanPage> createState() => _IdentityScanPageState();
}

class _IdentityScanPageState extends ConsumerState<IdentityScanPage> {
  bool _handled = false;

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled) return;

    final raw =
        capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
    if (raw == null || !raw.startsWith('M-EDU-')) return;

    _handled = true;

    // ── P1.5: Signed QR verify zanjiri ──────────────────────────────────
    // QR → parse → signature verify → expiry check → replay protection.
    // Oddiy (imzolanmagan) student ID QR'lari rad etiladi — "QR kod
    // yaroqsiz" (spec §6: QR endi oddiy student ID emas).
    final verification =
        await ref.read(signedQrServiceProvider).verify(raw, DateTime.now());
    if (!mounted) return;

    if (!verification.isValid) {
      _handled = false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_qrErrorMessage(verification.status)),
          backgroundColor: context.dsColors.error,
        ),
      );
      return;
    }

    // Identity'ni topamiz va davomatni QR orqali belgilaymiz (spec §6).
    final identity =
        await ref.read(identityDetailProvider(verification.studentId!).future);
    if (!mounted) return;

    if (identity == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.studentNotFound),
          backgroundColor: context.dsColors.error,
        ),
      );
      _handled = false;
      return;
    }

    // P1: QR oqimi ham AKTIV DARS kontekstiga bog'langan. Faol dars
    // bo'lmasa davomat belgilanmaydi — eski (lessonId'siz) fallback yo'q.
    final lesson = ref.read(activeLessonProvider).valueOrNull;
    if (lesson == null) {
      if (!mounted) return;
      _handled = false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            "Hozir faol dars yo'q — davomat belgilanmadi",
          ),
          backgroundColor: context.dsColors.warning,
        ),
      );
      return;
    }

    // RBAC (AUDIT P2-02): ruxsat yetarli bo'lmasa — xato emas, aniq xabar.
    final RecordAttendanceResult result;
    try {
      result = await ref.read(recordAttendanceCommandProvider).execute(
            RecordAttendanceRequest(
              identityId: identity.identityId,
              fullName: identity.fullName,
              role: identity.role.name,
              method: 'qr',
              // P1: yozuv aynan shu darsga tegishli — lessonId majburiy.
              lessonId: lesson.lessonId,
              source: 'qr-scanner',
            ),
          );
    } on Failure catch (failure) {
      if (!mounted) return;
      _handled = false;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
      return;
    }
    if (!mounted) return;

    // C-03: Davomat ro'yxati `AttendanceMarkedEvent` orqali avtomatik
    // yangilanadi — qo'lda state++ shart emas (§79).

    // Audit-log (Activity Timeline).
    if (result.recorded) {
      await ref
          .read(attendanceActivityRecorderProvider)
          .record(identityId: identity.identityId, method: 'qr');
    }
    if (!mounted) return;

    final message = switch (result.action) {
      AttendanceAction.checkIn =>
        '${identity.fullName} — kirish belgilandi (QR)',
      AttendanceAction.checkOut =>
        '${identity.fullName} — chiqish belgilandi (QR)',
      AttendanceAction.duplicate =>
        '${identity.fullName} — bugun allaqachon belgilangan',
    };
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: result.recorded
            ? context.dsColors.success
            : context.dsColors.textSecondary,
      ),
    );

    // BUG-002 (LIVE QA P1): `context.go` butun stekni almashtirardi —
    // skaner sahifasi push qilingan bo'lsa ham (/identity/:identityId
    // top-level route), back tugmasi ilovani yopardi. `pushReplacement`
    // skanerni profil bilan almashtiradi — back oldingi sahifaga qaytadi.
    context.pushReplacement('/identity/$raw');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('QR skaner')),
      body: Stack(
        children: [
          MobileScanner(
            onDetect: _onDetect,
            errorBuilder: (context, error, child) => const _ScannerError(),
          ),
          // P1: faol dars konteksti — QR oqimi attendance bilan bir xil
          // activeLesson'dan ishlaydi (faol dars yo'q bo'lsa ko'rsatiladi).
          Positioned(
            left: 16,
            right: 16,
            top: 16,
            child: _buildActiveLessonBanner(),
          ),
          // Skanerlash maydoni ramkasi
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: Colors.white, width: 3),
                color: Colors.white.withValues(alpha: 0.08),
              ),
              child: const Icon(
                Icons.qr_code_2,
                size: 80,
                color: Colors.white54,
              ),
            ),
          ),
          Positioned(
            left: 32,
            right: 32,
            bottom: 48,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: context.dsColors.textPrimary.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Text(
                'ID kartadagi QR-kodni ramkaga joylashtiring',
                style: TextStyle(color: Colors.white, fontSize: 14),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Signed QR tekshiruv natijasiga mos foydalanuvchi xabari (spec §6).
  static String _qrErrorMessage(SignedQrVerificationStatus status) {
    return switch (status) {
      SignedQrVerificationStatus.malformed =>
        'QR kod yaroqsiz — imzolangan QR ko\'rsating',
      SignedQrVerificationStatus.invalidSignature => 'QR kod yaroqsiz',
      SignedQrVerificationStatus.expired => 'QR kod muddati tugagan',
      SignedQrVerificationStatus.replay => 'QR kod allaqachon ishlatilgan',
      SignedQrVerificationStatus.valid => '',
    };
  }

  /// Faol dars konteksti banneri (P1): dars mavjud bo'lsa label, bo'lmasa
  /// "faol dars yo'q" ogohlantirishi ko'rsatiladi.
  Widget _buildActiveLessonBanner() {
    final lessonAsync = ref.watch(activeLessonProvider);
    final lesson = lessonAsync.valueOrNull;

    if (lesson == null) {
      final loading = lessonAsync.isLoading;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: (loading ? context.dsColors.info : context.dsColors.warning)
              .withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Icon(
              loading ? Icons.hourglass_top : Icons.event_busy,
              size: 18,
              color: Colors.white,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                loading
                    ? 'Faol dars aniqlanmoqda…'
                    : "Hozir faol dars yo'q — davomat belgilanmaydi",
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: context.dsColors.success.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(Icons.school_outlined, size: 18, color: Colors.white),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              lesson.label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const Text(
            'Faol',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScannerError extends StatelessWidget {
  const _ScannerError();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.dsColors.scaffold,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.no_photography_outlined,
                size: 64, color: context.dsColors.textSecondary),
            SizedBox(height: 12),
            Text(
              'Kamera ochilmadi. Ruxsatlarni tekshiring.',
              style: TextStyle(
                  fontSize: 14, color: context.dsColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
