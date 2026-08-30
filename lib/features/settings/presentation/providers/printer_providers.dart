// ignore: unused_import

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';

import '../../../../core/services/thermal_printer_service.dart';

/// Thermal printer xizmati — singleton.
final thermalPrinterServiceProvider = Provider<ThermalPrinterService>((ref) {
  final service = ThermalPrinterService();
  ref.onDispose(service.dispose);
  return service;
});

/// Bluetooth ulanish holati.
final printerConnectionProvider = StreamProvider<PrinterConnectionState>((ref) {
  final service = ref.watch(thermalPrinterServiceProvider);
  return service.connectionStream;
});

/// Bluetooth holati (yoqilgan/ochiq).
final bluetoothEnabledProvider = FutureProvider<bool>((ref) async {
  final service = ref.watch(thermalPrinterServiceProvider);
  return service.isBluetoothEnabled;
});

/// Bluetooth ruxsati (Android 12+).
final bluetoothPermissionProvider = FutureProvider<bool>((ref) async {
  final service = ref.watch(thermalPrinterServiceProvider);
  return service.isPermissionGranted;
});

/// Paired qurilmalar ro'yxati (yangilash uchun ref.invalidate ishlatiladi).
final pairedDevicesProvider = FutureProvider<List<BluetoothInfo>>((ref) async {
  final service = ref.watch(thermalPrinterServiceProvider);
  return service.getPairedDevices();
});

/// Joriy ulangan qurilma nomi.
final connectedDeviceNameProvider = Provider<String?>((ref) {
  final service = ref.watch(thermalPrinterServiceProvider);
  return service.connectedDeviceName;
});
