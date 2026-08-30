import '../../domain/entities/automation_rule.dart';

/// Avtomatlashtirish dvigateli — TRIGGER → CONDITION → ACTION.
///
/// Qoidalar [AutomationRule] orqali ro'yxatdan o'tadi. Dvigatel:
/// 1. Trigger kelganda mos qoidalarni topadi.
/// 2. Har bir qoidaning condition'ini real ma'lumot bilan tekshiradi.
/// 3. Condition to'g'ri bo'lsa — action'ni qaytaradi.
///
/// Dvigatel hech narsani o'zi bajarmaydi — [AutomationAction] qaytaradi,
/// provider/integratsiya qatlami amalni bajaradi (predictable, controllable).
class AutomationEngine {
  final List<AutomationRule> _rules = [];

  AutomationEngine();

  /// Qoida ro'yxatdan o'tkazish (xuddi shu ID — almashtiriladi).
  void register(AutomationRule rule) {
    _rules.removeWhere((r) => r.id == rule.id);
    _rules.add(rule);
  }

  /// Bir nechta qoidani ro'yxatdan o'tkazish.
  void registerAll(Iterable<AutomationRule> rules) {
    for (final rule in rules) {
      register(rule);
    }
  }

  /// Barcha qoidalar.
  List<AutomationRule> get rules => List.unmodifiable(_rules);

  /// Berilgan trigger uchun mos va condition'i to'g'ri bo'lgan qoidalar.
  ///
  /// [evaluateCondition] — qoida condition'ini real ma'lumot bilan tekshiradi
  /// (qoidaning o'zi condition saqlamaydi; condition mantiqi integratsiya
  /// qatlamida, chunki u real repository'larni talab qiladi — dvigatel sof
  /// va testlanadigan bo'lib qoladi).
  List<AutomationRule> evaluate(
    AutomationTrigger trigger, {
    required bool Function(AutomationRule rule) evaluateCondition,
  }) {
    final matched = <AutomationRule>[];
    for (final rule in _rules) {
      if (!rule.enabled) continue;
      if (rule.trigger != trigger) continue;
      try {
        if (evaluateCondition(rule)) matched.add(rule);
      } catch (_) {
        // Condition xatosi qoidani o'ldirmaydi — faqat o'tkazib yuboriladi
        // (deterministik va xavfsiz: hech qachon yolg'on natija emas).
        continue;
      }
    }
    return matched;
  }

  /// Qoidani o'chirish.
  void unregister(String id) {
    _rules.removeWhere((r) => r.id == id);
  }
}
