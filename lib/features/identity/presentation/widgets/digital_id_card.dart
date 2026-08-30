import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../../design/design.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../domain/entities/identity.dart';
import 'identity_avatar.dart';
import 'status_badge.dart';

/// Apple Wallet uslubidagi Premium Digital ID Card (spec §3).
///
/// "Crystal Air" dizayn tili: shaffof glass qatlam (blur'siz — tez).
///
/// P1.5: QR endi oddiy student ID EMAS — [signedQrPayloadProvider] orqali
/// Ed25519 bilan imzolangan signed QR ko'rsatiladi (nonce + expiry +
/// signature). Yaroqsiz/fake QR hech qachon ko'rsatilmaydi — yuklanish
/// xatosi bo'lsa aniq xato holati chiqadi.
class DigitalIdCard extends ConsumerWidget {
  final Identity identity;
  final VoidCallback? onShare;

  const DigitalIdCard({super.key, required this.identity, this.onShare});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gradient = _gradientFor(context, identity.role);
    final accentColor = _accentFor(context, identity.role);

    return Container(
      height: 220,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: gradient,
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: 0.4),
            blurRadius: 30,
            offset: const Offset(0, 14),
            spreadRadius: -4,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          children: [
            // Orqa fondagi dekorativ yorug'lik dog'lari (glass effekt manbai)
            Positioned(
              top: -60,
              right: -40,
              child: _glowOrb(140, Colors.white.withValues(alpha: 0.35)),
            ),
            Positioned(
              bottom: -50,
              left: -30,
              child: _glowOrb(120, Colors.black.withValues(alpha: 0.15)),
            ),
            // Glass qatlam (shaffof — blur'siz)
            Container(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.14),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.45),
                  width: 1,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(context),
                    const Spacer(),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(child: _buildIdentityNumber(context)),
                        const SizedBox(width: 12),
                        _buildQrCode(context, ref),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Row(
      children: [
        IdentityAvatar(identity: identity, radius: 26),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                identity.fullName,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.3,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 3),
              Text(
                _roleLabel(identity.role),
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.white.withValues(alpha: 0.85),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        StatusBadge(status: identity.status, compact: true),
      ],
    );
  }

  Widget _buildIdentityNumber(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'REAL ID',
          style: TextStyle(
            fontSize: 10,
            letterSpacing: 1.8,
            color: Colors.white.withValues(alpha: 0.7),
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          identity.identityId,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            letterSpacing: 0.3,
          ),
          // ULID format (A2/E2) uzunroq — karta ichida qirqilmasin.
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Text(
          'M-EDU • ${identity.createdAt.year}',
          style: TextStyle(
            fontSize: 11,
            color: Colors.white.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }

  Widget _buildQrCode(BuildContext context, WidgetRef ref) {
    // P1.5: signed QR — imzolangan payload (loading/error real state).
    final payloadAsync =
        ref.watch(signedQrPayloadProvider(identity.identityId));

    return Container(
      width: 88,
      height: 88,
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: payloadAsync.when(
        loading: () => const Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
        error: (_, __) => Center(
          child: Icon(
            Icons.qr_code_2,
            size: 40,
            color: context.dsColors.error.withValues(alpha: 0.7),
          ),
        ),
        data: (payload) => QrImageView(
          data: payload,
          version: QrVersions.auto,
          size: 74,
          eyeStyle: QrEyeStyle(
            eyeShape: QrEyeShape.square,
            color: context.dsColors.textPrimary,
          ),
          dataModuleStyle: QrDataModuleStyle(
            dataModuleShape: QrDataModuleShape.square,
            color: context.dsColors.textPrimary,
          ),
        ),
      ),
    );
  }

  Widget _glowOrb(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
      ),
    );
  }

  LinearGradient _gradientFor(BuildContext context, IdentityRole role) {
    // Hardcoded rang yo'q — AppTheme gradient tokenlari (v3.1).
    return switch (role) {
      IdentityRole.student => context.dsColors.accentGradient,
      IdentityRole.teacher => context.dsColors.accentGradient,
      IdentityRole.staff => context.dsColors.accentGradient,
      IdentityRole.parent => context.dsColors.accentGradient,
    };
  }

  Color _accentFor(BuildContext context, IdentityRole role) {
    return switch (role) {
      IdentityRole.student => context.dsColors.accent,
      IdentityRole.teacher => context.dsColors.info,
      IdentityRole.staff => context.dsColors.warning,
      IdentityRole.parent => context.dsColors.success,
    };
  }

  static String _roleLabel(IdentityRole role) {
    return switch (role) {
      IdentityRole.student => "O'QUVCHI",
      IdentityRole.teacher => "O'QITUVCHI",
      IdentityRole.staff => 'XODIM',
      IdentityRole.parent => 'OTA-ONA',
    };
  }
}
