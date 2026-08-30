#!/usr/bin/env bash
#
# setup_tflite_native.sh — Desktop TFLite C natif kutubxonasini tayyorlash
# (C-02 / P0 tuzatish).
#
# Foydalanish:
#   scripts/setup_tflite_native.sh linux      # Linux uchun .so qurish
#   scripts/setup_tflite_native.sh windows    # Windows uchun ko'rsatma
#   scripts/setup_tflite_native.sh check      # Holatni tekshirish
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLOBS="$ROOT/blobs"
TF_VERSION="v2.15.0"
WORK="/tmp/tflite_build"

mkdir -p "$BLOBS"

usage() {
  sed -n '2,12p' "${BASH_SOURCE[0]}"
  exit 0
}

check() {
  echo "=== blobs holati ==="
  for f in libtensorflowlite_c-linux.so libtensorflowlite_c-win.dll; do
    if [ -f "$BLOBS/$f" ]; then
      echo "  OK   $f  ($(du -h "$BLOBS/$f" | cut -f1))"
    else
      echo "  YO'Q $f"
    fi
  done
}

build_linux() {
  if [ -f "$BLOBS/libtensorflowlite_c-linux.so" ]; then
    echo "libtensorflowlite_c-linux.so allaqachon mavjud. Qayta qurish? (Ctrl+C bilan bekor qiling yoki faylni o'chiring)"
    check
    exit 0
  fi
  command -v cmake >/dev/null || { echo "cmake topilmadi"; exit 1; }
  command -v git  >/dev/null || { echo "git topilmadi"; exit 1; }

  mkdir -p "$WORK"
  cd "$WORK"
  if [ ! -d tf/.git ]; then
    echo "TensorFlow $TF_VERSION yuklanmoqda..."
    git clone --depth 1 --branch "$TF_VERSION" \
      https://github.com/tensorflow/tensorflow.git tf
  fi
  echo "CMake konfiguratsiyasi (tensorflow/lite/c)..."
  cmake -S tf/tensorflow/lite/c -B build -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DTFLITE_C_BUILD_SHARED_LIBS=ON >/dev/null
  echo "Qurilmoqda (tensorflowlite_c)..."
  cmake --build build --target tensorflowlite_c -j"$(nproc)"
  local so
  so="$(find build -name 'libtensorflowlite_c*.so' | head -1)"
  if [ -z "$so" ]; then
    echo "XATOLIK: libtensorflowlite_c.so topilmadi (build.log ga qarang: $WORK/build.log)"
    exit 1
  fi
  cp "$so" "$BLOBS/libtensorflowlite_c-linux.so"
  echo "Bajarildi: $BLOBS/libtensorflowlite_c-linux.so"
}

case "${1:-}" in
  linux)  build_linux ;;
  windows)
    echo "Windows: iltimos Windows mashinasida quyidagilarni bajaring:"
    echo "  1) Visual Studio Build Tools + CMake + Git o'rnating"
    echo "  2) git clone --depth 1 --branch v2.15.0 https://github.com/tensorflow/tensorflow.git tf"
    echo "  3) cmake -S tf/tensorflow/lite/c -B build -G 'Visual Studio 17 2022' -DTFLITE_C_BUILD_SHARED_LIBS=ON"
    echo "  4) cmake --build build --config Release --target tensorflowlite_c"
    echo "  5) tflite.dll (yoki libtensorflowlite_c*.dll) ni shu yerga libtensorflowlite_c-win.dll nomi bilan ko'chiring"
    ;;
  check)  check ;;
  *)      usage ;;
esac
