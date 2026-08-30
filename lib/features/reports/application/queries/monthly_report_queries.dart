import '../../../attendance/domain/repositories/attendance_repository.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../../../students/domain/repositories/student_repository.dart';
import '../../domain/entities/monthly_attendance_summary.dart';

/// Oylik davomat hisoboti — har bir o'quvchi uchun necha kun kelgan va
/// necha kun kelmaganini hisoblaydi (oy yakuni hisobotlari uchun).
///
/// Faqat **faol** o'quvchilar hisobga olinadi. "Kelgan kun" — o'sha
/// sanada davomat yozuvi mavjud bo'lgan kun (kuniga bir marta sanaladi).
class MonthlyReportQueries {
  final StudentRepository _studentRepository;
  final IdentityRepository _identityRepository;
  final AttendanceRepository _attendanceRepository;

  MonthlyReportQueries({
    required StudentRepository studentRepository,
    required IdentityRepository identityRepository,
    required AttendanceRepository attendanceRepository,
  })  : _studentRepository = studentRepository,
        _identityRepository = identityRepository,
        _attendanceRepository = attendanceRepository;

  /// Berilgan oy uchun barcha faol o'quvchilarning davomat hisoboti.
  Future<List<MonthlyAttendanceSummary>> fetchForMonth(
    int year,
    int month,
  ) async {
    final start = DateTime(year, month, 1);
    final end = DateTime(year, month + 1, 1);

    final students = await _studentRepository.fetchActive();
    final identities = await _identityRepository.fetchAll();
    final entries = await _attendanceRepository.fetchBetween(start, end);

    final identityById = <String, Identity>{
      for (final i in identities) i.identityId: i,
    };

    // Har bir o'quvchi uchun kunlik statuslarni ajratamiz.
    // present = present, late = kechikkan, absent = kelmagan, excused = sababli.
    final presentDaysByIdentity = <String, Set<String>>{};
    final lateDaysByIdentity = <String, Set<String>>{};
    final excusedDaysByIdentity = <String, Set<String>>{};

    for (final entry in entries) {
      if (entry.role != 'student') continue;
      final dateKey = _dateKey(entry.timestamp);
      final status = entry.status.toLowerCase();

      switch (status) {
        case 'present':
          presentDaysByIdentity
              .putIfAbsent(entry.identityId, () => <String>{})
              .add(dateKey);
        case 'late':
          lateDaysByIdentity
              .putIfAbsent(entry.identityId, () => <String>{})
              .add(dateKey);
        case 'excused':
          excusedDaysByIdentity
              .putIfAbsent(entry.identityId, () => <String>{})
              .add(dateKey);
        // absent — hisobga olinmaydi (kun yo'q deb hisoblanadi).
      }
    }

    final schoolDays = _countSchoolDays(year, month);

    final summaries = <MonthlyAttendanceSummary>[];
    for (final student in students) {
      final identity = identityById[student.identityId];
      if (identity == null) continue;

      final present = presentDaysByIdentity[student.identityId]?.length ?? 0;
      final late = lateDaysByIdentity[student.identityId]?.length ?? 0;
      final excused =
          excusedDaysByIdentity[student.identityId]?.length ?? 0;
      // Absent = jami kunlar - (kelgan + kechikkan + sababli)
      final attendedTotal = present + late + excused;
      final absent = (schoolDays - attendedTotal).clamp(0, schoolDays);

      summaries.add(
        MonthlyAttendanceSummary(
          identityId: student.identityId,
          fullName: identity.fullName,
          groupName: student.groupName,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          parentTelegramId: student.parentTelegramId,
          presentDays: present,
          lateDays: late,
          absentDays: absent,
          excusedDays: excused,
          totalSchoolDays: schoolDays,
        ),
      );
    }

    summaries.sort((a, b) {
      final byGroup = (a.groupName ?? '').compareTo(b.groupName ?? '');
      return byGroup != 0 ? byGroup : a.fullName.compareTo(b.fullName);
    });
    return summaries;
  }

  /// Oy boshidan (yoki joriy oy bo'lsa, bugungacha) dushanba–juma
  /// kunlari soni — "o'quv kunlari" sifatida qabul qilinadi.
  int _countSchoolDays(int year, int month) {
    final now = DateTime.now();
    final isCurrentMonth = now.year == year && now.month == month;
    final lastDay = isCurrentMonth
        ? now.day
        : DateTime(year, month + 1, 0).day;

    var count = 0;
    for (var day = 1; day <= lastDay; day++) {
      final weekday = DateTime(year, month, day).weekday;
      if (weekday >= DateTime.monday && weekday <= DateTime.friday) {
        count++;
      }
    }
    return count;
  }

  static String _dateKey(DateTime d) => '${d.year}-${d.month}-${d.day}';
}
