// QISM: attendance_page.dart ning "part" fayli — leaf widgetlar.
//
// `part of` sababli asosiy fayl bilan bir xil privat scopeni bo'lishadi.

part of 'attendance_page.dart';

/// Faol/tanlangan dars konteksti ko'rinishi — dars sarlavhasi, belgilash
/// paneli, statistika va shu DARS bo'yicha TO'LIQ o'quvchi ro'yxati.
///
/// Spec §05-08: bu ENG MUHIM operational screen. Tezkor workflow:
/// [HAMMASI KELDI] → istisnolarni individual o'zgartirish → saqlash.
/// Har bir holat tanlovi 0–100ms ichida tasdiqlanadi (optimistic UI).
class _ActiveLessonView extends ConsumerStatefulWidget {
  final LessonInstance lesson;
  final List<Student> activeStudents;

  const _ActiveLessonView({
    required this.lesson,
    required this.activeStudents,
  });

  @override
  ConsumerState<_ActiveLessonView> createState() => _ActiveLessonViewState();
}

class _ActiveLessonViewState extends ConsumerState<_ActiveLessonView> {
  /// Optimistic holatlar: identityId → status. Tanlash DARHOL UI'da
  /// aks etadi; command natijasi real bazaga yoziladi (0–100ms).
  final Map<String, String> _optimistic = {};

  /// Saqlanayotgan o'quvchilar (row'da yengil spinner ko'rsatiladi).
  final Map<String, bool> _saving = {};

  /// Shu dars guruhidagi faol o'quvchilar.
  ///
  /// Guruhga biriktirilmagan yoki guruh ID'si mos kelmaydigan holatlarda
  /// (o'tish davri) — barcha faol o'quvchilarga qaytadi, belgilash
  /// bloklanmaydi.
  List<Student> get _groupStudents {
    final inGroup = widget.activeStudents
        .where((s) => s.groupId == widget.lesson.groupId)
        .toList();
    return inGroup.isEmpty ? widget.activeStudents : inGroup;
  }

  /// Dars hali boshlanmaganmi? (kelajak sana yoki bugun hali vaqti yetmagan)
  /// — spec §10: \"Dars hali boshlanmagan.\" inputlar bloklanadi.
  bool get _notStarted =>
      _lessonPhase(widget.lesson, DateTime.now()) == _LessonPhase.scheduled;

  /// O'quvchi uchun hozirgi holat: optimistic → real yozuv → belgilanmagan.
  String? _statusFor(Map<String, AttendanceEntry> byId, String identityId) {
    final optimistic = _optimistic[identityId];
    if (optimistic != null) return optimistic;
    return byId[identityId]?.status;
  }

