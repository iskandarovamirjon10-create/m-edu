import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  await integrationDriver(
    onScreenshot: (String name, List<int> bytes, [Map<String, Object?>? args]) async {
      final file = File('screenshots_android_test/$name.png');
      file.createSync(recursive: true);
      file.writeAsBytesSync(bytes);
      return true;
    },
  );
}
