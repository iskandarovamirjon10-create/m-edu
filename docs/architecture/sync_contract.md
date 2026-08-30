# M-EDU SYNC CONTRACT (Architecture Decision — Phase 0)

Status: **ACCEPTED** · Scope: core sync architecture · Supersedes: ad-hoc sync notes in code

This document is the single authoritative definition of how M-EDU devices
converge data. It is written BEFORE Phase 1 implementation so that the
implementation has a complete, internally consistent contract to satisfy.
If a change to this contract is required, the change must be made here
first and then implemented — never the other way around.

---

## 1. Deployment model (product decision)

M-EDU is a **true multi-device** system. Target deployment:

- 1 Admin Windows PC
- multiple Teacher Android devices
- multiple camera/device sources

Rules:

- **Local database is authoritative for local operation** (offline-first).
- **Cloud (Firestore) is the synchronization/coordination layer**, not a
  source of truth that blocks local work.
- Data must converge across devices; there is NO single-device downgrade.
- Every device may read and write every entity it is authorized for.

```
OFFLINE DEVICE A          CLOUD                  OFFLINE DEVICE B
  local write   →   pending op   →   push   →   doc   ←   pull   ←   local write
```

## 2. Identifiers

| Name | Definition | Example | Owner |
|---|---|---|---|
| `organizationId` | Globally unique ID of the M-EDU organization (education center). Generated once at first setup, immutable. Namespace root for all data. | `org-9f2c...` | Org setup |
| `branchId` | ID of a branch within an organization. Defaults to `branch-default` in single-branch deployments. | `branch-a1b2...` | Org setup |
| `deviceId` | Stable, cryptographically random ID of a physical device. Generated on first launch, persisted in `deviceInfoRecords`. Never changes across restarts/updates. | `3f9a...` (16-byte hex) | `DeviceIdentity` |
| `entityId` | Globally unique, immutable ID of an entity *instance*. Must be collision-safe across devices (Phase 2 replaces device-local sequential generation). Examples: `identityId`, `paymentId`, `studentId` (= identityId), attendance `identityId:lessonId`. | `M-EDU-2026-000482` | Entity domain |

Scope rule: every entity belongs to exactly one `(organizationId, branchId)`.
Phase 10 (branch isolation) enforces this at query/pull level; the remote
document shape below already carries both fields so the namespace is
forward-compatible.

## 3. Versioning

| Field | Direction | Meaning |
|---|---|---|
| `clientVersion` | local → remote | The entity's `syncVersion` at the moment of the local write. Monotonic per entity on a device; incremented by every local mutation. |
| `serverVersion` | remote | The version stored in the remote document (written from `clientVersion`). |
| `updatedAt` | remote | **Server timestamp** of the last write (Firestore `FieldValue.serverTimestamp()`). Used ONLY for the pull cursor ordering. |
| `updatedByDeviceId` | remote | `deviceId` of the device that last wrote the document. |
| `deleted` | remote | Tombstone flag. |

Rules:

- `serverVersion == clientVersion` at write time; the sink never alters it.
- Version comparison is the PRIMARY conflict axis.
- `updatedAt`/`updatedByDeviceId` are the TIE-BREAK axes (see §7).

## 4. Remote document shape (Firestore)

```
sync/{entityType}/items/{entityId}
{
  data:      { ...entity payload ... },   // null for tombstones
  version:   int,                          // serverVersion
  orgId:     'org-...' | 'org-default',    // reserved (§1); enforced in Phase 10
  branchId:  'branch-...' | 'branch-default',
  updatedByDevice: 'deviceId',
  updatedAt: serverTimestamp,              // pull cursor axis
  deleted:   false | true                  // tombstone flag
}
```

`entityType` ∈ {identity, student, attendance, payment} (face records and
recognition attempt records are NEVER synced — biometric data stays
device-local by policy).

## 5. Pull / bootstrap semantics

- Each device keeps a **per-entityType cursor** (`SyncCursorRecord`):
  `lastPulledAt` = the latest `updatedAt` (server time) already applied.
- **Bootstrap (new device / empty cursor):** pull from
  `updatedAt > epoch` in `updatedAt`-ascending batches until exhausted.
- **Incremental pull:** pull from `updatedAt > lastPulledAt`.
- Batches are bounded (`pullBatchLimit`, default 200).
- The cursor advances to the max `updatedAt` seen in a batch ONLY after
  the batch was applied. Crash between batches ⇒ next pass re-pulls from
  the last committed cursor; application is idempotent (§8), so this is safe.
- Pull is **conservative**: a remote document is applied only when the
  remote is the deterministic winner (§7). Local unsynced data is never
  silently clobbered.

## 6. Push semantics

- Local mutation ⇒ `pendingSync = true` ⇒ enqueued (deterministic
  `operationId = entityType:entityId`, upsert) ⇒ pushed in `processOnce`.
- Push is idempotent: `put(entityId, ...)` is an upsert; re-sending the same
  version is a no-op or a deterministic loss (never a silent overwrite).
- Retry: exponential backoff `base * 2^retryCount`, capped at 10 minutes,
  `maxRetries` (8) then `permanent` (no automatic retry). Validation errors
  (`permission`, `invalid-argument`) are permanent immediately.
- Crash recovery: `resetInFlightToPending()` at each pass start re-queues
  operations left `inFlight` by a killed process.

