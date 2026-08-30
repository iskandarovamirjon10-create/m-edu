import 'dart:async';

import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';

/// Bluetooth thermal printer xizmati.
///
/// ESC/POS qisqa yo'l (chechka) bosib chiqarish uchun ishlatiladi:
/// - To'lov kvitansiyasi
/// - Davomat hisoboti
/// - Umumiy matn
///
/// Xususiyatlar:
/// - Bluetooth qurilmalarini qidirish va tanlash
/// - Ulanish/uzilish
/// - ESC/POS formatlangan matn yuborish
/// - Holat kuzatish (Stream)
class ThermalPrinterService {
  // ─── Holat ────────────────────────────────────────────────────────
  bool _isConnected = false;
  String? _connectedDeviceName;
  String? _connectedDeviceAddress; // ignore: unused_field

  bool get isConnected => _isConnected;
  String? get connectedDeviceName => _connectedDeviceName;

  // ─── Ulanish o'zgarishini kuzatish ────────────────────────────────
  final _connectionController = StreamController<PrinterConnectionState>.broadcast();
  Stream<PrinterConnectionState> get connectionStream => _connectionController.stream;

  // ─── Bluetooth ruxsati ───────────────────────────────────────────
  Future<bool> get isPermissionGranted async {
    try {
      return await PrintBluetoothThermal.isPermissionBluetoothGranted;
    } catch (_) {
      return false;
    }
  }

  // ─── Bluetooth holati ─────────────────────────────────────────────
  Future<bool> get isBluetoothEnabled async {
    try {
      return await PrintBluetoothThermal.bluetoothEnabled;
    } catch (_) {
      return false;
    }
  }

  // ─── Ulanganlik holati ───────────────────────────────────────────
  Future<bool> checkConnectionStatus() async {
    try {
      _isConnected = await PrintBluetoothThermal.connectionStatus;
      if (!_isConnected) {
        _connectedDeviceName = null;
        _connectedDeviceAddress = null;
      }
      return _isConnected;
    } catch (_) {
      return false;
    }
  }

  // ─── Qidirilayotgan qurilmalar ───────────────────────────────────
  Future<List<BluetoothInfo>> getPairedDevices() async {
    try {
      return await PrintBluetoothThermal.pairedBluetooths;
    } catch (_) {
      return const [];
    }
  }

  // ─── Ulash ────────────────────────────────────────────────────────
  Future<bool> connect(String macAddress) async {
    try {
      _safeAdd(PrinterConnectionState.connecting);

      final result = await PrintBluetoothThermal.connect(
        macPrinterAddress: macAddress,
      );

      _isConnected = result;
      if (result) {
        // Ulangan qurilma nomini saqlash
        final devices = await getPairedDevices();
        final device = devices.where((d) => d.macAdress == macAddress).firstOrNull;
        _connectedDeviceName = device?.name ?? 'Printer';
        _connectedDeviceAddress = macAddress;
        _safeAdd(PrinterConnectionState.connected);
      } else {
        _connectedDeviceName = null;
        _connectedDeviceAddress = null;
        _safeAdd(PrinterConnectionState.disconnected);
      }
      return result;
    } catch (e) {
      _isConnected = false;
      _connectedDeviceName = null;
      _safeAdd(PrinterConnectionState.error);
      return false;
    }
  }

  // ─── Uzish ────────────────────────────────────────────────────────
  Future<void> disconnect() async {
    try {
      await PrintBluetoothThermal.disconnect;
    } catch (_) {}
    _isConnected = false;
    _connectedDeviceName = null;
    _connectedDeviceAddress = null;
    _safeAdd(PrinterConnectionState.disconnected);
  }