  @override
  Widget build(BuildContext context) {
    final lesson = widget.lesson;
    final lessonAttendance =
        ref.watch(lessonAttendanceProvider(lesson.lessonId));
    final sessionAsync = ref.watch(attendanceSessionProvider);
    final groupStudents = _groupStudents;

    return lessonAttendance.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _LessonLoadError(message: '$error'),
      data: (entries) {
        final byId = {for (final e in entries) e.identityId: e};

        // Qatnashdi = present + late (optimistic hisob bilan).
        var presentCount = 0;
        var faceCount = 0;
        for (final s in groupStudents) {
          final status = _statusFor(byId, s.identityId);
          if (status == 'present' || status == 'late') presentCount++;
          final entry = byId[s.identityId];
          if (entry?.method == 'face') faceCount++;
        }
        // Ro'yxatdan o'tgan lekin hozir guruhda bo'lmagan yozuvlar ham
        // ko'rinadi (o'chirilgan guruh a'zolari) — ma'lumot yo'qolmaydi.
        final extraStudents = entries
            .where((e) =>
                !groupStudents.any((s) => s.identityId == e.identityId))
            .toList();

        // Virtualizatsiya (spec §11: 20+ o'quvchi — lightweight qatorlar,
        // minimal rebuild): header bloklari fiks, qatorlar faqat ko'rinadigan
        //lari quriladi (ListView.builder).
        const headerCount = 8;
        final rowCount =
            (groupStudents.isEmpty && extraStudents.isEmpty) ? 1 : groupStudents.length + extraStudents.length;

        return ListView.builder(
          padding: EdgeInsets.all(16),
          itemCount: headerCount + rowCount,
          itemBuilder: (context, index) {
            switch (index) {
              case 0:
                return _LessonContextCard(
                  lesson: lesson,
                  presentCount: presentCount,
                  totalCount: groupStudents.length,
                  notStarted: _notStarted,
                  sessionStatus: sessionAsync.valueOrNull?.status,
                );
              case 1:
                return SizedBox(height: 16);
              case 2:
                return _MarkingPanel(
                  lesson: lesson,
                  groupStudents: groupStudents,
                  notStarted: _notStarted,
                );
              case 3:
                return SizedBox(height: 16);
              case 4:
                return _AttendanceStatsCard(
                  totalCount: groupStudents.length,
                  presentCount: presentCount,
                  faceCount: faceCount,
                );
              case 5:
                return SizedBox(height: 20);
              case 6:
                return _StudentListHeader(
                  totalCount: groupStudents.length,
                  markedCount: groupStudents
                      .where((s) => _statusFor(byId, s.identityId) != null)
                      .length,
                  notStarted: _notStarted,
                  onMarkAll: () => _markAllPresent(context, byId),
                );
              case 7:
                return SizedBox(height: 10);
              default:
                if (groupStudents.isEmpty && extraStudents.isEmpty) {
                  return const _EmptyLessonAttendanceCard();
                }
                final rowIndex = index - headerCount;
                if (rowIndex < groupStudents.length) {
                  final student = groupStudents[rowIndex];
                  return _StudentMarkingRow(
                    key: ValueKey('mark-row-${student.identityId}'),
                    student: student,
                    entry: byId[student.identityId],
                    status: _statusFor(byId, student.identityId),
                    saving: _saving[student.identityId] ?? false,
                    canMark: !_notStarted,
                    onStatus: (status) =>
                        _markStudent(context, student, status),
                  );
                }
                final entry =
                    extraStudents[rowIndex - groupStudents.length];
                return _LegacyEntryRow(entry: entry);
            }
          },
        );
      },
    );
  }

  /// HAMMASI KELDI (spec §07 — eng muhim tezkor workflow): barcha
  /// o'quvchilarga `present` belgilanadi; administrator faqat istisnolarni
  /// o'zgartiradi. Belgilangani allaqachon present/late bo'lganlar o'tkazib
  /// yuboriladi. Command'lar parallel yoziladi (bitta writeTxn har biri).
  Future<void> _markAllPresent(
    BuildContext context,
    Map<String, AttendanceEntry> byId,
  ) async {
    final lesson = widget.lesson;
    final targets = _groupStudents.where((s) {
      final status = _statusFor(byId, s.identityId);
      return status != 'present' && status != 'late';
    }).toList();
    if (targets.isEmpty) return;

    // Identity ma'lumotlari (fullName/role) — real bazadan.
    final identities = <String, Identity?>{};
    for (final s in targets) {
      var identity =
          ref.read(identityDetailProvider(s.identityId)).valueOrNull;
      if (identity == null) {
        try {
          identity = await ref
              .read(identityDetailProvider(s.identityId).future);
        } catch (_) {
          identity = null;
        }
      }
      identities[s.identityId] = identity;
    }

    var failures = 0;
    var successes = 0;
    for (final s in targets) {
      final identity = identities[s.identityId];
      if (identity == null) {
        failures++;
        continue;
      }
      setState(() {
        _optimistic[s.identityId] = 'present';
        _saving[s.identityId] = true;
      });
      try {
        await ref.read(markAttendanceStatusCommandProvider).execute(
              MarkAttendanceStatusRequest(
                identityId: identity.identityId,
                fullName: identity.fullName,
                role: identity.role.name,
                attendanceDate: lesson.date,
                lessonId: lesson.lessonId,
                status: AttendanceStatus.present,
              ),
            );
        successes++;
      } on Failure {
        setState(() => _optimistic.remove(s.identityId));
        failures++;
      } finally {
        if (mounted) {
          setState(() => _saving.remove(s.identityId));
        }
      }
    }
    if (!context.mounted) return;
    // Qisman muvaffaqiyat ham aniq ko'rsatiladi (yolg'on "hammasi ok" yo'q).
    final (message, isError) = failures == 0
        ? ('Barchasi keldi — $successes ta o\'quvchi belgilandi', false)
        : successes == 0
            ? ('Saqlab bo\'lmadi, qayta urining.', true)
            : ('$successes ta belgilandi, $failures ta xato.', true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? context.dsColors.error : context.dsColors.success,
      ),
    );
  }

  /// Bitta o'quvchi holatini DARHOL belgilash (spec §08: instant, 0–100ms).
  Future<void> _markStudent(
    BuildContext context,
    Student student,
    String status,
  ) async {
    final lesson = widget.lesson;
    Identity? identity =
        ref.read(identityDetailProvider(student.identityId)).valueOrNull;
    if (identity == null) {
      try {
        identity = await ref
            .read(identityDetailProvider(student.identityId).future);
      } catch (_) {
        identity = null;
      }
    }
    if (identity == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('O\'quvchi ma\'lumotlari topilmadi'),
            backgroundColor: context.dsColors.error,
          ),
        );
      }
      return;
    }

    // Optimistic: tanlov darhol aks etadi (spec: foydalanuvchini kutdirma).
    setState(() {
      _optimistic[student.identityId] = status;
      _saving[student.identityId] = true;
    });

    try {
      await ref.read(markAttendanceStatusCommandProvider).execute(
            MarkAttendanceStatusRequest(
              identityId: identity.identityId,
              fullName: identity.fullName,
              role: identity.role.name,
              // Yozuv DARS SANASIga yoziladi (o'tgan darsni belgilashda ham
              // to'g'ri kun) — DateTime.now() emas.
              attendanceDate: lesson.date,
              lessonId: lesson.lessonId,
              status: AttendanceStatus.values.firstWhere(
                (s) => s.name == status,
              ),
            ),
          );
    } on Failure catch (failure) {
      if (!context.mounted) return;
      // Xatoda optimistic holat qaytariladi (real holat yolg'on emas).
      setState(() => _optimistic.remove(student.identityId));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _saving.remove(student.identityId));
      }
    }
  }
}

