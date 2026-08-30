# blobs/ — TensorFlow Lite C natif kutubxonalari (desktop)

Bu katalog `tflite_flutter` (desktop) uchun zarur bo'lgan **TensorFlow Lite C API**
dinamik kutubxonalarini saqlash uchun. `tflite_flutter 0.12.1` ularni ishga
tushiriladigan fayl yonidagi `blobs/` papkasidan izlaydi:

| Platforma | Fayl | Izlanish yo'li (bindings.dart) |
|---|---|---|
| Linux | `libtensorflowlite_c-linux.so` | `<exe>/blobs/libtensorflowlite_c-linux.so` |
| Windows | `libtensorflowlite_c-win.dll` | `<exe>/blobs/libtensorflowlite_c-win.dll` |

Bu fayllar **git'ga kiritilmaydi** (`.gitignore` da). Har bir qurilmada
`scripts/setup_tflite_native.sh` orqali tayyorlanadi yoki qo'lda ko'chiriladi.

## Linux

```bash
scripts/setup_tflite_native.sh linux
```

Skript TensorFlow v2.15.0 manbasini yuklab, TFLite C API'ni CMake orqali
quradi va natijani shu yerga `libtensorflowlite_c-linux.so` sifatida qo'yadi.

## Windows

Windows'da qurish Windows mashinasida bajariladi:

```bash
scripts/setup_tflite_native.sh windows
```

(Windows'da PowerShell/CMake + Visual Studio Build Tools talab qilinadi;
yoki `libtensorflowlite_c-win.dll` ni qo'lda shu yerga ko'chiring.)

## Tekshirish

```bash
scripts/setup_tflite_native.sh check
```

`check` rejimi fayl borligini va hajmini ko'rsatadi.

---

**Eslatma:** C-02 (P0) tuzatishining bir qismi — fayl bo'lmasa desktop'da
face recognition jim ishlamaydi (tflite_flutter `DynamicLibrary.open` xato
tashlaydi). `linux/CMakeLists.txt` va `windows/CMakeLists.txt` fayllarga
install qoidalari qo'shilgan — build paytida bu fayllarni `bundle/blobs/`
papkasiga avtomatik ko'chiradi.
