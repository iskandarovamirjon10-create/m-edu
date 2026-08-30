// Tool: screenshot → ASCII art visualizer (uses the project's `image` package).
// Usage: dart run tool/screen_ascii.dart <path.png> [cols] [rows]
import 'dart:io';

import 'package:image/image.dart' as img;

void main(List<String> args) {
  if (args.isEmpty) {
    stderr.writeln('Usage: dart run tool/screen_ascii.dart <png> [cols] [rows]');
    exit(1);
  }
  final file = File(args[0]);
  if (!file.existsSync()) {
    stderr.writeln('File not found: ${args[0]}');
    exit(1);
  }
  final cols = args.length > 1 ? int.parse(args[1]) : 44;
  final rows = args.length > 2 ? int.parse(args[2]) : 60;
  // Optional crop: --crop top,height (rows counted from top) e.g. --crop 1900,440
  int? cropTop;
  int? cropHeight;
  for (var i = 3; i < args.length; i++) {
    if (args[i] == '--crop' && i + 1 < args.length) {
      final parts = args[i + 1].split(',');
      cropTop = int.parse(parts[0]);
      cropHeight = int.parse(parts[1]);
    }
  }
  final bytes = file.readAsBytesSync();
  var image = img.decodeImage(bytes);
  if (image == null) {
    stderr.writeln('Could not decode image');
    exit(1);
  }
  if (cropTop != null && cropHeight != null) {
    image = img.copyCrop(
      image,
      x: 0,
      y: cropTop,
      width: image.width,
      height: cropHeight,
    );
  }

  // Character per color class (dark→light ramp).
  const ramp = ' .:-=+*#%@';

  final cellW = image.width / cols;
  final cellH = image.height / rows;
  final sb = StringBuffer();
  sb.writeln('${image.width}x${image.height} → $cols x $rows');
  sb.writeln('Legend: K=black G=gray W=white R=red Y=yellow G=green '
      'C=cyan B=blue M=magenta O=orange; luminance ramp 0-9');
  sb.write('    ');
  for (var c = 0; c < cols; c++) {
    sb.write((c % 10));
  }
  sb.writeln();
  for (var r = 0; r < rows; r++) {
    sb.write('${r.toString().padLeft(3)} ');
    for (var c = 0; c < cols; c++) {
      // Sample center of cell.
      final x = ((c + 0.5) * cellW).floor().clamp(0, image.width - 1);
      final y = ((r + 0.5) * cellH).floor().clamp(0, image.height - 1);
      final p = image.getPixel(x, y);
      final lum = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b);
      final ch = ramp[(lum / 255 * (ramp.length - 1)).round()];
      // Color class: decide dominant channel.
      String color;
      final maxC = [p.r, p.g, p.b].reduce((a, b) => a > b ? a : b);
      final minC = [p.r, p.g, p.b].reduce((a, b) => a < b ? a : b);
      final sat = maxC - minC;
      if (sat < 24) {
        color = lum > 200 ? 'W' : (lum > 90 ? 'G' : 'K');
      } else if (p.r > p.g && p.r > p.b) {
        color = p.g > 120 ? 'O' : 'R';
      } else if (p.g > p.r && p.g > p.b) {
        color = 'G';
      } else if (p.b > p.r && p.b > p.g) {
        color = 'B';
      } else if (p.r > p.b) {
        color = 'Y';
      } else {
        color = 'M';
      }
      sb.write(color == 'G' && ch == ' ' ? '.' : (color == 'G' ? ch : color));
    }
    sb.writeln();
  }
  stdout.write(sb.toString());
}
