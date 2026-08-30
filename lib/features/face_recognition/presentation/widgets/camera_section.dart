import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_card.dart';
import '../../application/face_scan_controller.dart';
import '../../application/face_scan_state.dart';
import '../../infrastructure/services/face_vision_engine.dart';
import '../../infrastructure/services/hikvision_camera_config.dart';
import '../providers/face_recognition_providers.dart';
import 'face_camera_view.dart';
import 'face_scan_overlay.dart';

/// Kamera ko'rinishi: sozlanmagan holat kartasi yoki jonli oqim + overlay.
///
/// Ramka rangi/labeli [FaceScanController] holatidan hisoblanadi — sahifa
/// uni qayta hisoblamaydi (har bir qism o'z manbasini kuzatadi).
class CameraSection extends ConsumerWidget {
  final HikvisionCameraConfig? config;

  /// So'nggi yuz kuzatuvi (overlay ramkasi).
  final FaceObservation? observation;

  final bool engineSupported;
  final bool snapshotFallback;
  final bool running;

  /// Whether the camera frame is mirrored (front camera).
  final bool mirrored;

  const CameraSection({
    super.key,
    this.config,
    this.observation,
    this.engineSupported = true,
    this.snapshotFallback = false,
    this.running = false,
    this.mirrored = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = this.config;
    if (config == null) {
      return AppCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.videocam_off_outlined,
                  size: 56, color: context.dsColors.textSecondary),
              const SizedBox(height: 16),
              Text(
                'Kamera sozlanmagan',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Face ID uchun Hikvision kamerani ulashing: IP manzil, '
                'login va parolni kiriting.',
                style:
                    TextStyle(fontSize: 13, color: context.dsColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: () => context.go('/settings'),
                icon: const Icon(Icons.tune),
                label: const Text('Kamerani sozlash'),
              ),
            ],
          ),
        ),
      );
    }

    // `watch` — autoDispose provider sahifa ochiq ekan saqlanadi va
    // sahifa yopilganda player to'liq yopiladi.
    final service = ref.watch(cameraStreamServiceProvider);
    final controller = ref.watch(faceScanControllerProvider);
    final boxColor = _boxColor(context, controller);
    final boxLabel = _boxLabel(controller);
    return AspectRatio(
      aspectRatio: 4 / 3,
      child: FaceCameraView(
        service: service,
        overlay: FaceScanOverlay(
          observation: observation,
          engineSupported: engineSupported,
          mirrored: mirrored,
          boxColor: boxColor,
          boxLabel: boxLabel,
          sourceLabel: '${config.ip}:${config.port}',
          snapshotFallback: snapshotFallback,
          running: running,
        ),
      ),
    );
  }

  Color _boxColor(BuildContext context, FaceScanController controller) {
    return switch (controller.state) {
      FaceScanIdentified() => context.dsColors.success,
      FaceScanAmbiguous() => context.dsColors.warning,
      _ => Colors.cyanAccent,
    };
  }

  String _boxLabel(FaceScanController controller) {
    return switch (controller.state) {
      FaceScanIdentified() => 'TANILDI',
      FaceScanAmbiguous() => 'Noaniq',
      FaceScanConfirming() => 'Tasdiqlanmoqda',
      _ => 'Shaxs aniqlanmadi',
    };
  }
}
