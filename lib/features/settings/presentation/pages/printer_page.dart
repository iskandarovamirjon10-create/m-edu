import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';

import '../../../../core/services/thermal_printer_service.dart';
import '../../../../design/design.dart';
import '../providers/printer_providers.dart';

/// Thermal Printer boshqaruv sahifasi.
///
/// - Bluetooth qurilmalarini qidirish va tanlash
/// - Ulanish/uzilish
/// - Sinov bosib chiqarish
class PrinterPage extends ConsumerStatefulWidget {
  const PrinterPage({super.key});

  @override
  ConsumerState<PrinterPage> createState() => _PrinterPageState();
}

class _PrinterPageState extends ConsumerState<PrinterPage> {
  bool _scanning = false;
  bool _printing = false;

  @override
  Widget build(BuildContext context) {
    final connectionAsync = ref.watch(printerConnectionProvider);
    final devicesAsync = ref.watch(pairedDevicesProvider);
    final connectedName = ref.watch(connectedDeviceNameProvider);
    final colors = context.dsColors;

    final connectionState = connectionAsync.valueOrNull ?? PrinterConnectionState.disconnected;
    final isConnected = connectionState == PrinterConnectionState.connected;
    final isConnecting = connectionState == PrinterConnectionState.connecting;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Thermal Printer'),
        actions: [
          if (isConnected)
            IconButton(
              tooltip: 'Uzish',
              icon: const Icon(Icons.bluetooth_disabled),
              onPressed: _disconnect,
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Holat kartochkasi ────────────────────────────────
            _StatusCard(
              isConnected: isConnected,
              isConnecting: isConnecting,
              deviceName: connectedName,
            ),
            const SizedBox(height: 20),

            // ─── Bluetooth qurilmalar ────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Bluetooth qurilmalar',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: colors.textPrimary,
                  ),
                ),
                IconButton(
                  tooltip: 'Qayta qidirish',
                  icon: Icon(
                    Icons.refresh,
                    color: _scanning ? context.dsColors.accent : colors.textSecondary,
                  ),
                  onPressed: _scanning ? null : _refreshDevices,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_scanning)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              devicesAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      'Xato: $e',
                      style: TextStyle(color: context.dsColors.error),
                    ),
                  ),
                ),
                data: (devices) {
                  if (devices.isEmpty) {
                    return _EmptyDevices(onRefresh: _refreshDevices);
                  }
                  return Column(
                    children: [
                      for (final device in devices)
                        _DeviceTile(
                          device: device,
                          isConnected: connectedName == device.name,
                          isConnecting: isConnecting,
                          onConnect: () => _connect(device.macAdress),
                          onDisconnect: _disconnect,
                        ),
                    ],
                  );
                },
              ),
            const SizedBox(height: 24),

            // ─── Sinov bosib chiqarish ───────────────────────────
            if (isConnected) ...[
              Text(
                'Sinov',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              _TestPrintSection(printing: _printing, onTestPrint: _testPrint),
            ],

            const SizedBox(height: 24),

            // ─── Yordam ──────────────────────────────────────────
            _HelpSection(),
          ],
        ),
      ),
    );
  }

  Future<void> _refreshDevices() async {
    setState(() => _scanning = true);

    // Bluetooth ruxsatini so'rash
    final status = await [
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();

    if (status[Permission.bluetoothScan]!.isGranted ||
        status[Permission.bluetoothConnect]!.isGranted) {
      ref.invalidate(pairedDevicesProvider);
    }

    // Animatsiya uchun kamida 1 kutish
    await Future<void>.delayed(const Duration(milliseconds: 800));
    if (mounted) setState(() => _scanning = false);
  }

  Future<void> _connect(String macAddress) async {
    final service = ref.read(thermalPrinterServiceProvider);
    await service.connect(macAddress);
  }

  Future<void> _disconnect() async {
    final service = ref.read(thermalPrinterServiceProvider);
    await service.disconnect();
  }

  Future<void> _testPrint() async {
    setState(() => _printing = true);
    final service = ref.read(thermalPrinterServiceProvider);

    await service.printPaymentReceipt(
      organizationName: "M-Edu Ta'lim Markazi",
      studentName: "Sinov o'quvchisi",
      receiptNumber: 'TEST-${DateTime.now().millisecondsSinceEpoch}',
      amount: 500000,
      date: DateTime.now(),
      notes: "Sinov chechka — printer to'g'ri ishlayapti!",
    );

    if (mounted) {
      setState(() => _printing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Sinov chechka yuborildi!'),
          backgroundColor: context.dsColors.success,
        ),
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Widget'lar
// ═══════════════════════════════════════════════════════════════════

/// Ulanish holati kartochkasi.
class _StatusCard extends StatelessWidget {
  final bool isConnected;
  final bool isConnecting;
  final String? deviceName;

  const _StatusCard({
    required this.isConnected,
    required this.isConnecting,
    this.deviceName,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    Color bgColor;
    IconData icon;
    String title;
    String subtitle;

    if (isConnected) {
      bgColor = context.dsColors.success;
      icon = Icons.bluetooth_connected;
      title = 'Ulangan';
      subtitle = deviceName ?? 'Printer';
    } else if (isConnecting) {
      bgColor = context.dsColors.warning;
      icon = Icons.bluetooth_searching;
      title = 'Ulanmoqda...';
      subtitle = 'Iltimos kuting';
    } else {
      bgColor = colors.textTertiary;
      icon = Icons.bluetooth_disabled;
      title = 'Ulanmagan';
      subtitle = 'Printer tanlang';
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            bgColor,
            bgColor.withValues(alpha: 0.7),
          ],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: bgColor.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: Colors.white, size: 30),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Bluetooth qurilmasi qator.
class _DeviceTile extends StatelessWidget {
  final BluetoothInfo device;
  final bool isConnected;
  final bool isConnecting;
  final VoidCallback onConnect;
  final VoidCallback onDisconnect;

  const _DeviceTile({
    required this.device,
    required this.isConnected,
    required this.isConnecting,
    required this.onConnect,
    required this.onDisconnect,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isConnected
            ? context.dsColors.success.withValues(alpha: 0.08)
            : colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isConnected
              ? context.dsColors.success.withValues(alpha: 0.4)
              : colors.divider.withValues(alpha: 0.5),
          width: isConnected ? 1.5 : 0.8,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: (isConnected ? context.dsColors.success : context.dsColors.accent)
                .withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.print,
            color: isConnected ? context.dsColors.success : context.dsColors.accent,
            size: 22,
          ),
        ),
        title: Text(
          device.name,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: colors.textPrimary,
          ),
        ),
        subtitle: Text(
          device.macAdress,
          style: TextStyle(
            fontSize: 12,
            color: colors.textSecondary,
          ),
        ),
        trailing: isConnected
            ? TextButton(
                onPressed: isConnecting ? null : onDisconnect,
                child: Text(
                  'Uzish',
                  style: TextStyle(color: context.dsColors.error),
                ),
              )
            : TextButton(
                onPressed: isConnecting ? null : onConnect,
                child: isConnecting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Ulanish'),
              ),
      ),
    );
  }
}

/// Bo'sh qurilmalar.
class _EmptyDevices extends StatelessWidget {
  final VoidCallback onRefresh;

  const _EmptyDevices({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Column(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: colors.textTertiary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(22),
              ),
              child: Icon(
                Icons.bluetooth_searching,
                size: 36,
                color: colors.textTertiary,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Qurilmalar topilmadi',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Thermal printerni Bluetooth bilan\nto\'g\'ridan-to\'g\'ri ulang',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: colors.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Qayta qidirish'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sinov bosib chiqarish.
class _TestPrintSection extends StatelessWidget {
  final bool printing;
  final VoidCallback onTestPrint;

  const _TestPrintSection({
    required this.printing,
    required this.onTestPrint,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: colors.divider.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Column(
        children: [
          Icon(
            Icons.receipt_long_outlined,
            size: 40,
            color: context.dsColors.accent,
          ),
          const SizedBox(height: 12),
          Text(
            'Sinov chechka',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "Namuna to'lov kvitansiyasini bosib chiqaradi",
            style: TextStyle(
              fontSize: 13,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: printing ? null : onTestPrint,
              icon: printing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.print),
              label: Text(printing ? 'Bosib chiqarilmoqda...' : 'Sinov bosib chiqarish'),
            ),
          ),
        ],
      ),
    );
  }
}

/// Yordam bo'limi.
class _HelpSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.dsColors.info.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: context.dsColors.info.withValues(alpha: 0.2),
          width: 0.8,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.help_outline, size: 18, color: context.dsColors.info),
              const SizedBox(width: 8),
              Text(
                "Qo'llanma",
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: colors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            "1. Printerni yoqing va Bluetooth bilan telefonga ulang\n"
            "2. \"Qurilmalar\" ro'yxatidan printerni tanlang\n"
            "3. \"Ulanish\" tugmasini bosing\n"
            '4. "Sinov" bo\'limida chechka bosib chiqaring',
            style: TextStyle(
              fontSize: 13,
              color: colors.textSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
