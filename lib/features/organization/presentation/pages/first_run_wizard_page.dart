import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../application/commands/setup_organization_command.dart';
import '../providers/organization_providers.dart';
import '../widgets/wizard_step_header.dart';
import '../widgets/wizard_text_field.dart';

/// First-run wizard (spec §5).
///
/// Ilova birinchi marta ochilganda admin'ni majburiy ravishda haqiqiy
/// tashkilot ma'lumotlarini (markaz nomi, filial, birinchi xona/kurs)
/// kiritishga yo'naltiradi. "No Demo Data" siyosatining asosi —
/// bo'sh baza bilan boshlanadi, hech qanday namunaviy yozuv yo'q.
class FirstRunWizardPage extends ConsumerStatefulWidget {
  const FirstRunWizardPage({super.key});

  @override
  ConsumerState<FirstRunWizardPage> createState() => _FirstRunWizardPageState();
}

class _FirstRunWizardPageState extends ConsumerState<FirstRunWizardPage> {
  static const int _contentSteps = 4;
  static const int _totalPages = 5; // 4 bosqich + yakuniy tasdiq

  final _pageController = PageController();
  final _orgNameController = TextEditingController();
  final _branchController = TextEditingController();
  final _roomController = TextEditingController();
  final _courseController = TextEditingController();

  final _formKeys = List.generate(_contentSteps, (_) => GlobalKey<FormState>());

  int _currentPage = 0;
  bool _finishing = false;

  @override
  void dispose() {
    _pageController.dispose();
    _orgNameController.dispose();
    _branchController.dispose();
    _roomController.dispose();
    _courseController.dispose();
    super.dispose();
  }

  void _next() {
    // Joriy bosqichni validatsiya qilamiz.
    if (_currentPage < _contentSteps) {
      final form = _formKeys[_currentPage].currentState;
      if (form == null || !form.validate()) return;
    }

    if (_currentPage < _totalPages - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    }
  }

