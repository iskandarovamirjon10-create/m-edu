import 'package:flutter/material.dart';
import '../../../../core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../attendance/presentation/providers/attendance_statistics_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../students/domain/entities/student.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../../students/presentation/widgets/student_card.dart';
import '../../domain/entities/group.dart';
import '../providers/group_providers.dart';

part 'group_detail_page_widgets.dart';

/// Guruh tafsilotlari sahifasi (spec §6 #16-18).
///
/// Guruh kartasiga bosilganda ochiladi (`/groups/:groupId`): asosiy
/// ma'lumotlar, sig'im, dars jadvali va guruh a'zolari ro'yxati.
class GroupDetailPage extends ConsumerWidget {
  final String groupId;

  const GroupDetailPage({super.key, required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupAsync = ref.watch(groupDetailProvider(groupId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Guruh tafsilotlari'),
        actions: [
          IconButton(
            tooltip: 'Tahrirlash',
            icon: const Icon(Icons.edit_outlined),
            onPressed: () => context.push('/groups/$groupId/edit'),
          ),
        ],
      ),
      body: groupAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ErrorView(
            title: "Ma'lumotlarni yuklashda xato", message: '$error'),
        data: (group) {
          if (group == null) {
            return const _ErrorView(
              title: 'Guruh topilmadi',
              message: 'Guruh o\'chirilgan yoki mavjud emas',
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              // Guruh + a'zolar ro'yxati ham yangilanadi.
              ref.read(groupListVersionProvider.notifier).state++;
              ref.read(studentListVersionProvider.notifier).state++;
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
              children: [
                _HeaderCard(group: group),
                const SizedBox(height: 20),
                _OccupancyCard(group: group),
                const SizedBox(height: 20),
                _InfoCard(group: group),
                const SizedBox(height: 20),
                _ScheduleCard(group: group),
                const SizedBox(height: 20),
                _AttendanceCard(group: group),
                const SizedBox(height: 20),
                _MembersSection(group: group),
              ],
            ),
          );
        },
      ),
    );
  }
}