  // ─── Matn yuborish (katta/kichik o'lcham) ────────────────────────
  Future<bool> printText(String text, {int size = 1}) async {
    if (!_isConnected) return false;
    try {
      await PrintBluetoothThermal.writeString(
        printText: PrintTextSize(size: size, text: text),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  // ─── Byte ro'yxatini yuborish (to'liq ESC/POS buyruqlar) ─────────
  Future<bool> writeBytes(List<int> bytes) async {
    if (!_isConnected) return false;
    try {
      return await PrintBluetoothThermal.writeBytes(bytes);
    } catch (_) {
      return false;
    }
  }

  // ─── Yangi qator ──────────────────────────────────────────────────
  Future<bool> printNewLine() async {
    if (!_isConnected) return false;
    try {
      await PrintBluetoothThermal.writeString(
        printText: PrintTextSize(size: 1, text: '\n'),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  // ─── To'lov kvitansiyasi bosib chiqarish ─────────────────────────
  Future<bool> printPaymentReceipt({
    required String organizationName,
    required String studentName,
    required String receiptNumber,
    required int amount,
    required DateTime date,
    String? notes,
  }) async {
    if (!_isConnected) return false;

    try {
      // Sarlavha
      await printText(organizationName, size: 2);
      await printText('TO\'LOV KVITANSIYASI', size: 1);
      await _printSeparator();

      // Ma'lumotlar
      await printText('Sana: ${_formatDate(date)}');
      await printText('Raqam: $receiptNumber');
      await printText('Talaba: $studentName');
      await printNewLine();
      await _printSeparator();
      await printText('${_formatAmount(amount)} so\'m', size: 2);
      await _printSeparator();
      await printNewLine();

      if (notes != null && notes.isNotEmpty) {
        await printText('Izoh: $notes');
        await printNewLine();
      }

      // Pastki qism
      await printText('Rahmat!');
      await printNewLine();
      await printNewLine();
      await printNewLine();

      return true;
    } catch (_) {
      return false;
    }
  }

  // ─── Davomat hisoboti bosib chiqarish ─────────────────────────────
  Future<bool> printAttendanceReport({
    required String organizationName,
    required String groupName,
    required String date,
    required List<AttendancePrintEntry> entries,
  }) async {
    if (!_isConnected) return false;

    try {
      // Sarlavha
      await printText(organizationName, size: 2);
      await printText('DAVOMAT HISOBOTI', size: 1);
      await printNewLine();
      await printText('Guruh: $groupName');
      await printText('Sana: $date');
      await _printSeparator();

      // Ro'yxat
      for (var i = 0; i < entries.length; i++) {
        final e = entries[i];
        final num = '${i + 1}'.padLeft(2);
        final name = _truncate(e.studentName, 14).padRight(15);
        final status = e.isPresent ? '✓' : '✗';
        await printText('$num  $name$status');
      }

      await _printSeparator();
      await printText(
        'Jami: ${entries.length} | '
        'Bor: ${entries.where((e) => e.isPresent).length} | '
        'Yo\'q: ${entries.where((e) => !e.isPresent).length}',
      );
      await printNewLine();
      await printNewLine();
      await printNewLine();

      return true;
    } catch (_) {
      return false;
    }
  }

  // ─── Maxsus matn bosib chiqarish ─────────────────────────────────
  Future<bool> printCustom({
    required String title,
    required List<String> lines,
    String? footer,
  }) async {
    if (!_isConnected) return false;

    try {
      await printText(title, size: 2);
      await _printSeparator();

      for (final line in lines) {
        await printText(line);
      }

      if (footer != null) {
        await _printSeparator();
        await printText(footer);
      }

      await printNewLine();
      await printNewLine();
      await printNewLine();

      return true;
    } catch (_) {
      return false;
    }
  }

  // ─── Yordamchi metodlar ──────────────────────────────────────────
  Future<void> _printSeparator() async {
    await printText('--------------------------------');
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}.'
        '${date.month.toString().padLeft(2, '0')}.'
        '${date.year}';
  }

  String _formatAmount(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }

  String _truncate(String text, int maxLen) {
    if (text.length <= maxLen) return text;
    return '${text.substring(0, maxLen - 1)}…';
  }

  // ─── Resurslarni tozalash ────────────────────────────────────────
  void dispose() {
    disconnect();
    _connectionController.close();
  }

  // ─── Xavfsiz event yuborish (closed controller'da xato yo'q) ──
  bool _isControllerClosed = false;
  void _safeAdd(PrinterConnectionState state) {
    if (_isControllerClosed) return;
    try {
      _connectionController.add(state);
    } catch (_) {
      _isControllerClosed = true;
    }
  }
}

/// Printer ulanish holati.
enum PrinterConnectionState {
  disconnected,
  connecting,
  connected,
  error,
}

/// Davomat bosib chiqarish uchun yozuv.
class AttendancePrintEntry {
  final String studentName;
  final bool isPresent;

  const AttendancePrintEntry({
    required this.studentName,
    required this.isPresent,
  });
}