## 7. Conflict semantics (deterministic)

A conflict exists when the same `entityId` was modified in two places and
neither version is strictly newer.

**Winner rule (total order):**

1. Higher version wins.
2. Equal version ⇒ higher `updatedByDeviceId` (lexicographic, ascending)
   wins. DeviceId is the cross-device tie-break because wall clocks are
   unreliable; this makes the winner deterministic on every device
   regardless of clock skew.
3. `updatedAt` is advisory (observability) and only disambiguates
   same-device re-writes; it never overrides the deviceId tie-break.

**Push side (`put`):**

- `clientVersion < serverVersion` ⇒ `conflict` (never write).
- `clientVersion == serverVersion`:
  - same `updatedByDeviceId` ⇒ idempotent no-op (overwrite OK).
  - different `updatedByDeviceId` ⇒ `conflict` if the remote device wins the
    tie-break, else write (local wins).
- `clientVersion > serverVersion` ⇒ write.

**Pull side (`applyRemote`):**

- No local record ⇒ apply (insert).
- Local record, no unsynced local changes (`pendingSync == false`):
  - `remote.version > local.version` ⇒ apply.
  - `remote.version == local.version` ⇒ tie-break by deviceId; remote wins ⇒
    apply, else skip.
  - `remote.version < local.version` ⇒ skip.
- Local record WITH unsynced changes (`pendingSync == true`):
  - `remote.version > local.version` ⇒ conflict; remote wins ⇒ apply remote,
    loser's local state preserved in the sync queue (marked `conflict`,
    admin-visible) and in `SyncConflictRecord`.
  - equal version ⇒ tie-break by deviceId; winner applied; loser recorded.
  - `remote.version < local.version` ⇒ local wins; keep local; no conflict
    record (this is normal LWW, not a divergence).

**Attendance special rule:** attendance documents merge on the domain merge
semantics (earliest `checkInAt`, latest `checkOutAt`, primary method kept)
instead of blind LWW — see §9. Conflicts are still recorded for audit.

**No silent data loss:** every applied divergence writes a
`SyncConflictRecord` (metadata only — versions, winner, devices, time) and
the losing local operation stays visible as a blocked queue operation for
admin review (`retryBlocked` = local-wins, `discardBlocked` = remote-wins).

## 8. Idempotency

- `entityId` is deterministic per entity instance ⇒ the same logical write
  always targets the same remote doc ⇒ re-push/re-pull is safe.
- `operationId = entityType:entityId` ⇒ one queue row per entity.
- Application of a remote doc whose version equals the local version (same
  device, no divergence) is a no-op.
- Re-applying an already-applied remote doc (crash between cursor commit
  and next pull) is a no-op.

## 9. Tombstones / deletion semantics

- A delete is a **tombstone write**, not a document removal:
  `{deleted: true, version, updatedByDevice, updatedAt}`. This lets pulls
  propagate deletions to all devices.
- A device receiving a tombstone deletes the local entity record (and, for
  identity, records the domain-level `deleted` status transition where the
  domain requires history).
- Tombstones are retained for a retention window (default 90 days), then
  purged by a maintenance job (scheduled work — not part of Phase 1).
- Deleting an entity never deletes financial/attendance/audit history;
  those are separate entities keyed by `identityId` and remain intact.

## 10. Cursors (last-sync metadata)

- `SyncCursorRecord` is **device-local**, per `entityType`, and excluded
  from cloud sync. It is exported in device backups (a restored device
  resumes from its own watermark).
- Cursor values are server timestamps; never use device wall-clock for the
  cursor (clock skew would skip or duplicate data).

## 11. Security & privacy boundary

- The sink sends only entity payloads (no face templates, no recognition
  attempts, no photo files, no `qrSeed` once Phase 5 removes it).
- `updatedByDeviceId` is written by the sink from the authenticated
  `deviceId`; a malicious client forging another device's ID is addressed
  in Phase 10 (server-side rules) — the contract assumes Firestore rules
  restrict writes per authenticated device where available.
- Conflict records store metadata only — never payloads or biometric data.

## 12. Phase status

| Term | Status |
|---|---|
| organizationId / branchId | Defined; carried in remote doc as `org-default`/`branch-default` in Phase 1; enforcement in Phase 10 |
| deviceId | Implemented (`DeviceIdentity`) |
| entityId collision-safety | Phase 2 (replaces device-local sequential generation) |
| Pull / bootstrap / cursors | Phase 1 |
| Push / retry / crash recovery | Implemented (Phase 1 verifies) |
| Tombstones | Phase 1 |
| Deterministic conflict resolution | Phase 1 |
| Backup (encryption, schema-driven) | Phase 7 |
| Firestore server-side authorization | Phase 10 |

---

## Appendix: acceptance criteria for Phase 1 (from this contract)

1. Device A creates student → A pushes → B pulls → B has the student.
2. Device A edits student → A pushes → B pulls → B has the edit.
3. A and B edit the same student offline, both reconnect → identical
   deterministic winner on both devices; loser is observable in the queue
   and in `SyncConflictRecord`; no silent overwrite.
4. Equal-version writes from two devices → tie-break by deviceId; winner
   deterministic; conflict recorded.
5. Delete on A → tombstone → B pulls → local record deleted.
6. Repeated pulls are idempotent; cursor advances monotonically.
