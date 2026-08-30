// Android launcher icons generator.
//
// assets/icons/m_edu_icon.jpg (1024x1024) dan barcha mipmap density'lar
// uchun legacy ic_launcher.png + adaptive (ic_launcher_background/foreground)
// ikonkalarni yaratadi. `image` paketi (mavjud dependency) ishlatiladi —
// tashqi vositalar (ImageMagick va h.k.) talab qilinmaydi.
//
// Ijro etish:
//   dart run tool/generate_launcher_icons.dart

// ignore_for_file: avoid_print
// (CLI utilita — stdout'ga progress chiqaradi)
//
// Keyin: flutter build apk (yoki flutter run) — manifest'dagi
// @mipmap/ic_launcher yangi ikonkalarni oladi.

import 'dart:io';

import 'package:image/image.dart' as img;

/// Legacy launcher icon hajmlari (mipmap density -> px).
/// Manba: https://developer.android.com/develop/ui/views/launch/launcher-design
const Map<String, int> legacySizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

/// Adaptive icon canvas 108dp -> density bo'yicha px.
const Map<String, int> adaptiveSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

/// Adaptive icon safe zone: content 66dp/108dp ichida bo'lishi kerak.
const double safeZoneRatio = 66 / 108;

void main() {
  final srcBytes = File('assets/icons/m_edu_icon.jpg').readAsBytesSync();
  final src = img.decodeJpg(srcBytes);
  if (src == null) {
    stderr.writeln('Xato: assets/icons/m_edu_icon.jpg dekodlab bo\'lmadi');
    exit(1);
  }
  print('Manba: assets/icons/m_edu_icon.jpg (${src.width}x${src.height})');

  // 1) Legacy ic_launcher.png (barcha density'lar)
  for (final entry in legacySizes.entries) {
    _writePng(
      'android/app/src/main/res/${entry.key}/ic_launcher.png',
      img.copyResize(
        src,
        width: entry.value,
        height: entry.value,
        interpolation: img.Interpolation.average,
      ),
    );
    print('  yozildi: ${entry.key}/ic_launcher.png (${entry.value}px)');
  }

  // 2) Adaptive icon: fon = rasm burchaklari rangidan olingan to'liq rang
  final bgColor = _cornerColor(src);
  final fgCanvasSize = adaptiveSizes['mipmap-xxxhdpi']!;
  final fgContentSize = (fgCanvasSize * safeZoneRatio).round();
  final fgContent = img.copyResize(
    src,
    width: fgContentSize,
    height: fgContentSize,
    interpolation: img.Interpolation.average,
  );

  for (final entry in adaptiveSizes.entries) {
    final canvas = entry.value;

    // Background: solid rang
    final bg = img.Image(width: canvas, height: canvas, numChannels: 4);
    img.fill(bg, color: bgColor);
    _writePng(
      'android/app/src/main/res/${entry.key}/ic_launcher_background.png',
      bg,
    );

    // Foreground: content safe zone ichida markazlashgan
    final fg = img.Image(width: canvas, height: canvas, numChannels: 4);
    final content = img.copyResize(
      fgContent,
      width: (canvas * safeZoneRatio).round(),
      height: (canvas * safeZoneRatio).round(),
      interpolation: img.Interpolation.average,
    );
    img.compositeImage(fg, content, center: true);
    _writePng(
      'android/app/src/main/res/${entry.key}/ic_launcher_foreground.png',
      fg,
    );
    print('  yozildi: ${entry.key}/ic_launcher_*adaptive* (${canvas}px)');
  }

  // 3) Adaptive icon manifest (API 26+)
  final xml = 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml';
  File(xml)
    ..createSync(recursive: true)
    ..writeAsStringSync('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
''');
  print('  yozildi: $xml');

  print('Tayyor ✓');
}

void _writePng(String path, img.Image image) {
  File(path)
    ..createSync(recursive: true)
    ..writeAsBytesSync(img.encodePng(image));
}

/// Rasmning 4 burchagi ranglarining o'rtachasi — adaptive fon rangi sifatida.
img.Color _cornerColor(img.Image src) {
  final corners = [
    src.getPixel(0, 0),
    src.getPixel(src.width - 1, 0),
    src.getPixel(0, src.height - 1),
    src.getPixel(src.width - 1, src.height - 1),
  ];
  var r = 0.0, g = 0.0, b = 0.0;
  for (final p in corners) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  final n = corners.length;
  return img.ColorRgb8(
    (r / n * 255).round().clamp(0, 255),
    (g / n * 255).round().clamp(0, 255),
    (b / n * 255).round().clamp(0, 255),
  );
}
