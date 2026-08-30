#pragma once

#include <flutter/method_channel.h>
#include <flutter/plugin_registrar_windows.h>
#include <flutter/standard_method_codec.h>
#include <memory>
#include <mutex>
#include <vector>
#include <string>
#include <cstdint>

// Media Foundation headers
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mferror.h>

namespace medu {

/// Windows webcam handler using Media Foundation API.
///
/// Handles MethodChannel calls from Dart to:
///   - enumerate cameras (MFEnumDeviceSources)
///   - open camera (IMFMediaSource → IMFSinkWriter)
///   - capture JPEG frame (SinkWriter → MFConvertSampleToJPEG)
///   - close/pause/resume
///
/// Thread safety: all public methods are safe to call from the
/// Flutter platform thread.
class WebcamHandler {
 public:
  WebcamHandler();
  ~WebcamHandler();

  // Non-copyable, non-movable
  WebcamHandler(const WebcamHandler&) = delete;
  WebcamHandler& operator=(const WebcamHandler&) = delete;

  /// Initialize COM and Media Foundation (call once at startup).
  bool Initialize();

  /// Handle a MethodChannel call from Dart.
  void HandleMethodCall(
      const flutter::MethodCall<flutter::EncodableValue>& method_call,
      std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result);

 private:
  /// Enumerate available camera devices.
  void HandleEnumerate(
      std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result);

  /// Open a camera device by index.
  void HandleOpen(const flutter::EncodableMap& args,
                  std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result);

  /// Capture a single JPEG frame.
  void HandleCapture(
      std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result);

  /// Close the camera and release resources.
  void HandleClose(
      std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result);

  /// Pause the camera stream.
  void HandlePause(
      std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result);

  /// Resume the camera stream.
  void HandleResume(
      std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result);

  /// Convert a BGRA MF sample to JPEG bytes.
  bool ConvertToJpeg(IMFSample* sample, std::vector<uint8_t>& jpeg_out,
                     int& width_out, int& height_out);

  /// Release all camera resources.
  void ReleaseCamera();

  bool initialized_ = false;
  bool camera_open_ = false;
  bool paused_ = false;

  IMFMediaSource* media_source_ = nullptr;
  IMFSourceReader* source_reader_ = nullptr;
  IMFSinkWriter* sink_writer_ = nullptr;
  IMFMediaEventGenerator* event_generator_ = nullptr;

  int selected_device_index_ = -1;
  int frame_width_ = 0;
  int frame_height_ = 0;
  int frame_fps_ = 0;

  std::mutex mutex_;
};

}  // namespace medu
