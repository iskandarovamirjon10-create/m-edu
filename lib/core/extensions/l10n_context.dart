import 'package:flutter/widgets.dart';

import '../../l10n/app_localizations.dart';
import '../../l10n/app_localizations_uz.dart';

/// `context.l10n` — lokalizatsiyalangan matnlarga qulay kirish.
///
/// `AppLocalizations.of(context)` ni qisqartirib beradi. MaterialApp/
/// delegate bo'lmagan muhitda (widget testlar sahifani to'g'ridan-to'g'ri
/// quradi) xavfsiz fallback — o'zbekcha (default) instansiya qaytariladi,
/// ilova real ishlaganda esa doim to'g'ri til ko'rsatiladi.
extension AppLocalizationsContextX on BuildContext {
  AppLocalizations get l10n {
    try {
      return AppLocalizations.of(this);
    } catch (_) {
      // Delegate bo'lmagan muhit: default til (uz) instansiyasi.
      return AppLocalizationsUz();
    }
  }
}