/// Dars fazasi: Rejalashtirilgan / Jarayonda / Tugagan.
enum _LessonPhase { scheduled, ongoing, ended }

/// Dars boshlanmaganmi? Kelajak sana yoki bugungi dars hali boshlamagan.
/// (Rejalashtirilgan = boshlanmagan — spec §10 bloklash shartlari.)
_LessonPhase _lessonPhase(LessonInstance lesson, DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  if (lesson.date.isAfter(today)) return _LessonPhase.scheduled;
  if (lesson.date.isBefore(today)) return _LessonPhase.ended;
  final nowMinutes = now.hour * 60 + now.minute;
  final start = _minutesOf(lesson.startTime);
  final end = _minutesOf(lesson.endTime);
  if (nowMinutes < start) return _LessonPhase.scheduled;
  if (nowMinutes < end) return _LessonPhase.ongoing;
  return _LessonPhase.ended;
}

int _minutesOf(String time) {
  final parts = time.split(':');
  return int.parse(parts[0]) * 60 + int.parse(parts[1]);
}

/// Dars konteksti sarlavhasi: Guruh • Fan / vaqt / O'qituvchi / holat.
class _LessonContextCard extends StatelessWidget {
  final LessonInstance lesson;
  final int presentCount;
  final int totalCount;

  /// Dars hali boshlanmagan — \"Dars hali boshlanmagan.\" holati.
  final bool notStarted;

  final AttendanceSessionStatus? sessionStatus;

  const _LessonContextCard({
    required this.lesson,
    required this.presentCount,
    required this.totalCount,
    required this.notStarted,
    this.sessionStatus,
  });

