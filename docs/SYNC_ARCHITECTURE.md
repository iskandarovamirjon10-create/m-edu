# M-EDU Sync Architecture Technical Documentation

## Overview

M-EDU implements an **offline-first bidirectional sync engine** using Isar (local) and Firestore (remote). The system is designed so the application remains fully functional without network connectivity.

## Architecture

### Data Flow

```
LOCAL WRITE → pendingSync=true → SyncMapper.fetchPending() → SyncOperationQueue
→ due check → inFlight → RemoteDataSink.put() → version validation
→ markSynced → ackMapper (clear pendingSync)

PULL: RemoteDataSink.fetchChanged(since) → conflict resolution → applyRemote
→ cursor advancement
```

### Components

| Component | Location | Description |
|-----------|----------|-------------|
| `SyncEngine` | `core/network/sync_engine.dart` | Bidirectional push+pull engine |
| `SyncScheduler` | `core/network/sync_providers.dart` | Timer-based periodic sync |
| `RemoteDataSink` | `core/network/domain/remote_data_sink.dart` | Remote storage interface |
| `FirestoreRemoteDataSink` | `core/network/infrastructure/remote/` | Firestore implementation |
| `SyncOperationDataSource` | `core/network/infrastructure/datasources/` | Local operation queue |
| `SyncCursorDataSource` | `core/network/infrastructure/datasources/` | Pull cursor tracking |
| `SyncConflictDataSource` | `core/network/infrastructure/datasources/` | Conflict audit log |
| `SyncEntityMapper` | `core/network/sync_entity_mapper.dart` | Entity-specific sync mapping |

### Sync-Enabled Entities

| Entity | Mapper | Direction |
|--------|--------|-----------|
| Identity | `IdentitySyncMapper` | Bidirectional |
| Student | `StudentSyncMapper` | Bidirectional |
| Attendance | `AttendanceSyncMapper` | Bidirectional |
| Payment | `PaymentSyncMapper` | Bidirectional |

### Conflict Resolution

**Algorithm** (deterministic, no wall-clock dependency):
1. Higher version wins
2. Equal version → larger `deviceId` wins (lexicographic comparison)
3. Conflict recorded in `SyncConflictDataSource` for admin review
4. Local pending operation preserved in queue as `conflict` status

**Financial records**: Amount, date, studentId are immutable after creation.

### Tombstones

- Soft-delete only: records have a `deleted` flag
- Tombstones sync to Firestore
- Pull on another device respects tombstones
- No accidental resurrection: version increment prevents rollback

### Retry / Backoff

| Parameter | Value |
|-----------|-------|
| Backoff base | 2 seconds |
| Backoff formula | `2^retryCount` seconds |
| Max retries | 8 |
| Permanent after | 8 failures |

### Cursor Management

- Cursor advances ONLY after successful batch processing
- Crash recovery: cursor stays at last successful position
- Idempotent: applying the same pull batch twice produces the same state

### Crash Recovery

- `inFlight` operations reset to `pending` on engine restart
- `resetInFlightToPending()` called at start of each `processOnce()`

### Idempotency

- Duplicate pushes: same record version → no-op on remote (Firestore puts are idempotent)
- Duplicate pulls: cursor prevents re-processing
- App restart: pendingSync flags preserved, second pass is empty

### Configuration

- `isEnabled` = Firestore is configured (firebase_options.dart exists)
- When disabled: all operations are local-only (offline-first default)
- Sync interval: configurable (default: 1 minute)

### Sync Observability

The `SyncStatusController` provides:
- `SyncStatus.disabled` — Firebase not configured
- `SyncStatus.idle` — no sync in progress
- `SyncStatus.syncing` — active push/pull
- `SyncStatus.synced` — last sync successful
- `SyncStatus.conflict` — conflicts pending admin review
- `SyncStatus.failed` — sync error occurred
- Pending count for UI badge

### Security Rules

See `firestore.rules` for server-side authorization:
- Authenticated users only
- Organization membership required
- Version-based optimistic concurrency
- Immutable metadata fields (createdBy, organizationId)

### Known Limitations

1. **4 entities only** — Groups, Grades, Homework, Schedules, Finance not yet sync-enabled
2. **No server-side conflict resolution** — Conflicts require admin manual review
3. **No encryption in transit** — Relies on Firebase TLS (not end-to-end)
4. **No delta compression** — Full record sent on each change
