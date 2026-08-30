# M-EDU Google Sign-In Technical Documentation

## Architecture

### Authentication Modes

M-EDU supports two authentication methods:

1. **Local Authentication** — email/password stored in FlutterSecureStorage, Argon2id hashing
2. **Google Sign-In** — OAuth via google_sign_in plugin → Firebase Authentication

Both modes produce a common `AuthState` used by the router, RBAC, and session management.

### Google Sign-In Flow

```
User taps "Sign in with Google"
→ GoogleSignIn().signIn() [google_sign_in plugin]
→ GoogleSignInAccount.idToken [OAuth ID token]
→ FirebaseAuth.signInWithCredential(GoogleAuthProvider.credential)
→ FirebaseAuth.currentUser [Firebase user]
→ Lookup/create local M-EDU identity (email-based)
→ AuthController.setState(AuthStateAuthenticated)
→ Router guard → Dashboard
```

### Provider Structure

```
googleAuthProvider (Provider<GoogleAuthService>)          — service instance
googleAuthControllerProvider (StateNotifier<...>)         — UI state controller
googleAuthStateProvider (Provider<GoogleAuthUiState>)     — convenience reader

authControllerProvider (StateNotifier<AuthController>)    — unified auth state
  ├── login(email, password)          — local auth
  ├── loginWithBiometric()            — biometric
  └── loginWithGoogle(GoogleUser)     — google → local session
```

### GoogleAuthResult

```dart
sealed class GoogleAuthResult {
  GoogleAuthSuccess { email, displayName, photoUrl, idToken }
  GoogleAuthCancelled
  GoogleAuthError { message }
}
```

### Account Mapping

- **Firebase UID** → persistent identity across devices
- **Email** → primary key for local identity lookup
- **Role/RBAC** → stored locally in IdentityRecord, NOT from Firebase claims

### Security Rules

1. **Never log OAuth tokens, ID tokens, or refresh tokens**
2. **RBAC is enforced locally** — Google auth authenticates; local RBAC authorizes
3. **No self-role-elevation** — Firestore rules prevent users from modifying their own role
4. **Account linking** — Email collision handled via identity merge, not auto-link

### Offline Behavior

| State | Behavior |
|-------|----------|
| Online + fresh token | Full Google Sign-In → session creation |
| Online + expired token | Google plugin refreshes → session |
| Offline + existing session | Session restored from FlutterSecureStorage |
| Offline + no session | Login page shown, Google button disabled |
| Offline + Google button pressed | Network error displayed |

**IMPORTANT**: Google Sign-In REQUIRES internet for initial authentication. Offline mode only restores a previously established session.

### Platform Support

| Platform | google_sign_in | Firebase Auth | Status |
|----------|---------------|---------------|--------|
| Android | ✅ | ✅ | IMPLEMENTED |
| iOS | ✅ | ✅ | Not targeted |
| Windows | ⚠️ Limited | ✅ | google_sign_in desktop support varies |
| Web | ✅ | ✅ | Not targeted |

### Failure Matrix

| Scenario | Behavior | UI |
|----------|----------|-----|
| Successful login | Session created → Dashboard | Redirect |
| User cancels | GoogleAuthCancelled → idle | Button reset |
| No Google account | Error → device account picker | Snack bar |
| Network unavailable | Error with network message | Inline error |
| Firebase unavailable | Error with service message | Inline error |
| Revoked account | AuthStateError | Inline error |
| Unknown Google email | NotRegistered → admin instruction | Inline message |
| Disabled account | Disabled → admin instruction | Inline message |
| Existing local account | Email match → session merge | Redirect |

### External Dependencies

- `google_sign_in` Flutter plugin
- `firebase_auth` Flutter plugin
- Google OAuth Client ID (Android `strings.xml` or Firebase Console)
- Firebase project with Google Sign-In enabled
- SHA-1/SHA-256 certificate fingerprint in Firebase Console

### Configuration Required

1. **Firebase Console** → Authentication → Sign-in method → Enable Google
2. **Android** → `android/app/google-services.json` (from Firebase)
3. **Google Cloud Console** → OAuth 2.0 Client ID (Web type) if needed
4. **SHA fingerprint** → Firebase Console → Project Settings → Your Android app
