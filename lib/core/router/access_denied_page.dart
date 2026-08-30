import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/app_theme.dart';

/// Ruxsat yetarli bo'lmagan sahifaga urinilganda ko'rsatiladi (PHASE D).
///
/// Autentifikatsiya o'tgan, lekin rol/permission yetarli emas:
/// foydalanuvchi "Access Denied" ko'radi — security tafsilotlari
/// (qaysi permission kerak) ko'rsatilmaydi (PHASE I: ortiqcha expose yo'q).
class AccessDeniedPage extends StatelessWidget {
  const AccessDeniedPage({super.key});

  @override
  Widget build(BuildContext context) {
    // PHASE D (brief §24): "Access denied [Go Back]" — oldingi sahifa
    // mavjud bo'lsa orqaga qaytish, aks holda bosh sahifaga.
    void goBack() {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/dashboard');
      }
    }

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: AppTheme.error.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.gpp_bad_outlined,
                  size: 44,
                  color: AppTheme.error,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Ruxsat yo\'q',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Bu sahifani ochish uchun sizda yetarli ruxsat yo\'q. '
                'Administrator bilan bog\'laning.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 28),
              FilledButton.icon(
                onPressed: goBack,
                icon: const Icon(Icons.arrow_back_rounded),
                label: const Text('Orqaga'),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => context.go('/dashboard'),
                child: const Text('Bosh sahifaga'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
