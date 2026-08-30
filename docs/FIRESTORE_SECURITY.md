# M-EDU Firestore Security Rules Documentation

## Overview

Server-side security rules for the M-EDU Firestore database. These rules enforce authentication, organization membership, and data integrity at the Firestore level.

## Deployment

```bash
firebase deploy --only firestore:rules
```

## Security Model

### Principles

1. **Fail closed**: Unmatched collections are DENIED by default
2. **Authentication required**: All reads/writes require authenticated users
3. **Immutable metadata**: `createdBy`, `organizationId`, `version` cannot be changed after creation
4. **Optimistic concurrency**: Version must increment by exactly 1 per update
5. **Self-role protection**: Users cannot elevate their own role or change their organization
6. **No hard-delete via client**: User records can only be soft-deleted

### Collection Rules

| Collection | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| `users` | Own only | Own only | Cannot change role/org/email | DENIED |
| `students` | All authenticated | Valid metadata + version=1 | Immutable fields + version increment | Soft-delete only |
| `teachers` | All authenticated | Valid metadata + version=1 | Immutable fields + version increment | Soft-delete only |
| `groups` | All authenticated | Valid metadata + version=1 | Immutable fields + version increment | Soft-delete only |
| `attendance` | All authenticated | Valid metadata + version=1 | Immutable fields + version increment | Soft-delete only |
| `payments` | All authenticated | Valid metadata + version=1 | Immutable fields + version increment | Soft-delete only |
| `grades` | All authenticated | Valid metadata + version=1 | Immutable fields + version increment | Soft-delete only |
| `homework` | All authenticated | Valid metadata + version=1 | Immutable fields + version increment | Soft-delete only |
| `schedules` | All authenticated | Valid metadata + version=1 | Immutable fields + version increment | Soft-delete only |
| `organizations` | All authenticated | Owner only | Owner only | Owner only |
| `sync` | All authenticated | All authenticated | All authenticated | All authenticated |

### Helper Functions

```
isAuth()                  — request.auth != null
validCreationMetadata()   — createdBy == uid(), version == 1, org present
immutableFieldsUnchanged() — createdBy, orgId match; version not increased
validVersionIncrement()   — new version == old version + 1
```

## What This Does NOT Protect

1. **Client-side RBAC** — Server rules don't check application roles for most collections
2. **Field-level access control** — Users can read all records in their authenticated session
3. **Organization isolation** — Rules don't enforce `organizationId` filtering on reads
4. **Rate limiting** — No Firestore-level rate limiting
5. **Biometric data** — Not synced to Firestore (local only)

## Recommendations

1. **Enable organization-level filtering** in Firestore Security Rules for multi-tenant isolation
2. **Add custom claims** via Firebase Admin SDK for server-enforced RBAC
3. **Enable Firestore TTL** for sync metadata and tombstone cleanup
4. **Enable Cloud Audit Logs** for compliance tracking
5. **Set up Firestore quotas** to prevent abuse

## Integration with Client RBAC

The client-side RBAC system (`core/security/permissions.dart`) handles:
- Route access control (GoRouter guards)
- Command authorization (every sensitive operation checked)
- UI visibility (role-based menu items)

Firestore rules provide the server-side defense-in-depth layer.
