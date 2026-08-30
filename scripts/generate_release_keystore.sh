#!/usr/bin/env bash
# ============================================================
# M-EDU — Release signing keystore yaratish (spec §50, AUDIT P1-06)
# ------------------------------------------------------------
# Ishlatish:
#   bash scripts/generate_release_keystore.sh          # interaktiv
#   KEYSTORE_PASSWORD='...' bash scripts/generate_release_keystore.sh
#
# NATIJA:
#   android/key.properties           (gitignore'da — maxfiy)
#   android/app/upload-keystore.jks  (gitignore'da — maxfiy)
#
# DIQQAT:
#   • Bu kalit Play Store'da ABADIY — yo'qotilsa yangilab bo'lmaydi.
#     Nusxasini xavfsiz joyda (yopiq ombor/parol menejer) saqlang!
#   • key.properties va .jks hech qachon git'ga kirmasligi shart
#     (.gitignore allaqachon qamrab olgan).
#   • Agar Play Store uchun allaqachon kalitingiz bo'lsa — buni
#     ishlatmang, o'z kalitingizni qo'ying.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

KEYSTORE_DIR="android/app"
KEYSTORE_FILE="$KEYSTORE_DIR/upload-keystore.jks"
PROPS_FILE="android/key.properties"
ALIAS="upload"

if [ -f "$PROPS_FILE" ]; then
  echo "✓ key.properties allaqachon bor — hech narsa qilinmadi."
  exit 0
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "✗ keytool topilmadi. Java / Android Studio JDK kerak." >&2
  exit 1
fi

KEY_PASSWORD="${KEYSTORE_PASSWORD:-}"
if [ -z "$KEY_PASSWORD" ]; then
  read -rsp "Keystore paroli (kamida 8 belgi): " KEY_PASSWORD; echo
fi
[ "${#KEY_PASSWORD}" -ge 8 ] || { echo "✗ Parol kamida 8 belgi bo'lishi kerak" >&2; exit 1; }

mkdir -p "$KEYSTORE_DIR"

keytool -genkeypair -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$KEY_PASSWORD" -keypass "$KEY_PASSWORD" \
  -dname "CN=M-Edu, OU=Medu, O=M-Edu, L=Tashkent, C=UZ" \
  -noprompt

cat > "$PROPS_FILE" <<EOF
storePassword=$KEY_PASSWORD
keyPassword=$KEY_PASSWORD
keyAlias=$ALIAS
storeFile=$KEYSTORE_FILE
EOF

chmod 600 "$PROPS_FILE" "$KEYSTORE_FILE"
echo "✓ Yaratildi: $PROPS_FILE + $KEYSTORE_FILE (ikkalasi ham git'ga kirmaydi)"
echo "⚠️  Keystore nusxasini xavfsiz saqlang — yo'qolsa tiklab bo'lmaydi!"
echo "Tekshirish: flutter build apk --release"
