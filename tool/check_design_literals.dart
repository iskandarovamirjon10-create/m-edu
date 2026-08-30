// ═══════════════════════════════════════════════════════════════════════
// M-EDU DESIGN LITERAL GATE (Design Constitution v4.0 §AG / C-47)
//
// Feature va shared/design_system kodida raw design literal'larini
// (Color(0x...), BorderRadius.circular(...), EdgeInsets.*(...),
// Duration(milliseconds:...), Colors.*) hisoblaydi va baseline'dan oshishni
// bloklaydi (regression gate). Baseline `tool/design_literal_baseline.json`
// — yangi literal qo'shilsa CI yiqiladi; tozalash bo'lsa baseline
// `--update-baseline` bilan yangilanadi.
//
// Qoidalar (v4.0 §AG INVARIANT): raw literallar faqat approved token/theme
// qatlamida yashaydi. Ijaradan chiqarilgan (J) joylar — identity/face
// kamera UI — identity validation tugaguncha istisno ro'yxatida.
//
// Ishga tushirish:
//   dart run tool/check_design_literals.dart            # regression check
//   dart run tool/check_design_literals.dart --report   # faqat hisobot
//   dart run tool/check_design_literals.dart --update-baseline
// ═══════════════════════════════════════════════════════════════════════
import 'dart:convert';
import 'dart:io';

const _roots = ['lib/features', 'lib/shared/design_system'];

/// J-frozen — identity validation tugamaguncha tegilmaydi
/// (docs/DESIGN_SYSTEM_RECONCILIATION_REPORT.md §J).
const _excludedPrefixes = [
  'features/face_recognition',
  'features/identity/presentation/pages/identity_scan_page.dart',
  'features/identity/presentation/pages/register_identity_page.dart',
];

const _baselineFile = 'tool/design_literal_baseline.json';

final _patterns = <String, RegExp>{
  'Color(0x hex': RegExp(r'Color\(0x[0-9A-Fa-f]{6,8}'),
  'BorderRadius.circular(': RegExp(r'BorderRadius\.circular\('),
  'raw EdgeInsets(': RegExp(r'EdgeInsets\.(all|symmetric|fromLTRB|only)\('),
  'Duration(milliseconds:': RegExp(r'Duration\(milliseconds:'),
  'named Colors.*': RegExp(
    r'Colors\.(white|black|blueGrey|grey|red|green|blue|amber|orange|'
    r'purple|indigo|pink|teal|cyan|brown|lime|yellow|transparent)(\d+)?',
  ),
};

/// Izohlarni olib tashlaydi — doc/komment misollari hisobga kirmaydi.
String stripComments(String src) {
  final noBlock =
      src.replaceAllMapped(RegExp(r'/\*.*?\*/', dotAll: true), (_) => '');
  return noBlock.replaceAllMapped(RegExp(r'//[^\n]*'), (_) => '');
}

int countMatches(String content, RegExp re) => re.allMatches(content).length;

Map<String, int> scan() {
  final counts = <String, int>{for (final k in _patterns.keys) k: 0};
  for (final root in _roots) {
    final dir = Directory(root);
    if (!dir.existsSync()) continue;
    for (final entity in dir.listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final rel = entity.path.replaceAll('\\', '/');
      if (_excludedPrefixes.any(rel.contains)) continue;
      final content = stripComments(entity.readAsStringSync());
      for (final entry in _patterns.entries) {
        counts[entry.key] =
            counts[entry.key]! + countMatches(content, entry.value);
      }
    }
  }
  return counts;
}

Map<String, int> readBaseline() {
  final file = File(_baselineFile);
  if (!file.existsSync()) return const {};
  final json = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  return json.map((k, v) => MapEntry(k, v as int));
}

void writeBaseline(Map<String, int> counts) {
  final json = '${JsonEncoder.withIndent('  ').convert(counts)}\n';
  File(_baselineFile).writeAsStringSync(json);
}

void main(List<String> args) {
  final updateBaseline = args.contains('--update-baseline');
  final reportOnly = args.contains('--report');

  final counts = scan();

  stdout.writeln('Design literal scan:');
  for (final entry in counts.entries) {
    stdout.writeln('  ${entry.key.padRight(26)} ${entry.value}');
  }

  if (updateBaseline) {
    writeBaseline(counts);
    stdout.writeln('Baseline yangilandi: $_baselineFile');
    exit(0);
  }

  if (reportOnly) {
    exit(0);
  }

  final baseline = readBaseline();
  if (baseline.isEmpty) {
    stdout.writeln('Baseline topilmadi — avval --update-baseline ishga '
        'tushiring.');
    exit(1);
  }

  var failed = false;
  for (final entry in counts.entries) {
    final allowed = baseline[entry.key] ?? 0;
    if (entry.value > allowed) {
      failed = true;
      stdout.writeln('  FAIL ${entry.key}: ${entry.value} > baseline '
          '$allowed (yangi raw literal qo\'shilgan)');
    }
  }

  if (failed) {
    stdout.writeln('\nBLOCKED: raw design literallar baseline\'dan oshdi. '
        'Tozalash yoki tasdiqlangan exception kerak (§AG/§AI-25).');
    exit(1);
  }
  stdout.writeln('\nPASS: literal counts baseline chegarasida.');
}