  @override
  Widget build(BuildContext context) {
    final subject = lesson.subject ?? 'Dars';
    final group = lesson.groupName ?? lesson.groupId;
    final teacher = lesson.teacherName ?? '—';

    return AppCard(
      padding: EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: context.dsColors.accentGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(Icons.school_outlined,
                    color: Colors.white, size: 24),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$subject — $group',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: context.dsColors.textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    SizedBox(height: 2),
                    Text(
                      '${_fmtLessonDate(lesson)} • '
                      '${lesson.startTime} – ${lesson.endTime}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: context.dsColors.accent,
                      ),
                    ),
                  ],
                ),
              ),
              // Dars holati: Jarayonda / Rejalashtirilgan / Tugagan.
              _LessonStateChip(
                phase: _lessonPhase(lesson, DateTime.now()),
              ),
            ],
          ),
          SizedBox(height: 14),
          Row(
            children: [
              Icon(Icons.person_outline,
                  size: 15, color: context.dsColors.textSecondary),
              SizedBox(width: 6),
              Flexible(
                child: Text(
                  'Teacher: $teacher',
                  style: TextStyle(
                    fontSize: 13,
                    color: context.dsColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (lesson.roomName != null) ...[
                SizedBox(width: 14),
                Icon(Icons.meeting_room_outlined,
                    size: 15, color: context.dsColors.textSecondary),
                SizedBox(width: 6),
                Flexible(
                  child: Text(
                    lesson.roomName!,
                    style: TextStyle(
                      fontSize: 13,
                      color: context.dsColors.textSecondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),
          SizedBox(height: 12),
          Row(
            children: [
              Icon(Icons.how_to_reg, size: 16, color: context.dsColors.success),
              SizedBox(width: 6),
              Text(
                '$presentCount / $totalCount qatnashdi',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: context.dsColors.success,
                ),
              ),
              const Spacer(),
              if (sessionStatus != null)
                _SessionStatusChip(status: sessionStatus!),
            ],
          ),
          if (notStarted) ...[
            SizedBox(height: 12),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: context.dsColors.info.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: context.dsColors.info.withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  Icon(Icons.schedule, size: 16, color: context.dsColors.info),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Dars hali boshlanmagan.',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: context.dsColors.info,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Dars holati chipi: Jarayonda / Rejalashtirilgan / Tugagan (icon+text).
class _LessonStateChip extends StatelessWidget {
  final _LessonPhase phase;

  const _LessonStateChip({required this.phase});

  @override
  Widget build(BuildContext context) {
    final (icon, color, label) = switch (phase) {
      _LessonPhase.scheduled => (
          Icons.schedule,
          context.dsColors.info,
          'Rejalashtirilgan'
        ),
      _LessonPhase.ongoing => (
          Icons.play_circle_outline,
          context.dsColors.success,
          'Jarayonda'
        ),
      _LessonPhase.ended => (
          Icons.check_circle_outline,
          context.dsColors.textSecondary,
          'Tugagan'
        ),
    };
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Attendance session holati chipi (P1.5).
class _SessionStatusChip extends StatelessWidget {
  final AttendanceSessionStatus status;

  const _SessionStatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final (tone, icon, label) = switch (status) {
      AttendanceSessionStatus.active => (
          AppStatusTone.success,
          Icons.play_circle_outline,
          'Sessiya faol'
        ),
      AttendanceSessionStatus.notStarted => (
          AppStatusTone.info,
          Icons.schedule,
          'Sessiya kutilmoqda'
        ),
      AttendanceSessionStatus.completed => (
          AppStatusTone.warning,
          Icons.check_circle_outline,
          'Sessiya yakunlandi'
        ),
      AttendanceSessionStatus.cancelled => (
          AppStatusTone.error,
          Icons.cancel_outlined,
          'Sessiya bekor'
        ),
    };

    return AppStatusChip(tone: tone, icon: icon, label: label);
  }
}

/// Face / QR belgilash paneli — barchasi [lesson] kontekstidan.
/// Qo'lda belgilash esa quyidagi o'quvchi ro'yxatining inline boshqaruvi
/// (spec §27: manual fallback tez bo'lishi kerak).
class _MarkingPanel extends ConsumerWidget {
  final LessonInstance lesson;
  final List<Student> groupStudents;

  /// Dars hali boshlanmagan — Face/QR ham bloklanadi (spec §10).
  final bool notStarted;

  const _MarkingPanel({
    required this.lesson,
    required this.groupStudents,
    required this.notStarted,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppCard(
      padding: EdgeInsets.all(20),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: context.dsColors.accentGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child:
                    Icon(Icons.videocam, color: Colors.white, size: 26),
              ),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.attendanceFaceIdTitle,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: context.dsColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      groupStudents.isEmpty
                          ? context.l10n.attendanceNoStudents
                          : context.l10n.attendanceFaceIdDesc,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: notStarted
                      ? null
                      : groupStudents.isEmpty
                          ? () => context.push('/identity/register')
                          : () => context.push('/face-scan'),
                  icon: Icon(Icons.face_retouching_natural),
                  label: Text('Face ID'),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: notStarted || groupStudents.isEmpty
                      ? null
                      : () => context.push('/identity/scan'),
                  icon: Icon(Icons.qr_code_scanner),
                  label: Text('QR Kod'),
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Statistika kartasi (real bazadan, shu dars bo'yicha).
class _AttendanceStatsCard extends StatelessWidget {
  final int totalCount;
  final int presentCount;
  final int faceCount;

  const _AttendanceStatsCard({
    required this.totalCount,
    required this.presentCount,
    required this.faceCount,
  });

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 14),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildStatItem(context, 'Jami', '$totalCount', context.dsColors.accent),
            _buildStatItem(
                context, 'Qatnashdi', '$presentCount', context.dsColors.success),
            _buildStatItem(context, 'Face ID', '$faceCount', context.dsColors.info),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(
      BuildContext context, String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        SizedBox(height: 2),
        Text(
          label,
          style:
              TextStyle(fontSize: 12, color: context.dsColors.textSecondary),
        ),
      ],
    );
  }
}

/// O'quvchi ro'yxati sarlavhasi + HAMMASI KELDI tezkor amali (spec §07).
class _StudentListHeader extends StatelessWidget {
  final int totalCount;
  final int markedCount;
  final bool notStarted;
  final VoidCallback onMarkAll;

  const _StudentListHeader({
    required this.totalCount,
    required this.markedCount,
    required this.notStarted,
    required this.onMarkAll,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.attendanceToday,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: context.dsColors.textPrimary,
                ),
              ),
              Text(
                '$markedCount / $totalCount belgilandi',
                style: TextStyle(
                  fontSize: 12,
                  color: context.dsColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        FilledButton.tonalIcon(
          onPressed: notStarted ? null : onMarkAll,
          icon: Icon(Icons.done_all, size: 18),
          label: Text('Hammasi keldi'),
          style: FilledButton.styleFrom(
            visualDensity: VisualDensity.compact,
          ),
        ),
      ],
    );
  }
}

/// Bitta o'quvchining davomat qatori — INSTANT holat boshqaruvi (spec §08):
/// [Keldi | Kech qoldi | Kelmagan | Uzrli] — tanlanganda darhol saqlanadi.
/// 48dp+ touch target, yengil qator (20+ o'quvchi uchun performant).
class _StudentMarkingRow extends ConsumerWidget {
  final Student student;

  /// Real yozuv (mavjud bo'lsa) — method/vaqt ko'rsatish uchun.
  final AttendanceEntry? entry;

  /// Hozirgi holat (optimistic + real) — null = belgilanmagan.
  final String? status;

  final bool saving;
  final bool canMark;
  final ValueChanged<String> onStatus;

  const _StudentMarkingRow({
    super.key,
    required this.student,
    required this.entry,
    required this.status,
    required this.saving,
    required this.canMark,
    required this.onStatus,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final identity = ref.watch(identityDetailProvider(student.identityId));
    final name = identity.valueOrNull?.fullName ?? student.identityId;
    final methodLabel = switch (entry?.method) {
      'face' => 'Face ID',
      'qr' => 'QR',
      _ => "Qo'lda",
    };
    final colors = context.dsColors;

    return Container(
      margin: EdgeInsets.only(bottom: 10),
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: colors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: (status != null
                          ? _statusColor(context, status!)
                          : context.dsColors.accent)
                      .withValues(alpha: 0.13),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: status != null
                        ? _statusColor(context, status!)
                        : context.dsColors.accent,
                  ),
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: colors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      entry == null
                          ? 'Belgilanmagan'
                          : '${_fmtLessonTime(entry!.checkInAt ?? entry!.attendanceDate)} • '
                              '$methodLabel',
                      style: TextStyle(
                        fontSize: 11,
                        color: entry == null
                            ? context.dsColors.warning
                            : colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (saving)
                SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else if (status != null)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_statusIcon(status!),
                        size: 14, color: _statusColor(context, status!)),
                    SizedBox(width: 4),
                    Text(
                      _statusLabel(status!),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _statusColor(context, status!),
                      ),
                    ),
                  ],
                ),
            ],
          ),
          SizedBox(height: 10),
          // ─── Holat boshqaruvi: icon + matn + rang (spec §09) ───────
          Container(
            height: 44,
            decoration: BoxDecoration(
              color: colors.surfaceOverlay,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: context.dsColors.border.withValues(alpha: 0.4),
                width: 0.8,
              ),
            ),
            child: Row(
              children: [
                _StatusOption(
                  label: 'Keldi',
                  icon: Icons.check_circle_outline,
                  color: context.dsColors.success,
                  active: status == 'present',
                  enabled: canMark,
                  onTap: () => onStatus('present'),
                ),
                _StatusOption(
                  label: 'Kech qoldi',
                  icon: Icons.access_time,
                  color: context.dsColors.warning,
                  active: status == 'late',
                  enabled: canMark,
                  onTap: () => onStatus('late'),
                ),
                _StatusOption(
                  label: 'Kelmagan',
                  icon: Icons.cancel_outlined,
                  color: context.dsColors.error,
                  active: status == 'absent',
                  enabled: canMark,
                  onTap: () => onStatus('absent'),
                ),
                _StatusOption(
                  label: 'Uzrli',
                  icon: Icons.event_busy_outlined,
                  color: context.dsColors.info,
                  active: status == 'excused',
                  enabled: canMark,
                  onTap: () => onStatus('excused'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Bitta holat tugmasi (icon + matn + rang; faqat rangga tayanilmaydi).
class _StatusOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool active;
  final bool enabled;
  final VoidCallback onTap;

  const _StatusOption({
    required this.label,
    required this.icon,
    required this.color,
    required this.active,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final onColor = active ? color : context.dsColors.textSecondary;
    return Expanded(
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? color.withValues(alpha: 0.14) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 14,
                  color: active
                      ? color
                      : enabled
                          ? context.dsColors.textTertiary
                          : context.dsColors.textTertiary
                              .withValues(alpha: 0.4)),
              SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: onColor.withValues(alpha: enabled ? 1 : 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Ro'yxatga olingan, lekin hozir guruhda bo'lmagan yozuv (legacy).
class _LegacyEntryRow extends StatelessWidget {
  final AttendanceEntry entry;

  const _LegacyEntryRow({required this.entry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(_statusIcon(entry.status),
              size: 16, color: _statusColor(context, entry.status)),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              entry.fullName,
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
              ),
            ),
          ),
          Text(
            _statusLabel(entry.status),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: _statusColor(context, entry.status),
            ),
          ),
        ],
      ),
    );
  }
}

/// Faol dars yo'q — \"Hozir faol dars yo'q\" empty state.
class _NoActiveLesson extends StatelessWidget {
  final bool hasStudents;

  const _NoActiveLesson({required this.hasStudents});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                gradient: context.dsColors.accentGradient,
                borderRadius: BorderRadius.circular(28),
              ),
              child:
                  Icon(Icons.event_busy, size: 40, color: Colors.white),
            ),
            SizedBox(height: 20),
            Text(
              "Hozir faol dars yo'q",
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w700,
                color: context.dsColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 8),
            Text(
              'Davomat faol dars vaqtida belgilanadi. '
              "Dars jadvalini tekshiring yoki yangi dars qo'shing.",
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: context.dsColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => context.go('/schedule'),
              icon: Icon(Icons.calendar_month_outlined),
              label: Text('Dars jadvali'),
            ),
            if (!hasStudents) ...[
              SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => context.push('/identity/register'),
                icon: Icon(Icons.person_add_alt),
                label: Text(context.l10n.attendanceAddStudent),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LessonLoadError extends StatelessWidget {
  final String message;
  const _LessonLoadError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 56, color: context.dsColors.error),
            SizedBox(height: 12),
            Text(
              'Jadvalni yuklashda xato yuz berdi',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 6),
            Text(
              message,
              style: TextStyle(
                fontSize: 12,
                color: context.dsColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyLessonAttendanceCard extends StatelessWidget {
  const _EmptyLessonAttendanceCard();

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Column(
          children: [
            Icon(Icons.event_note_outlined,
                size: 40, color: context.dsColors.textTertiary),
            SizedBox(height: 10),
            Text(
              'Bu guruhda belgilash uchun o\'quvchilar yo\'q',
              style: TextStyle(
                  fontSize: 13, color: context.dsColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Holat yordamchilari (spec §08: Keldi / Kech qoldi / Kelmagan) ─────

String _statusLabel(String status) {
  return switch (status) {
    'present' => 'Keldi',
    'late' => 'Kech qoldi',
    'absent' => 'Kelmagan',
    'excused' => 'Uzrli',
    _ => status,
  };
}

IconData _statusIcon(String status) {
  return switch (status) {
    'present' => Icons.check_circle_outline,
    'late' => Icons.access_time,
    'absent' => Icons.cancel_outlined,
    'excused' => Icons.event_busy_outlined,
    _ => Icons.help_outline,
  };
}

Color _statusColor(BuildContext context, String status) {
  return switch (status) {
    'present' => context.dsColors.success,
    'late' => context.dsColors.warning,
    'absent' => context.dsColors.error,
    'excused' => context.dsColors.info,
    _ => context.dsColors.accent,
  };
}

String _fmtLessonDate(LessonInstance lesson) {
  final d = lesson.date;
  return '${d.day}.${d.month.toString().padLeft(2, '0')}.${d.year}';
}

String _fmtLessonTime(DateTime t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
