import 'dart:math';

import 'package:equatable/equatable.dart';

import '../../domain/entities/identity.dart';
import '../../domain/repositories/identity_repository.dart';

/// Duplicate topilgan sabablar (dedup tizimi, spec §3).
abstract final class DuplicateMatchReasons {
  static const String phone = 'phone';
  static const String email = 'email';
  static const String name = 'name';
}

/// Identity uchun topilgan potensial dublikat.
class IdentityDuplicateCandidate extends Equatable {
  final Identity identity;

  /// `DuplicateMatchReasons` dagi sabab.
  final String matchedBy;

  /// Moslik darajasi 0..1 (1 = aniq mos).
  final double confidence;

  const IdentityDuplicateCandidate({
    required this.identity,
    required this.matchedBy,
    required this.confidence,
  });

  @override
  List<Object?> get props => [identity, matchedBy, confidence];
}

/// Dublikat identity'larni topish (Identity merge/dedup, spec §6 #5).
///
/// Qidiruv mezonlari: bir xil telefon, bir xil email yoki
/// ism-familiya o'xshashligi (fuzzy-match).
class IdentityDuplicatesQuery {
  final IdentityRepository _repository;

  IdentityDuplicatesQuery({required IdentityRepository repository})
      : _repository = repository;

  /// Berilgan identity uchun potensial dublikatlarni ishonchlilik
  /// tartibida (aniq mos birinchi) qaytaradi.
  Future<List<IdentityDuplicateCandidate>> findDuplicatesFor(
    String identityId,
  ) async {
    final identity = await _repository.fetchByIdentityId(identityId);
    if (identity == null) return const [];

    final all = await _repository.fetchAll();
    final candidates = <IdentityDuplicateCandidate>[];

    for (final other in all) {
      if (other.identityId == identityId) continue;
      // Arxivlangan identity endi faol emas — dublikat sifatida
      // ko'rsatilmaydi (allaqachon hal qilingan).
      if (other.status == IdentityStatus.archived) continue;

      final match = _match(identity, other);
      if (match != null) candidates.add(match);
    }

    candidates.sort((a, b) => b.confidence.compareTo(a.confidence));
    return candidates;
  }

  IdentityDuplicateCandidate? _match(Identity a, Identity b) {
    final phoneA = a.phone == null ? null : _digitsOnly(a.phone!);
    final phoneB = b.phone == null ? null : _digitsOnly(b.phone!);
    if (phoneA != null && phoneB != null && phoneA == phoneB) {
      return IdentityDuplicateCandidate(
        identity: b,
        matchedBy: DuplicateMatchReasons.phone,
        confidence: 1.0,
      );
    }

    if (a.email != null &&
        b.email != null &&
        a.email!.toLowerCase() == b.email!.toLowerCase()) {
      return IdentityDuplicateCandidate(
        identity: b,
        matchedBy: DuplicateMatchReasons.email,
        confidence: 1.0,
      );
    }

    final similarity = _nameSimilarity(a.fullName, b.fullName);
    if (similarity >= _nameMatchThreshold) {
      return IdentityDuplicateCandidate(
        identity: b,
        matchedBy: DuplicateMatchReasons.name,
        confidence: similarity,
      );
    }

    return null;
  }

  static const double _nameMatchThreshold = 0.85;

  /// Raqamlardan boshqa barcha belgilarni olib tashlaydi
  /// (`+998901234567` → `998901234567`).
  String _digitsOnly(String value) => value.replaceAll(RegExp(r'[^0-9]'), '');

  /// Ism-familiya o'xshashligi (0..1): Levenshtein asosidagi
  /// normalizatsiyalangan moslik (fuzzy-match).
  double _nameSimilarity(String a, String b) {
    final na = _normalizeName(a);
    final nb = _normalizeName(b);
    if (na.isEmpty || nb.isEmpty) return 0;
    if (na == nb) return 1;
    final distance = _levenshtein(na, nb);
    return 1 - (distance / max(na.length, nb.length));
  }

  /// Barcha tillardagi harflarni qoldiradi (lotin va kirill — ilova `ru`
  /// tilini qo'llab-quvvatlaydi), apostrof/belgi/raqamlarni olib tashlaydi:
  /// `Ali Valiyev` → `alivaliyev`, `Иван Иванов` → `иваниванов`.
  String _normalizeName(String value) {
    return value
        .toLowerCase()
        .replaceAll(RegExp(r'[^\p{L}]', unicode: true), '');
  }

  int _levenshtein(String a, String b) {
    if (a.isEmpty) return b.length;
    if (b.isEmpty) return a.length;

    var prev = List<int>.generate(b.length + 1, (i) => i);
    var curr = List<int>.filled(b.length + 1, 0);

    for (var i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (var j = 1; j <= b.length; j++) {
        final cost = a[i - 1] == b[j - 1] ? 0 : 1;
        curr[j] = min(
          min(curr[j - 1] + 1, prev[j] + 1),
          prev[j - 1] + cost,
        );
      }
      final tmp = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[b.length];
  }
}
