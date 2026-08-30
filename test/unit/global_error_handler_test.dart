import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/error/global_error_handler.dart';

void main() {
  setUp(() {
    GlobalErrorHandler.clearReports();
    GlobalErrorHandler.onCrashlyticsReport = null;
  });

  group('GlobalErrorHandler', () {
    test('install is idempotent — second call is no-op', () {
      GlobalErrorHandler.install();
      GlobalErrorHandler.install();
      // Should not throw
    });

    test('captures Flutter framework errors', () {
      // Trigger a Flutter error by calling FlutterError.reportError
      final details = FlutterErrorDetails(
        exception: StateError('test flutter error'),
        library: 'test',
        context: ErrorDescription('during test'),
      );
      FlutterError.reportError(details);

      expect(GlobalErrorHandler.reports.length, 1);
      expect(GlobalErrorHandler.reports.first.type, ErrorType.flutter);
      expect(
        GlobalErrorHandler.reports.first.error.toString(),
        contains('test flutter error'),
      );
    });

    test('captures platform errors', () {
      final handler = PlatformDispatcher.instance.onError;
      expect(handler, isNotNull);

      final handled = handler!(
        Exception('test platform error'),
        StackTrace.current,
      );
      expect(handled, isTrue);
      expect(GlobalErrorHandler.reports.length, 1);
      expect(GlobalErrorHandler.reports.first.type, ErrorType.platform);
    });

    test('clearReports resets list', () {
      final details = FlutterErrorDetails(
        exception: StateError('test'),
        library: 'test',
      );
      FlutterError.reportError(details);

      expect(GlobalErrorHandler.reports.isNotEmpty, isTrue);
      GlobalErrorHandler.clearReports();
      expect(GlobalErrorHandler.reports.isEmpty, isTrue);
    });

    test('onCrashlyticsReport callback is invoked', () {
      Object? capturedError;
      StackTrace? capturedStack;
      bool? capturedFatal;

      GlobalErrorHandler.onCrashlyticsReport = (error, stack, {fatal}) {
        capturedError = error;
        capturedStack = stack;
        capturedFatal = fatal;
      };

      final details = FlutterErrorDetails(
        exception: StateError('crashlytics test'),
        library: 'test',
      );
      FlutterError.reportError(details);

      expect(capturedError, isA<StateError>());
      expect(capturedStack, isNotNull);
    });

    test('onCrashlyticsReport failure does not break handler', () {
      GlobalErrorHandler.onCrashlyticsReport = (_, __, {fatal}) {
        throw Exception('crashlytics is broken');
      };

      // Should not throw
      final details = FlutterErrorDetails(
        exception: StateError('resilience test'),
        library: 'test',
      );
      FlutterError.reportError(details);

      expect(GlobalErrorHandler.reports.length, 1);
    });

    test('ErrorReport.toString contains type and error', () {
      final report = ErrorReport(
        type: ErrorType.async,
        error: Exception('test'),
        stack: StackTrace.current,
        timestamp: DateTime(2026),
      );

      expect(report.toString(), contains('async'));
      expect(report.toString(), contains('Exception: test'));
    });

    test('ErrorReport stores context and library', () {
      final report = ErrorReport(
        type: ErrorType.flutter,
        error: Exception('test'),
        stack: StackTrace.current,
        context: 'building HomePage',
        library: 'material',
        timestamp: DateTime(2026),
      );

      expect(report.context, 'building HomePage');
      expect(report.library, 'material');
    });
  });
}
