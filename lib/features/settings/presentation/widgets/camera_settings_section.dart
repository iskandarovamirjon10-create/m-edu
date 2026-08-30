import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_card.dart';
import '../../../face_recognition/infrastructure/services/camera_stream_service.dart';
import '../../../face_recognition/infrastructure/services/hikvision_camera_config.dart';
import '../../../face_recognition/presentation/providers/face_recognition_providers.dart';
import '../../domain/entities/app_settings.dart';
import '../providers/settings_providers.dart';

/// Hikvision kamera sozlamalari (Face ID uchun) bo'limi.
///
/// Phase 4 refactor: settings_page.dart dan ajratib chiqarilgan mustaqil
/// widget. Business logic o'zgarmagan — provider/command orqali.
class CameraSettingsSection extends ConsumerStatefulWidget {
  final AppSettings settings;

  const CameraSettingsSection({super.key, required this.settings});

  @override
  ConsumerState<CameraSettingsSection> createState() =>
      CameraSettingsSectionState();
}

class CameraSettingsSectionState
    extends ConsumerState<CameraSettingsSection> {
  late final TextEditingController _ipController;
  late final TextEditingController _portController;
  late final TextEditingController _userController;
  late final TextEditingController _passController;
  late final TextEditingController _channelController;
  late final TextEditingController _pathController;
  late final TextEditingController _intervalController;

  late bool _enabled;
  late bool _autoMark;
  late double _matchThreshold;
  late double _ambiguousThreshold;
  bool _saving = false;
  bool _testing = false;

  @override
  void initState() {
    super.initState();
    final s = widget.settings;
    _ipController = TextEditingController(text: s.hikvisionIp ?? '');
    _portController = TextEditingController(text: '${s.hikvisionPort}');
    _userController = TextEditingController(text: s.hikvisionUsername ?? '');
    _passController = TextEditingController(text: s.hikvisionPassword ?? '');
    _channelController = TextEditingController(text: '${s.hikvisionChannel}');
    _pathController =
        TextEditingController(text: s.hikvisionRtspPath ?? '');
    _intervalController =
        TextEditingController(text: '${s.scanIntervalMs}');
    _enabled = s.hikvisionEnabled;
    _autoMark = s.autoMarkAttendance;
    _matchThreshold = s.matchThreshold;
    _ambiguousThreshold = s.ambiguousThreshold;
  }

  @override
  void dispose() {
    _ipController.dispose();
    _portController.dispose();
    _userController.dispose();
    _passController.dispose();
    _channelController.dispose();
    _pathController.dispose();
    _intervalController.dispose();
    super.dispose();
  }

  HikvisionCameraConfig get _tempConfig => HikvisionCameraConfig(
        ip: _ipController.text.trim(),
        port: int.tryParse(_portController.text) ?? 554,
        username: _userController.text.trim().isEmpty
            ? 'admin'
            : _userController.text.trim(),
        password: _passController.text,
        channel: int.tryParse(_channelController.text) ?? 1,
        rtspPath: _pathController.text.trim().isEmpty
            ? null
            : _pathController.text.trim(),
      );

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final updated = widget.settings.copyWith(
        hikvisionEnabled: _enabled,
        hikvisionIp: _ipController.text.trim(),
        hikvisionPort: int.tryParse(_portController.text) ?? 554,
        hikvisionUsername: _userController.text.trim(),
        hikvisionPassword: _passController.text,
        hikvisionChannel: int.tryParse(_channelController.text) ?? 1,
        hikvisionRtspPath: _pathController.text.trim().isEmpty
            ? null
            : _pathController.text.trim(),
        autoMarkAttendance: _autoMark,
        scanIntervalMs: int.tryParse(_intervalController.text) ?? 1200,
        matchThreshold: _matchThreshold,
        ambiguousThreshold: _ambiguousThreshold,
      );
      await ref.read(updateSettingsCommandProvider).execute(updated);
      ref.invalidate(appSettingsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Kamera sozlamalari saqlandi'),
          backgroundColor: context.dsColors.success,
        ),
      );
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _testConnection() async {
    setState(() => _testing = true);
    final config = _tempConfig;
    var bytes = await ref
        .read(snapshotServiceProvider)
        .fetchSnapshot(config);

    // Hikvision bo'lmagan kameralar ISAPI snapshot qo'llab-quvvatlamaydi —
    // RTSP oqim orqali ham sinab ko'ramiz.
    var viaRtsp = false;
    if (bytes == null) {
      final frame = await _tryRtspFrame(config);
      bytes = frame;
      viaRtsp = frame != null;
    }
    if (!mounted) return;
    setState(() => _testing = false);

    if (bytes == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Ulanish muvaffaqiyatsiz — IP/login/parolni tekshiring yoki '
            '"Qidirish" tugmasi bilan kamerani avtomatik toping',
          ),
          backgroundColor: context.dsColors.error,
        ),
      );
      return;
    }

    // Muvaffaqiyatli ulanish — kameradan olingan jonli tasvir ko'rsatiladi.
    // Oddiy foydalanuvchi shu yerda "mana mening kameram" deb tekshiradi.
    // (Closure ichida ishlatilgani uchun null-promotion ishlamaydi —
    // non-null o'zgaruvchiga ko'chiramiz.)
    final Uint8List frameBytes = bytes;
    final ip = config.ip;
    final save = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.check_circle, color: context.dsColors.success),
            SizedBox(width: 8),
            Expanded(child: Text('Kamera ulandi ✓')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.memory(frameBytes, height: 180, fit: BoxFit.cover),
            ),
            const SizedBox(height: 12),
            Text(
              '$ip dan jonli tasvir qabul qilinmoqda '
              '(${viaRtsp ? 'RTSP oqim' : 'ISAPI snapshot'}). '
              'Bu kamerangizmi? Saqlash tugmasini bosing.',
              style: TextStyle(fontSize: 13, height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Bekor qilish'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Saqlash'),
          ),
        ],
      ),
    );
    if (save == true && mounted) {
      await _save();
    }
  }

  /// RTSP oqim orqali kameradan kadr olishga urinadi (Hikvision bo'lmagan
  /// kameralar uchun — ular ISAPI snapshot qo'llab-quvvatlamaydi).
  ///
  /// media_kit player'ini vaqtincha ochib, screenshot oladi va yopadi.
  /// Muvaffaqiyatsiz bo'lsa null qaytaradi.
  Future<Uint8List?> _tryRtspFrame(HikvisionCameraConfig config) async {
    CameraStreamService.ensureInitialized();
    final service = CameraStreamService();
    try {
      await service.open(config.rtspUrl);
      // Oqim ochilishi uchun bir oz kutamiz.
      await Future<void>.delayed(const Duration(milliseconds: 1200));
      return await service.grabFrame();
    } catch (_) {
      return null;
    } finally {
      await service.dispose();
    }
  }

  /// Tarmoqdan kamerani avtomatik qidirish (oddiy foydalanuvchi uchun).
  Future<void> _discoverCamera() async {
    final ip = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const CameraDiscoverySheet(),
    );
    if (ip == null || !mounted) return;
    setState(() {
      _ipController.text = ip;
      if (_userController.text.trim().isEmpty) {
        _userController.text = 'admin';
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Kamera topildi: $ip — parolni kiriting va "Test" tugmasini bosing',
        ),
        backgroundColor: context.dsColors.success,
      ),
    );
  }

  Widget _buildThresholdSlider({
    required String label,
    required double value,
    required double min,
    required ValueChanged<double> onChanged,
  }) {
    return Row(
      children: [
        Expanded(
          flex: 2,
          child: Text(
            label,
            style: TextStyle(fontSize: 13, color: context.dsColors.textPrimary),
          ),
        ),
        Expanded(
          flex: 3,
          child: Slider(
            value: value.clamp(min, 1.0),
            min: min,
            max: 1.0,
            divisions: 40,
            label: value.toStringAsFixed(2),
            onChanged: onChanged,
          ),
        ),
        SizedBox(
          width: 44,
          child: Text(
            value.toStringAsFixed(2),
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: context.dsColors.accent,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        children: [
          SwitchListTile(
            title: const Text('Kamera ulangan'),
            subtitle: const Text('Face ID orqali yuzni tanishni yoqish'),
            value: _enabled,
            onChanged: (value) => setState(() => _enabled = value),
          ),
          // Sozlamalar maydonlari DOIM ko'rinadi — ilgari "Kamera ulangan"
          // o'chirilganida butun bo'lim yashirin edi va admin buni
          // "Settings ishlamayapti" deb tushunar edi.
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // IP manzil + avtomatik qidirish (oddiy foydalanuvchi
                // kamera IP'sini bilmasa ham qo'sha oladi).
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _ipController,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(
                          labelText: 'Kamera IP manzili',
                          hintText: 'masalan: 192.168.1.64',
                          prefixIcon: Icon(Icons.lan_outlined),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      height: 56,
                      child: OutlinedButton.icon(
                        onPressed: _discoverCamera,
                        icon: const Icon(Icons.radar),
                        label: Text('Qidirish'),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 6),
                Text(
                  'IP manzilni bilmayapsizmi? "Qidirish" tugmasini bosing — '
                  'tarmoqdagi kameralar avtomatik topiladi.',
                  style: TextStyle(
                    fontSize: 12,
                    color: context.dsColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _userController,
                        decoration: const InputDecoration(
                          labelText: 'Login',
                          hintText: 'admin (odatda)',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: _passController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Parol',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                // Texnik maydonlar — oddiy foydalanuvchi bezovta
                // qilmasligi uchun "Qo'shimcha sozlamalar" ichida.
                Theme(
                  data: Theme.of(context)
                      .copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: const EdgeInsets.only(top: 8),
                    title: const Text(
                      "Qo'shimcha sozlamalar",
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _portController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'RTSP port',
                                prefixIcon: Icon(Icons.numbers),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              controller: _channelController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Kanal',
                                prefixIcon: Icon(Icons.tune),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _pathController,
                        textCapitalization: TextCapitalization.none,
                        decoration: const InputDecoration(
                          labelText: 'RTSP yo\'li (ixtiyoriy)',
                          hintText:
                              'Hikvision: /Streaming/Channels/101',
                          helperText:
                              "Boshqa brend: /onvif1, /stream1, /h264Preview_01_main…",
                          prefixIcon: Icon(Icons.route_outlined),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _intervalController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: "Skanlash oralig'i (ms)",
                          hintText: '1200',
                          prefixIcon: Icon(Icons.timer_outlined),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Avtomatik davomat'),
                        subtitle: const Text(
                          "Yuz tanilganda davomatni o'zi belgilaydi",
                        ),
                        value: _autoMark,
                        onChanged: (value) =>
                            setState(() => _autoMark = value),
                      ),
                      const SizedBox(height: 12),
                      _buildThresholdSlider(
                        label: 'Moslik chegarasi',
                        value: _matchThreshold,
                        min: 0.5,
                        onChanged: (v) => setState(() => _matchThreshold = v),
                      ),
                      _buildThresholdSlider(
                        label: 'Noaniq zona chegarasi',
                        value: _ambiguousThreshold,
                        min: 0.3,
                        onChanged: (v) =>
                            setState(() => _ambiguousThreshold = v),
                      ),
                      SizedBox(height: 4),
                      Text(
                        "Real kamera uchun: kam odam tanilmayapti — chegarani pastlatting; "
                        "noto'g'ri odam tanilayapti — ko'taring.",
                        style: TextStyle(
                          fontSize: 11,
                          color: context.dsColors.textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _testing ? null : _testConnection,
                        icon: _testing
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.wifi_tethering),
                        label: Text(_testing ? 'Tekshirilmoqda…' : 'Test'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _saving ? null : _save,
                        icon: const Icon(Icons.save_outlined),
                        label: Text(_saving ? 'Saqlanmoqda…' : 'Saqlash'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class CameraDiscoverySheet extends ConsumerStatefulWidget {
  const CameraDiscoverySheet({super.key});

  @override
  ConsumerState<CameraDiscoverySheet> createState() =>
      CameraDiscoverySheetState();
}

class CameraDiscoverySheetState
    extends ConsumerState<CameraDiscoverySheet> {
  List<String> _found = const [];
  int _checked = 0;
  int _total = 0;
  bool _scanning = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _scan();
  }

  Future<void> _scan() async {
    setState(() {
      _scanning = true;
      _error = false;
      _found = const [];
      _checked = 0;
      _total = 0;
    });
    try {
      final results =
          await ref.read(cameraDiscoveryServiceProvider).discover(
                onProgress: (checked, total) {
                  if (!mounted) return;
                  setState(() {
                    _checked = checked;
                    _total = total;
                  });
                },
              );
      if (!mounted) return;
      setState(() {
        _found = results;
        _scanning = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = true;
        _scanning = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final surface =
        Theme.of(context).colorScheme.surface;
    return Container(
      height: MediaQuery.of(context).size.height * 0.72,
      decoration: BoxDecoration(
        color: surface,
        borderRadius:
            const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: context.dsColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Kamerani qidirish',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: 4),
          Text(
            "Telefon va kamera bitta Wi-Fi tarmog'iga ulangan bo'lishi kerak. "
            'Skanlash bir necha soniya davom etadi.',
                style: TextStyle(
                  fontSize: 12,
                  color: context.dsColors.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              if (_scanning)
                _buildProgress()
              else if (_error)
                _buildError()
              else if (_found.isEmpty)
                _buildEmpty()
              else ...[
                Text(
                  '${_found.length} ta kamera topildi — birini tanlang:',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.separated(
                    itemCount: _found.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final ip = _found[index];
                      return ListTile(
                        leading: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: context.dsColors.accent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(Icons.videocam,
                              color: context.dsColors.accent),
                        ),
                        title: Text(ip,
                            style:
                                TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: const Text('IP kamera (ONVIF/RTSP)'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.pop(context, ip),
                      );
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProgress() {
    final progress = _total == 0 ? 0.0 : _checked / _total;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Tarmoq skanlanmoqda…',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            Text(
              '$_checked / $_total',
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(value: progress, minHeight: 10),
        ),
        const SizedBox(height: 12),
        const Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      ],
    );
  }

  Widget _buildEmpty() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.videocam_off_outlined,
            size: 40, color: context.dsColors.textSecondary),
        const SizedBox(height: 12),
        const Text(
          'Kamera topilmadi',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        SizedBox(height: 6),
        Text(
          "1) Kamera yoqilgan va telefon bilan bir xil Wi-Fi tarmog'ida ekanini tekshiring.\n"
          "2) Router'da 'client isolation' (AP isolation) o'chirilganini tekshiring —\n"
          "   u yoqilgan bo'lsa telefon kamera bilan aloqa qila olmaydi.\n"
          '3) Kamera quvvat simi ulanganini tekshiring.\n'
          "4) IP manzilni bilgan bo'lsangiz, uni qo'lda kiriting.",
          style: TextStyle(
            fontSize: 12,
            color: context.dsColors.textSecondary,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _scan,
          icon: const Icon(Icons.refresh),
          label: const Text('Qayta qidirish'),
        ),
      ],
    );
  }

  Widget _buildError() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.error_outline, size: 40, color: context.dsColors.error),
        SizedBox(height: 12),
        Text(
          "Tarmoqni skanlashning imkoni bo'lmadi",
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        SizedBox(height: 6),
        Text(
          "Telefon Wi-Fi tarmog'iga ulanganini tekshiring va qayta urinib ko'ring.",
          style: TextStyle(
            fontSize: 12,
            color: context.dsColors.textSecondary,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _scan,
          icon: const Icon(Icons.refresh),
          label: const Text('Qayta urinish'),
        ),
      ],
    );
  }
}
