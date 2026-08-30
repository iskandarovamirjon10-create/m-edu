import 'package:flutter/material.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../../../design/design.dart';
import '../../infrastructure/services/camera_stream_service.dart';

/// Kamera jonli oqimini ko'rsatadigan umumiy widget (media_kit Video).
class FaceCameraView extends StatelessWidget {
  final CameraStreamService service;
  final Widget? overlay;

  const FaceCameraView({
    super.key,
    required this.service,
    this.overlay,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF101214),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: context.dsColors.border, width: 1),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Video(
              controller: service.videoController,
              controls: NoVideoControls,
              fit: BoxFit.cover,
            ),
            overlay ?? const SizedBox.shrink(),
          ],
        ),
      ),
    );
  }
}
