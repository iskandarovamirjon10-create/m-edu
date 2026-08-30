import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/network/domain/sync_operation.dart';
import 'package:m_edu/core/network/infrastructure/datasources/sync_operation_datasource.dart';
import 'package:m_edu/core/network/infrastructure/models/sync_operation_record.dart';

/// GAPS-G4 / DECISIONS-D13: bloklangan (conflict/permanent) sync
/// operatsiyalarni admin hal qilishi — retryBlocked (local-wins) va
/// discardBlocked (remote-wins). Conflict hech qachon avtomatik hal
/// qilinmaydi; faqat adminning aniq qarori bilan.
void main() {
  late Directory tempDir;
  late Isar isar;
  late SyncOperationDataSource queue;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_sync_conflict');
    isar = await Isar.open(
      [SyncOperationRecordSchema],
      directory: tempDir.path,
    );
    queue = SyncOperationDataSource(isar);
  });

  tearDown(() async {
    await isar.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  Future<void> enqueuePayment({String id = 'pay-1', int version = 3}) {
    return queue.enqueue(
      entityType: 'payment',
      entityId: id,
      operationType: SyncOperationType.upsert,
      payload: const {'amount': 200000},
      version: version,
      deviceId: 'device-A',
    );
  }

  test(
      'markConflict → blockedOperations ko\'rsatadi; retryBlocked pendingga qaytaradi',
      () async {
    await enqueuePayment();
    await queue.markConflict('payment:pay-1', 9);

    final blocked = await queue.blockedOperations();
    expect(blocked, hasLength(1));
    expect(blocked.first.syncStatus, SyncStatus.conflict.name);
    expect(blocked.first.remoteVersion, 9);
    expect(blocked.first.lastError, isNotNull);

    // Admin qarori: local-wins — qayta navbatga.
    await queue.retryBlocked('payment:pay-1');

    final after = await queue.blockedOperations();
    expect(after, isEmpty);

    final due = await queue.dueOperations();
    expect(due, hasLength(1));
    expect(due.first.syncStatus, SyncStatus.pending.name);
    expect(due.first.retryCount, 0);
    expect(due.first.remoteVersion, isNull);
    expect(due.first.lastError, isNull);
    expect(due.first.nextRetryAt, isNull);
  });

  test('discardBlocked — operatsiya navbatdan butunlay o\'chadi (remote-wins)',
      () async {
    await enqueuePayment();
    await queue.markConflict('payment:pay-1', 9);

    await queue.discardBlocked('payment:pay-1');

    expect(await queue.blockedOperations(), isEmpty);
    expect(await queue.dueOperations(), isEmpty);
    expect(await queue.pendingCount(), 0);
  });

  test('permanent xatolar ham blockedOperations ro\'yxatida — admin ko\'radi',
      () async {
    await enqueuePayment();
    await queue.markPermanent('payment:pay-1', 'validation: amount null');

    final blocked = await queue.blockedOperations();
    expect(blocked, hasLength(1));
    expect(blocked.first.syncStatus, SyncStatus.permanent.name);

    // Retry faqat bloklangan holatlar uchun — permanent ham qaytariladi.
    await queue.retryBlocked('payment:pay-1');
    expect(await queue.blockedOperations(), isEmpty);
    expect(await queue.dueOperations(), hasLength(1));
  });

  test(
      'retryBlocked/discardBlocked — bloklanmagan operatsiyaga ta\'sir qilmaydi',
      () async {
    await enqueuePayment();

    await queue.retryBlocked('payment:pay-1');
    expect(await queue.dueOperations(), hasLength(1));
    expect(await queue.pendingCount(), 1);

    await queue.discardBlocked('payment:pay-1');
    expect(await queue.dueOperations(), hasLength(1));

    // Noma'lum ID — jim no-op, xato tashlamaydi.
    await queue.retryBlocked('payment:nonexistent');
    await queue.discardBlocked('payment:nonexistent');
  });

  test('retryBlocked backoff holatini tozalaydi — darhol qayta yuboriladi',
      () async {
    await enqueuePayment();
    // Bir necha marta failed bo'lgan — retryCount/nextRetryAt oshgan.
    await queue.markFailed('payment:pay-1', 'network down');
    await queue.markFailed('payment:pay-1', 'network down');
    // Backoff tufayli nextRetryAt kelajakda — keyingi pass vaqtini simul.
    final op = await queue.dueOperations(
        now: DateTime.now().add(const Duration(minutes: 30)));
    expect(op.first.retryCount, 2);
    expect(op.first.nextRetryAt, isNotNull);

    await queue.markConflict('payment:pay-1', 9);
    await queue.retryBlocked('payment:pay-1');

    final after = await queue.dueOperations(now: DateTime.now());
    expect(after, hasLength(1));
    expect(after.first.retryCount, 0);
    expect(after.first.nextRetryAt, isNull);
  });
}
