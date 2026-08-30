/// Face ID diagnostikasi natijasi (P0 debug, §3).
///
/// Pipeline qatlamlari bo'yicha PASS/FAIL/NOT_REACHED holatini saqlaydi.
/// **Faqat development/profile rejimida** — production UX'ga kirmaydi,
/// biometrik ma'lumot (embedding vektor, raw kadr) saqlamaydi, parol/
/// token yozmaydi (xavfsizlik: §20).
class FaceDebugSnapshot {
  /// Qatlam nomi (CAMERA, STREAM, ...).
  final String layer;

  /// PASS | FAIL | NOT_REACHED | NOT_VERIFIED
  final String status;

  /// Qisqa, xavfsiz izoh — hech qachon sensitiv ma'lumot emas.
  final String detail;

  const FaceDebugSnapshot({
    required this.layer,
    required this.status,
    required this.detail,
  });

  Map<String, String> toJson() => {
        'layer': layer,
        'status': status,
        'detail': detail,
      };
}
