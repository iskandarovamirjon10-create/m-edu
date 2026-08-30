import 'package:flutter/material.dart';

import '../../infrastructure/services/face_vision_engine.dart';

/// Kamera tasviri ustidagi overlay: yuz ramkasi, manba belgisi va pastki
/// holat chizig'i (face_scan_page'dan ajratilgan — spec §32/§53).
class FaceScanOverlay extends StatelessWidget {
  /// So'nggi yuz kuzatuvi (ramka chizish uchun; null — yuz yo'q).
  final FaceObservation? observation;

  /// Ramka rangi (holatga qarab: kuzatish=cyan, tasdiq=success, noaniq=warning).
  final Color boxColor;

  /// Ramka yonidagi qisqa label ('TANILDI' | 'Noaniq' | 'Shaxs aniqlanmadi').
  final String boxLabel;

  /// Kamera manba belgisi (masalan '192.168.1.64:554').
  final String? sourceLabel;

  /// Snapshot (ISAPI) rejimida ishlayaptimi — RTSP emas.
  final bool snapshotFallback;

  /// Skan ishlamoqda (progress indikatori ko'rsatiladi).
  final bool running;

  /// Yuz dvigateli yo'q platformada ramka chizilmaydi.
  final bool engineSupported;

  /// Whether the camera frame is horizontally mirrored (front camera).
  final bool mirrored;

  const FaceScanOverlay({
    super.key,
    this.observation,
    this.boxColor = Colors.cyanAccent,
    this.boxLabel = 'Shaxs aniqlanmadi',
    this.sourceLabel,
    this.snapshotFallback = false,
    this.running = false,
    this.engineSupported = true,
    this.mirrored = false,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: observation != null
          ? 'Face detection: $boxLabel'
          : 'Camera feed - searching for faces',
      child: Stack(
        children: [
        if (observation != null && engineSupported)
          LayoutBuilder(
            builder: (context, constraints) {
              final box = observation!.normalizedBox;
              // BoxFit.cover crops the video to fill the widget. We must
              // compute the actual visible area to correctly position the
              // face bounding box overlay.
              //
              // Camera frame aspect ratio from actual frame dimensions.
              // Falls back to 16:9 for RTSP cameras when dimensions unknown.
              final widgetW = constraints.maxWidth;
              final widgetH = constraints.maxHeight;
              final frameW = observation!.sourceWidth;
              final frameH = observation!.sourceHeight;
              final frameAspect = (frameW > 0 && frameH > 0)
                  ? frameW.toDouble() / frameH.toDouble()
                  : 16.0 / 9.0; // Fallback for RTSP with unknown dims
              final widgetAspect = widgetW / widgetH;

              double scale;
              double offsetX = 0;
              double offsetY = 0;
              if (frameAspect > widgetAspect) {
                // Frame wider → scale by height, crop horizontally
                scale = widgetH / 1.0; // normalized to 1.0 height
                offsetX = (widgetW - scale * frameAspect) / 2;
              } else {
                // Frame taller → scale by width, crop vertically
                scale = widgetW / frameAspect;
                offsetY = (widgetH - scale) / 2;
              }

              // Map normalized box (0..1 in frame space) to widget space.
              // When mirrored (front camera), flip X coordinates.
              var left = offsetX + box.left * scale * frameAspect;
              final top = offsetY + box.top * scale;
              final width = box.width * scale * frameAspect;
              final height = box.height * scale;
              if (mirrored) {
                left = widgetW - left - width;
              }
              return Positioned(
                left: left,
                top: top,
                width: width,
                height: height,
                child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: boxColor, width: 2.5),
                    borderRadius: BorderRadius.circular(12),
                    color: boxColor.withValues(alpha: 0.08),
                  ),
                  child: Align(
                    alignment: Alignment.topRight,
                    child: Container(
                      margin: const EdgeInsets.all(6),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: boxColor.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        boxLabel,
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        if (sourceLabel != null)
          Positioned(
            top: 10,
            left: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.videocam, size: 13, color: Colors.white70),
                  const SizedBox(width: 4),
                  Text(
                    sourceLabel!,
                    style: const TextStyle(fontSize: 11, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ),
        Positioned(
          left: 10,
          right: 10,
          bottom: 10,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (running)
                  const SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white70,
                    ),
                  ),
                if (running) const SizedBox(width: 8),
                Text(
                  snapshotFallback ? 'Snapshot rejimi (ISAPI)' : 'Jonli oqim (RTSP)',
                  style: const TextStyle(fontSize: 12, color: Colors.white70),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
    );
  }
}
