#!/bin/bash
# Capture evidence for a QA step: screenshot + UI dump + recent flutter logcat.
# Usage: tool/capture.sh <step_name>
export PATH="$PATH:$HOME/android-sdk/platform-tools"
set -e
STEP="${1:?usage: capture.sh <step_name>}"
OUT="m_edu/docs/live_qa"
mkdir -p "$OUT/shots" "$OUT/dumps"
adb exec-out screencap -p > "$OUT/shots/${STEP}.png"
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
adb pull /sdcard/ui.xml "$OUT/dumps/${STEP}.xml" >/dev/null 2>&1 || true
adb logcat -d -t 300 2>/dev/null | grep -E " I flutter |I/flutter|FATAL|AndroidRuntime|E/flutter" > "$OUT/logs_${STEP}.txt" 2>/dev/null || true
echo "captured $OUT/shots/${STEP}.png + dump + log"