  /// Tashkilot allaqachon o'rnatilgan bo'lsa (masalan, /setup ga deep-link
  /// orqali kirish), wizard'ni ko'rsatmasdan bosh sahifaga o'tamiz.
  void _guardAgainstReSetup() {
    final requiresSetupAsync = ref.watch(organizationRequiresSetupProvider);
    final requiresSetup = requiresSetupAsync.valueOrNull;
    if (requiresSetup == false) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/dashboard');
      });
    }
  }

  void _back() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Future<void> _finish() async {
    setState(() => _finishing = true);
    try {
      final command = ref.read(setupOrganizationCommandProvider);
      await command.execute(
        SetupOrganizationRequest(
          organizationName: _orgNameController.text,
          branchName: _branchController.text,
          roomName: _roomController.text.isEmpty ? null : _roomController.text,
          courseName:
              _courseController.text.isEmpty ? null : _courseController.text,
        ),
      );

      ref.read(organizationSetupVersionProvider.notifier).state++;
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Xush kelibsiz! Tashkilot muvaffaqiyatli o'rnatildi 🎉"),
          backgroundColor: context.dsColors.success,
        ),
      );
      context.go('/dashboard');
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } catch (e) {
      // Kutilmagan xato (masalan, DB) — button osilib qolmasligi va
      // foydalanuvchi "hech narsa bo'lmadi" holatida qolmasligi uchun.
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saqlashda xatolik: $e'),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _finishing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    _guardAgainstReSetup();

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFEAF2FF), Color(0xFFF5F0FF)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildBrand(),
              _buildProgress(),
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  physics: const NeverScrollableScrollPhysics(),
                  onPageChanged: (page) =>
                      setState(() => _currentPage = page),
                  itemCount: _totalPages,
                  itemBuilder: (context, index) {
                    final isActive = index == _currentPage;
                    return IgnorePointer(
                      ignoring: !isActive,
                      child: AnimatedOpacity(
                        duration: const Duration(milliseconds: 200),
                        opacity: isActive ? 1 : 0,
                        child: index == _contentSteps
                            ? _buildSummaryStep()
                            : _buildInputStep(index),
                      ),
                    );
                  },
                ),
              ),
              _buildNavigation(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBrand() {
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 20, 24, 0),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              gradient: context.dsColors.accentGradient,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.school_rounded, color: Colors.white, size: 22),
          ),
          SizedBox(width: 12),
          Text(
            'M-Edu',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: context.dsColors.textPrimary,
            ),
          ),
          const Spacer(),
          Text(
            '${_currentPage + 1} / $_totalPages',
            style: TextStyle(
              fontSize: 13,
              color: context.dsColors.textSecondary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgress() {
    final progress = (_currentPage + 1) / _totalPages;
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 16, 24, 0),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              backgroundColor: context.dsColors.border.withValues(alpha: 0.3),
              valueColor: AlwaysStoppedAnimation(context.dsColors.accent),
            ),
          ),
          SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_totalPages, (index) {
              final active = index <= _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: EdgeInsets.symmetric(horizontal: 3),
                width: active ? 20 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: active ? context.dsColors.accent : context.dsColors.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildInputStep(int index) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 8),
      child: Form(
        key: _formKeys[index],
        child: Column(
          children: [
            SizedBox(height: 8),
            WizardStepHeader(
              icon: _stepData[index].icon,
              title: _stepData[index].title,
              subtitle: _stepData[index].subtitle,
            ),
            SizedBox(height: 28),
            _buildGlassCard(index),
          ],
        ),
      ),
    );
  }

  Widget _buildGlassCard(int index) {
    return Container(
      padding: EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color: Colors.white.withValues(alpha: 0.75),
        border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
        boxShadow: [
          BoxShadow(
            color: context.dsColors.divider.withValues(alpha: 0.25),
            blurRadius: 30,
            offset: const Offset(0, 12),
            spreadRadius: -8,
          ),
        ],
      ),
      child: switch (index) {
        0 => WizardTextField(
            controller: _orgNameController,
            icon: Icons.apartment,
            label: 'Markaz nomi',
            hint: "Masalan: 'Bilim' ta'lim markazi",
            required: true,
            onChanged: (_) => setState(() {}),
          ),
        1 => WizardTextField(
            controller: _branchController,
            icon: Icons.account_balance,
            label: 'Filial',
            hint: 'Masalan: Chilonzor filiali',
            required: true,
            onChanged: (_) => setState(() {}),
          ),
        2 => WizardTextField(
            controller: _roomController,
            icon: Icons.meeting_room,
            label: 'Birinchi xona (ixtiyoriy)',
            hint: 'Masalan: Xona 204',
            required: false,
            onChanged: (_) => setState(() {}),
          ),
        _ => WizardTextField(
            controller: _courseController,
            icon: Icons.menu_book,
            label: 'Birinchi kurs (ixtiyoriy)',
            hint: 'Masalan: Matematika',
            required: false,
            textInputAction: TextInputAction.done,
            onChanged: (_) => setState(() {}),
          ),
      },
    );
  }

  Widget _buildSummaryStep() {
    final orgName = _orgNameController.text.trim();
    final branch = _branchController.text.trim();
    final room = _roomController.text.trim();
    final course = _courseController.text.trim();

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 8),
      child: Column(
        children: [
          SizedBox(height: 8),
          const WizardStepHeader(
            icon: Icons.verified_outlined,
            title: 'Hammasi tayyor!',
            subtitle:
                'Kiritilgan ma\'lumotlarni tekshiring. Keyinroq barcha '
                'bo\'limlarni sozlamalardan o\'zgartirishingiz mumkin.',
          ),
          SizedBox(height: 28),
          Container(
            padding: EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              color: Colors.white.withValues(alpha: 0.75),
              border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
              boxShadow: [
                BoxShadow(
                  color: context.dsColors.divider.withValues(alpha: 0.25),
                  blurRadius: 30,
                  offset: const Offset(0, 12),
                  spreadRadius: -8,
                ),
              ],
            ),
            child: Column(
              children: [
                _SummaryRow(
                  icon: Icons.apartment,
                  label: 'Markaz',
                  value: orgName,
                ),
                _SummaryRow(
                  icon: Icons.account_balance,
                  label: 'Filial',
                  value: branch,
                ),
                _SummaryRow(
                  icon: Icons.meeting_room,
                  label: 'Xona',
                  value: room.isEmpty ? '— (keyinroq)' : room,
                ),
                _SummaryRow(
                  icon: Icons.menu_book,
                  label: 'Kurs',
                  value: course.isEmpty ? '— (keyinroq)' : course,
                  isLast: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavigation() {
    final isLastStep = _currentPage == _totalPages - 1;
    final canFinish =
        _orgNameController.text.trim().isNotEmpty &&
            _branchController.text.trim().isNotEmpty;

    return Padding(
      padding: EdgeInsets.fromLTRB(24, 8, 24, 20),
      child: Row(
        children: [
          if (_currentPage > 0)
            Expanded(
              child: OutlinedButton(
                onPressed: _finishing ? null : _back,
                style: OutlinedButton.styleFrom(
                  foregroundColor: context.dsColors.textPrimary,
                  side: BorderSide(
                    color: context.dsColors.border.withValues(alpha: 0.7),
                  ),
                  padding: EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text('Orqaga'),
              ),
            ),
          if (_currentPage > 0) SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _finishing
                  ? null
                  : isLastStep
                      ? (canFinish ? _finish : null)
                      : _next,
              child: _finishing
                  ? SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(isLastStep ? 'Yakunlash' : 'Davom etish'),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool isLast;

  const _SummaryRow({
    required this.icon,
    required this.label,
    required this.value,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : Border(
                bottom: BorderSide(
                  color: context.dsColors.border.withValues(alpha: 0.4),
                ),
              ),
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: context.dsColors.accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: context.dsColors.accent),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: context.dsColors.textSecondary,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepData {
  final IconData icon;
  final String title;
  final String subtitle;
  const _StepData(this.icon, this.title, this.subtitle);
}

const _stepData = [
  _StepData(
    Icons.apartment,
    'Tashkilotingiz nomi',
    'Bu nom barcha hujjat va ID kartalarda ko\'rinadi.\n'
        'Haqiqiy markaz nomini kiriting.',
  ),
  _StepData(
    Icons.account_balance,
    'Filial',
    'Qaysi filialdan boshlamoqchisiz?\n'
        'Ko\'p filialli tizim keyinroq qo\'llab-quvvatlanadi.',
  ),
  _StepData(
    Icons.meeting_room,
    'Birinchi xona',
    'Darslar o\'tadigan xonani kiriting.\n'
        'Ixtiyoriy — keyinroq qo\'shishingiz mumkin.',
  ),
  _StepData(
    Icons.menu_book,
    'Birinchi kurs',
    'Boshlang\'ich o\'quv kursini kiriting.\n'
        'Ixtiyoriy — keyinroq qo\'shishingiz mumkin.',
  ),
];
