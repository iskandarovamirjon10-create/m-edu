// VM service yordamchisi — ishlayotgan debug ilovaga ulanib, Flutter
// service extension'larini chaqiradi va natijasini stdout'ga yozadi.
//
// Foydalanish:
//   1. `adb logcat -d -s flutter | grep "VM service"` dan URL oling
//   2. `adb forward tcp:PORT tcp:PORT`
//   3. `dart tool/vm_dump.dart <ws-url> [ext_name]`
//
// Natija (widget/render daraxti) stdout'ga (json `result.data`) chiqadi.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

Future<void> main(List<String> args) async {
  if (args.isEmpty) {
    stdout.writeln('Ishlatish: dart tool/vm_dump.dart <ws-url> [ext-flutter.ext]');
    exitCode = 1;
    return;
  }
  final wsUrl = args[0];
  final extensionName =
      args.length > 1 ? args[1] : 'ext.flutter.debugDumpApp';

  final ws = await WebSocket.connect(wsUrl);
  var nextId = 0;
  final pending = <int, void Function(Map<String, dynamic>)>{};

  Future<Map<String, dynamic>> call(
    String method, [
    Map<String, dynamic>? params,
  ]) {
    final id = ++nextId;
    final completer = Completer<Map<String, dynamic>>();
    pending[id] = completer.complete;
    ws.add(jsonEncode({
      'jsonrpc': '2.0',
      'id': id,
      'method': method,
      if (params != null) 'params': params,
    }));
    return completer.future;
  }

  ws.listen((raw) {
    final msg = jsonDecode(raw as String) as Map<String, dynamic>;
    final id = msg['id'];
    if (id != null && pending.containsKey(id)) {
      pending.remove(id)!(msg);
    }
  });

  final vm = await call('getVM');
  final isolates = (vm['result']?['isolates'] as List? ?? const []);
  if (isolates.isEmpty) {
    stdout.writeln('Izolyatsiya topilmadi');
    await ws.close();
    return;
  }
  final isolateId = isolates.first['id'] as String;

  final response =
      await call(extensionName, {'isolateId': isolateId});

  final data = response['result']?['data'];
  if (data is String && data.isNotEmpty) {
    stdout.writeln(data);
  } else if (response['error'] != null) {
    stdout.writeln('XATO: ${jsonEncode(response['error'])}');
  } else {
    stdout.writeln('(natija bosh)');
  }

  await ws.close();
}
