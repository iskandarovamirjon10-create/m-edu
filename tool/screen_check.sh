#!/bin/bash
# Ekran tekshiruvi yordamchisi:
#   1. berilgan koordinataga tap qiladi
#   2. screenshot oladi (screenshots/NN_nomi.png)
#   3. Flutter widget daraxtini chiqaradi (VM service orqali)
#   4. logcat'dan Flutter xatolarini va sahifa markerlarini ko'rsatadi
#
# Foydalanish: bash tool/screen_check.sh <x> <y> <rasm_nomi>
set -u

ADB=/home/Amirjon/android-sdk/platform-tools/adb
DART=/home/Amirjon/flutter/bin/dart
PROJ=/home/Amirjon/m_edu
X="${1:-}"
Y="${2:-}"
NAME="${3:-screen}"
TAP_MSG=""

if [ -n "$X" ] && [ -n "$Y" ]; then
  "$ADB" shell input tap "$X" "$Y"
  sleep 2
  TAP_MSG="tap($X,$Y)"
fi

mkdir -p "$PROJ/screenshots"
"$ADB" exec-out screencap -p > "$PROJ/screenshots/$NAME.png" 2>/dev/null

# VM service URL'ni logcat'dan olamiz (dump chiqishi uchun).
URL=$("$ADB" logcat -d -s flutter 2>/dev/null | grep -oE 'http://127.0.0.1:[0-9]+/[^/]+' | head -1)
if [ -n "$URL" ]; then
  PORT=$(echo "$URL" | sed -E 's#http://127.0.0.1:([0-9]+)/.*#\1#')
  TOKEN=$(echo "$URL" | sed -E 's#http://127.0.0.1:[0-9]+/([^/]+)/?.*#\1#')
  "$ADB" forward tcp:"$PORT" tcp:"$PORT" >/dev/null 2>&1
  "$DART" "$PROJ/tool/vm_dump.dart" "ws://127.0.0.1:$PORT/$TOKEN/ws" \
    ext.flutter.debugDumpApp >/dev/null 2>&1
  sleep 2
fi

echo "=== [$NAME] ${TAP_MSG} ==="
echo "--- Flutter xatolari ---"
"$ADB" logcat -d 2>/dev/null | grep -iE 'Another exception|overflowed|RenderFlex.*overflow|E/flutter|Unhandled exception|EXCEPTION CAUGHT' | head -8
echo "--- Sahifa markerlari ---"
"$ADB" logcat -d 2>/dev/null | grep -oE '(DashboardPage|LoginPage|RegisterPage|StudentsListPage|StudentDetailPage|AttendancePage|SchedulePage|FinancePage|SettingsPage|DebtsListPage|PaymentsListPage|NewPaymentPage|NewExpensePage|FaceScanPage|FaceEnrollPage|IdentityListPage|IdentityDetailPage|RegisterIdentityPage|IdentityScanPage|TeachersListPage|GroupsListPage|GroupDetailPage|CreateGroupPage|AddStudentsToGroupPage|RoomsListPage|ReportsPage|StudentStatsPage|MonthlyAttendanceReportPage|DebtReportPage|RevenueReportPage|NotificationsPage)' | sort | uniq -c
echo ""
