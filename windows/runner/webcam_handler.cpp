#include "webcam_handler.h"

#include <flutter/encodable_value.h>
#include <flutter/method_result.h>

#include <comdef.h>
#include <wrl/client.h>
#include <wincodec.h>

#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mf.lib")
#pragma comment(lib, "mfreadwrite.lib")
#pragma comment(lib, "mfuuid.lib")
#pragma comment(lib, "ole32.lib")

using Microsoft::WRL::ComPtr;

namespace medu {

WebcamHandler::WebcamHandler() = default;

WebcamHandler::~WebcamHandler() {
  ReleaseCamera();
  if (initialized_) {
    MFShutdown();
    CoUninitialize();
  }
}

bool WebcamHandler::Initialize() {
  if (initialized_) return true;

  HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
  if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) return false;

  hr = MFStartup(MF_VERSION);
  if (FAILED(hr)) return false;

  initialized_ = true;
  return true;
}

void WebcamHandler::HandleMethodCall(
    const flutter::MethodCall<flutter::EncodableValue>& method_call,
    std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {

  const auto& method_name = method_call.method_name();

  if (method_name == "enumerate") {
    HandleEnumerate(std::move(result));
  } else if (method_name == "open") {
    const auto* args = std::get_if<flutter::EncodableMap>(method_call.arguments());
    if (!args) {
      result->Error("INVALID_ARGS", "Expected map arguments");
      return;
    }
    HandleOpen(*args, std::move(result));
  } else if (method_name == "capture") {
    HandleCapture(std::move(result));
  } else if (method_name == "close") {
    HandleClose(std::move(result));
  } else if (method_name == "pause") {
    HandlePause(std::move(result));
  } else if (method_name == "resume") {
    HandleResume(std::move(result));
  } else {
    result->NotImplemented();
  }
}

void WebcamHandler::HandleEnumerate(
    std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {

  std::lock_guard<std::mutex> lock(mutex_);

  if (!initialized_) {
    result->Error("NOT_INITIALIZED", "Media Foundation not initialized");
    return;
  }

  flutter::EncodableList cameras;

  // Enumerate video input devices using Media Foundation
  IMFAttributes* pAttributes = nullptr;
  HRESULT hr = MFCreateAttributes(&pAttributes, 1);
  if (FAILED(hr)) {
    result->Success(flutter::EncodableValue(cameras));
    return;
  }

  hr = pAttributes->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE,
                            MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID);
  if (FAILED(hr)) {
    pAttributes->Release();
    result->Success(flutter::EncodableValue(cameras));
    return;
  }

  IMFActivate** ppDevices = nullptr;
  UINT32 count = 0;
  hr = MFEnumDeviceSources(pAttributes, &ppDevices, &count);
  pAttributes->Release();

  if (FAILED(hr) || count == 0) {
    result->Success(flutter::EncodableValue(cameras));
    return;
  }

  for (UINT32 i = 0; i < count; i++) {
    flutter::EncodableMap device;

    // Get device friendly name
    WCHAR* friendlyName = nullptr;
    UINT32 nameLen = 0;
    hr = ppDevices[i]->GetAllocatedString(
        MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME, &friendlyName, &nameLen);
    if (SUCCEEDED(hr) && friendlyName) {
      // Convert wide string to UTF-8
      int utf8Len = WideCharToMultiByte(CP_UTF8, 0, friendlyName, -1, nullptr, 0, nullptr, nullptr);
      std::string utf8Name(utf8Len - 1, 0);
      WideCharToMultiByte(CP_UTF8, 0, friendlyName, -1, &utf8Name[0], utf8Len, nullptr, nullptr);
      device[flutter::EncodableValue("name")] = flutter::EncodableValue(utf8Name);
      CoTaskMemFree(friendlyName);
    } else {
      device[flutter::EncodableValue("name")] = flutter::EncodableValue("Unknown Camera");
    }

    device[flutter::EncodableValue("index")] = flutter::EncodableValue(static_cast<int64_t>(i));
    device[flutter::EncodableValue("width")] = flutter::EncodableValue(static_cast<int64_t>(1920));
    device[flutter::EncodableValue("height")] = flutter::EncodableValue(static_cast<int64_t>(1080));

    cameras.push_back(flutter::EncodableValue(device));
    ppDevices[i]->Release();
  }

  CoTaskMemFree(ppDevices);
  result->Success(flutter::EncodableValue(cameras));
}

void WebcamHandler::HandleOpen(
    const flutter::EncodableMap& args,
    std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {

  std::lock_guard<std::mutex> lock(mutex_);

  if (!initialized_) {
    result->Error("NOT_INITIALIZED", "Media Foundation not initialized");
    return;
  }

  // Close any previously open camera
  ReleaseCamera();

  // Get device index
  int deviceIndex = 0;
  auto it = args.find(flutter::EncodableValue("deviceIndex"));
  if (it != args.end()) {
    deviceIndex = static_cast<int>(std::get<int64_t>(it->second));
  }

  // Enumerate devices to find the requested one
  IMFAttributes* pAttributes = nullptr;
  HRESULT hr = MFCreateAttributes(&pAttributes, 1);
  if (FAILED(hr)) {
    result->Error("CREATE_FAILED", "Failed to create attributes");
    return;
  }

  hr = pAttributes->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE,
                            MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID);
  if (FAILED(hr)) {
    pAttributes->Release();
    result->Error("SET_TYPE_FAILED", "Failed to set source type");
    return;
  }

  IMFActivate** ppDevices = nullptr;
  UINT32 count = 0;
  hr = MFEnumDeviceSources(pAttributes, &ppDevices, &count);
  pAttributes->Release();

  if (FAILED(hr) || count == 0) {
    result->Error("NO_DEVICES", "No camera devices found");
    return;
  }

  if (deviceIndex < 0 || static_cast<UINT32>(deviceIndex) >= count) {
    CoTaskMemFree(ppDevices);
    result->Error("INVALID_INDEX", "Camera index out of range");
    return;
  }

  // Create media source from the selected device
  hr = ppDevices[deviceIndex]->ActivateObject(IID_PPV_ARGS(&media_source_));
  for (UINT32 i = 0; i < count; i++) {
    ppDevices[i]->Release();
  }
  CoTaskMemFree(ppDevices);

  if (FAILED(hr) || !media_source_) {
    result->Error("ACTIVATE_FAILED", "Failed to activate camera device");
    return;
  }

  selected_device_index_ = deviceIndex;
  frame_width_ = 1280;
  frame_height_ = 720;
  frame_fps_ = 30;

  // Try to get native resolution from the source descriptor
  IMFPresentationDescriptor* pPD = nullptr;
  hr = media_source_->CreatePresentationDescriptor(&pPD);
  if (SUCCEEDED(hr) && pPD) {
    DWORD dwStreams = 0;
    hr = pPD->GetStreamDescriptorCount(&dwStreams);
    if (SUCCEEDED(hr) && dwStreams > 0) {
      IMFStreamDescriptor* pSD = nullptr;
      BOOL fSelected = FALSE;
      hr = pPD->GetStreamDescriptorByIndex(0, &fSelected, &pSD);
      if (SUCCEEDED(hr) && pSD) {
        IMFMediaTypeHandler* pHandler = nullptr;
        hr = pSD->GetMediaTypeHandler(&pHandler);
        if (SUCCEEDED(hr) && pHandler) {
          DWORD dwTypes = 0;
          pHandler->GetMediaTypeCount(&dwTypes);
          if (dwTypes > 0) {
            IMFMediaType* pType = nullptr;
            hr = pHandler->GetMediaTypeByIndex(0, &pType);
            if (SUCCEEDED(hr) && pType) {
              MFGetAttributeSize(pType, MF_MT_FRAME_SIZE,
                                (UINT32*)&frame_width_, (UINT32*)&frame_height_);
              MFGetAttributeRatio(pType, MF_MT_FRAME_RATE,
                                 (UINT32*)&frame_fps_, nullptr);
              pType->Release();
            }
          }
          pHandler->Release();
        }
        pSD->Release();
      }
    }
    pPD->Release();
  }

  // Start the media source
  hr = media_source_->Start(nullptr, nullptr, nullptr);
  if (FAILED(hr)) {
    ReleaseCamera();
    result->Error("START_FAILED", "Failed to start camera capture");
    return;
  }

  // Create and configure the source reader once (reused across captures).
  hr = MFCreateSourceReaderFromMediaSource(media_source_, nullptr, &source_reader_);
  if (FAILED(hr) || !source_reader_) {
    ReleaseCamera();
    result->Error("READER_FAILED", "Failed to create source reader");
    return;
  }

  // Set output format to MJPEG — done once here, not per-capture.
  {
    ComPtr<IMFMediaType> pType;
    MFCreateMediaType(&pType);
    pType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
    pType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_MJPG);
    pType->SetUINT32(MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive);
    hr = source_reader_->SetCurrentMediaType(
        static_cast<DWORD>(MF_SOURCE_READER_FIRST_VIDEO_STREAM),
        nullptr, pType.Get());
    if (FAILED(hr)) {
      ReleaseCamera();
      result->Error("FORMAT_FAILED", "Failed to set MJPEG output format");
      return;
    }
  }

  camera_open_ = true;

  flutter::EncodableMap info;
  info[flutter::EncodableValue("width")] = flutter::EncodableValue(static_cast<int64_t>(frame_width_));
  info[flutter::EncodableValue("height")] = flutter::EncodableValue(static_cast<int64_t>(frame_height_));
  info[flutter::EncodableValue("fps")] = flutter::EncodableValue(static_cast<int64_t>(frame_fps_));

  result->Success(flutter::EncodableValue(info));
}

