/// TFLite FaceMesh yuz dvigateli — platforma tanlash shimi.
///
/// AUDIT (web build): `tflite_flutter` `dart:ffi`'ga tayanadi, `dart:ffi`
/// esa web'da mavjud emas — to'g'ridan-to'g'ri import web compile'ni
/// buzardi (`Dart library 'dart:ffi' is not available on this platform`).
///
/// Yechim: shartli eksport. Native platformalarda (Android/Windows/Linux/
/// iOS/macOS) real `TFLiteFaceVisionEngine` (io) yuklanadi; web'da esa
/// hech qanday natif kutubxonani import qilmaydigan stub. Natijada:
///
/// - Web build buzilmaydi (stub tanlanadi, `tflite_flutter` web'da
///   umuman kompilyatsiya qilinmaydi);
/// - Android/Windows/Linux implementatsiyasi o'zgarmaydi (io tanlanadi);
/// - Web'da feature graceful disable bo'ladi (`isSupportedOnPlatform`
///   false → UI tushunarli holat ko'rsatadi).
library;

export 'tflite_face_vision_engine_stub.dart'
    if (dart.library.io) 'tflite_face_vision_engine_io.dart';
