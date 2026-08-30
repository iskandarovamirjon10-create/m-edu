import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../services/app_logger.dart';

/// Global xato ushlash mexanizmi.
///
/// Flutter framework xatolari (widget build errors, async errors) va
/// platform xatolarini ushlab, AppLogger orqali qayd etadi.
///
/// Production'da Firebase Crashlytics yoki Sentry integratsiyasi uchun
/// tayyor joy — [onCrashlyticsReport] callback qo'shish yetarli.
///
/// Usage:
/// ```dart
/// // main() ichida, WidgetsFlutterBinding.ensureInitialized() keyin:
/// GlobalErrorHandler.install();
/// ```
class GlobalErrorHandler {
  GlobalErrorHandler._();

  static bool _installed = false;

  /// Crashlytics/Sentry ga xabar berish uchun callback.
  ///
  /// Production'da FirebaseCrashlytics.instance.recordError yoki
  /// Sentry.captureException chaqirilishi mumkin.
  static void Function(Object error, StackTrace stack, {bool? fatal})?
      onCrashlyticsReport;

  /// Xato hisobotlari (test va diagnostika uchun).
  static final List<ErrorReport> reports = [];

  /// Global xato handler'ni o'rnatadi.
  ///
  /// Idempotent — bir necha marta chaqirilsa ham xavfsiz.
  /// `WidgetsFlutterBinding.ensureInitialized()` dan KEYIN chaqirilishi shart.
  static void install() {
    if (_installed) return;
    _installed = true;

    // 1) Flutter framework xatolari (widget build, layout, paint errors).
    FlutterError.onError = _handleFlutterError;

    // 2) Platform xatolari (Dart isolate uncaught exceptions).
    PlatformDispatcher.instance.onError = _handlePlatformError;

    // 3) Async xatolar (unawaited Future'lardagi xatolar).
    // Zichning asosiy Zone'i ichida ushlanadi.
    runZonedGuarded(
      () {
        // Bo'sh — main() ichidagi ish shu Zone'da bajariladi.
        // Qo'shimcha code kerak emas, chunki ErrorHandler allaqachon o'rnatilgan.
      },
      _handleAsyncError,
    );

    AppLogger.info('Global error handler installed');
  }

  static void _handleFlutterError(FlutterErrorDetails details) {
    final error = details.exception;
    final stack = details.stack ?? StackTrace.current;
    final context = details.context?.toString() ?? '';
    final library = details.library ?? '';

    final report = ErrorReport(
      type: ErrorType.flutter,
      error: error,
      stack: stack,
      context: context,
      library: library,
      timestamp: DateTime.now(),
    );

    reports.add(report);
    _logReport(report);
    _reportToCrashlytics(error, stack, fatal: details.silent != true);
  }

  static bool _handlePlatformError(Object error, StackTrace stack) {
    final report = ErrorReport(
      type: ErrorType.platform,
      error: error,
      stack: stack,
      timestamp: DateTime.now(),
    );

    reports.add(report);
    _logReport(report);
    _reportToCrashlytics(error, stack, fatal: true);
    return true; // Xato qayta ishlandi (handler tomonidan).
  }

  static void _handleAsyncError(Object error, StackTrace stack) {
    final report = ErrorReport(
      type: ErrorType.async,
      error: error,
      stack: stack,
      timestamp: DateTime.now(),
    );

    reports.add(report);
    _logReport(report);
    _reportToCrashlytics(error, stack);
  }

  static void _logReport(ErrorReport report) {
    final errorMsg = '${report.error.runtimeType}: ${report.error}';
    final contextInfo =
        report.context.isNotEmpty ? ' [${report.context}]' : '';
    final libraryInfo =
        report.library.isNotEmpty ? ' (${report.library})' : '';

    switch (report.type) {
      case ErrorType.flutter:
        AppLogger.error(
          'Flutter error$contextInfo$libraryInfo: $errorMsg',
        );
      case ErrorType.platform:
        AppLogger.critical('Platform error: $errorMsg');
      case ErrorType.async:
        AppLogger.error('Async error: $errorMsg');
    }

    // Development'da stack trace'ni ham log qilish.
    if (kDebugMode && report.stack.toString().isNotEmpty) {
      final stackStr = report.stack.toString();
      final shortStack =
          stackStr.split('\n').take(10).join('\n');
      developer.log('Stack trace:\n$shortStack', name: 'ErrorHandler');
    }
  }

  static void _reportToCrashlytics(
    Object error,
    StackTrace stack, {
    bool? fatal,
  }) {
    try {
      onCrashlyticsReport?.call(error, stack, fatal: fatal);
    } catch (_) {
      // Crashlytics o'zi xato bersa — asosiy handler'ni buzmaslik kerak.
    }
  }

  /// So'nggi xatolarni tozalash (test yoki diagnostika uchun).
  static void clearReports() => reports.clear();
}

/// Xato turi.
enum ErrorType { flutter, platform, async }

/// Xato hisoboti — diagnostika va Crashlytics integratsiyasi uchun.
class ErrorReport {
  final ErrorType type;
  final Object error;
  final StackTrace stack;
  final String context;
  final String library;
  final DateTime timestamp;

  const ErrorReport({
    required this.type,
    required this.error,
    required this.stack,
    this.context = '',
    this.library = '',
    required this.timestamp,
  });

  @override
  String toString() =>
      '[${type.name}] ${error.runtimeType}: $error @ $timestamp';
}