void WebcamHandler::HandleCapture(
    std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {

  std::lock_guard<std::mutex> lock(mutex_);

  if (!camera_open_ || !media_source_ || !source_reader_ || paused_) {
    result->Error("NOT_OPEN", "Camera is not open or is paused");
    return;
  }

  // Read a sample using the cached source reader (created in HandleOpen).
  IMFSample* pSample = nullptr;
  DWORD dwFlags = 0;
  HRESULT hr = source_reader_->ReadSample(
      static_cast<DWORD>(MF_SOURCE_READER_FIRST_VIDEO_STREAM),
      0, nullptr, &dwFlags, nullptr, &pSample);

  if (FAILED(hr) || !pSample) {
    result->Error("CAPTURE_FAILED", "Failed to capture frame");
    return;
  }

  // Convert to JPEG and get dimensions
  std::vector<uint8_t> jpegData;
  int width = frame_width_;
  int height = frame_height_;
  bool ok = ConvertToJpeg(pSample, jpegData, width, height);
  pSample->Release();

  if (!ok || jpegData.empty()) {
    result->Error("CONVERSION_FAILED", "Failed to convert frame to JPEG");
    return;
  }

  // Build result map
  flutter::EncodableMap frame;
  frame[flutter::EncodableValue("jpegBytes")] =
      flutter::EncodableValue(std::vector<uint8_t>(jpegData));
  frame[flutter::EncodableValue("width")] =
      flutter::EncodableValue(static_cast<int64_t>(width));
  frame[flutter::EncodableValue("height")] =
      flutter::EncodableValue(static_cast<int64_t>(height));
  frame[flutter::EncodableValue("rotation")] =
      flutter::EncodableValue(static_cast<int64_t>(0));

  result->Success(flutter::EncodableValue(frame));
}

void WebcamHandler::HandleClose(
    std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {
  std::lock_guard<std::mutex> lock(mutex_);
  ReleaseCamera();
  result->Success(nullptr);
}

void WebcamHandler::HandlePause(
    std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {
  std::lock_guard<std::mutex> lock(mutex_);
  paused_ = true;
  result->Success(nullptr);
}

void WebcamHandler::HandleResume(
    std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {
  std::lock_guard<std::mutex> lock(mutex_);
  paused_ = false;
  result->Success(nullptr);
}

bool WebcamHandler::ConvertToJpeg(IMFSample* sample, std::vector<uint8_t>& jpeg_out,
                                    int& width_out, int& height_out) {
  if (!sample) return false;

  // Get the buffer from the sample
  IMFMediaBuffer* pBuffer = nullptr;
  HRESULT hr = sample->ConvertToContiguousBuffer(&pBuffer);
  if (FAILED(hr) || !pBuffer) return false;

  DWORD maxLength = 0;
  DWORD currentLength = 0;
  BYTE* pData = nullptr;
  hr = pBuffer->Lock(&pData, &maxLength, &currentLength);
  if (FAILED(hr)) {
    pBuffer->Release();
    return false;
  }

  // The sample may already be in JPEG format if the camera supports MJPEG
  // If so, just copy the data directly
  jpeg_out.assign(pData, pData + currentLength);

  pBuffer->Unlock();
  pBuffer->Release();

  // Try to read dimensions from JPEG header
  if (jpeg_out.size() > 10) {
    // Simple JPEG dimension reader
    size_t i = 2;
    while (i < jpeg_out.size() - 8) {
      if (jpeg_out[i] != 0xFF) { i++; continue; }
      uint8_t marker = jpeg_out[i + 1];
      if (marker == 0xC0 || marker == 0xC2) {
        height_out = static_cast<int>((jpeg_out[i + 5] << 8) | jpeg_out[i + 6]);
        width_out = static_cast<int>((jpeg_out[i + 7] << 8) | jpeg_out[i + 8]);
        return true;
      }
      uint16_t segLen = static_cast<uint16_t>((jpeg_out[i + 2] << 8) | jpeg_out[i + 3]);
      i += 2 + static_cast<size_t>(segLen);
    }
  }

  // Fallback to known dimensions
  width_out = frame_width_;
  height_out = frame_height_;
  return !jpeg_out.empty();
}

void WebcamHandler::ReleaseCamera() {
  if (source_reader_) {
    source_reader_->Release();
    source_reader_ = nullptr;
  }
  if (media_source_) {
    media_source_->Stop();
    media_source_->Release();
    media_source_ = nullptr;
  }
  if (sink_writer_) {
    sink_writer_->Release();
    sink_writer_ = nullptr;
  }
  camera_open_ = false;
  paused_ = false;
  selected_device_index_ = -1;
}

}  // namespace medu
