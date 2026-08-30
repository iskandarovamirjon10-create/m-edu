import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/glass_button.dart';
import '../../../../shared/design_system/glass_card.dart';
import '../../../../shared/design_system/glass_text_field.dart';
import '../../application/commands/capture_lead_command.dart';
import '../../domain/entities/lead.dart';
import '../providers/lead_providers.dart';

/// Yangi lead qo'lga kiritish sheet'i (CaptureLeadCommand).
///
/// Dedup tekshiruvi ogohlantiradi, bloklamaydi (spec §4): o'xshash lead
/// mavjud bo'lsa — saqlangandan keyin SnackBar orqali ko'rsatiladi.
class CaptureLeadSheet extends ConsumerStatefulWidget {
  const CaptureLeadSheet({super.key});

  @override
  ConsumerState<CaptureLeadSheet> createState() => _CaptureLeadSheetState();
}

class _CaptureLeadSheetState extends ConsumerState<CaptureLeadSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _notesController = TextEditingController();

  LeadSource _source = LeadSource.instagram;
  String? _assignedTo;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      final result = await ref.read(captureLeadCommandProvider).execute(
            CaptureLeadRequest(
              fullName: _nameController.text,
              phone: _phoneController.text.trim().isEmpty
                  ? null
                  : _phoneController.text.trim(),
              email: _emailController.text.trim().isEmpty
                  ? null
                  : _emailController.text.trim(),
              source: _source,
              assignedToUserId: _assignedTo,
              notes: _notesController.text.trim().isEmpty
                  ? null
                  : _notesController.text.trim(),
            ),
          );
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      final navigator = Navigator.of(context);
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            result.hasDuplicates
                ? '${context.l10n.crmCaptureSuccess}. '
                    '${context.l10n.crmDuplicatesFound} '
                    '(${result.possibleDuplicates.length})'
                : context.l10n.crmCaptureSuccess,
          ),
          backgroundColor: result.hasDuplicates
              ? context.dsColors.warning
              : context.dsColors.success,
        ),
      );
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: context.dsColors.error),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.dsColors;

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      minChildSize: 0.6,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: colors.scaffold,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Drag handle
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: context.dsColors.border,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
                child: Text(
                  l10n.crmNewLead,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  child: Form(
                    key: _formKey,
                    child: GlassCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          GlassTextField(
                            controller: _nameController,
                            labelText: l10n.crmFullName,
                            hintText: 'Aliyev Ali',
                            prefixIcon: Icons.person_outline,
                            textInputAction: TextInputAction.next,
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return l10n.registerNameRequired;
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          GlassTextField(
                            controller: _phoneController,
                            labelText: l10n.crmPhone,
                            hintText: '+998 90 123 45 67',
                            prefixIcon: Icons.phone_outlined,
                            keyboardType: TextInputType.phone,
                            textInputAction: TextInputAction.next,
                          ),
                          const SizedBox(height: 12),
                          GlassTextField(
                            controller: _emailController,
                            labelText: l10n.crmEmail,
                            hintText: 'info@example.com',
                            prefixIcon: Icons.email_outlined,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return null;
                              }
                              if (!value.contains('@')) {
                                return l10n.loginEmailInvalid;
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          _SourceDropdown(
                            value: _source,
                            onChanged: (v) => setState(() => _source = v),
                          ),
                          const SizedBox(height: 12),
                          // Mas'ul tanlash (avvalroq yuklanadi)
                          FutureBuilder<List<AssignableUser>>(
                            future: ref.read(assignableUsersProvider.future),
                            builder: (context, snapshot) {
                              final users = snapshot.data ?? const <AssignableUser>[];
                              if (users.isEmpty) {
                                return const SizedBox.shrink();
                              }                               return DropdownButtonFormField<String>(
                                 initialValue: _assignedTo,
                                isExpanded: true,
                                decoration: _dropdownDecoration(
                                  label: l10n.crmAssign,
                                  icon: Icons.person_pin_outlined,
                                ),
                                items: [
                                  // "Bekor qilish" o'rniga aniq ma'no: mas'ulsiz.
                                  DropdownMenuItem(
                                    value: null,
                                    child: Text(
                                      '—',
                                      style: TextStyle(
                                        color: colors.textTertiary,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                  for (final user in users)
                                    DropdownMenuItem(
                                      value: user.id,
                                      child: Text(
                                        user.label,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(fontSize: 14),
                                      ),
                                    ),
                                ],
                                onChanged: (v) =>
                                    setState(() => _assignedTo = v),
                              );
                            },
                          ),
                          const SizedBox(height: 12),
                          GlassTextField(
                            controller: _notesController,
                            labelText: l10n.crmNotes,
                            hintText: 'Izoh...',
                            prefixIcon: Icons.notes_outlined,
                            maxLines: 3,
                            textInputAction: TextInputAction.newline,
                          ),
                          const SizedBox(height: 20),
                          GlassButton(
                            onPressed: _saving ? null : _submit,
                            borderRadius: 16,
                            backgroundColor: context.dsColors.accent,
                            isLoading: _saving,
                            child: Text(
                              l10n.crmSave,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  InputDecoration _dropdownDecoration({
    required String label,
    required IconData icon,
  }) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, size: 20),
      isDense: true,
      filled: true,
      fillColor: Theme.of(context).colorScheme.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: context.dsColors.border.withValues(alpha: 0.5)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: context.dsColors.border.withValues(alpha: 0.5)),
      ),
    );
  }
}

/// Lead manbasi tanlash dropdown'i.
class _SourceDropdown extends StatelessWidget {
  final LeadSource value;
  final ValueChanged<LeadSource> onChanged;

  const _SourceDropdown({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return DropdownButtonFormField<LeadSource>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: context.l10n.crmSource,
        prefixIcon: const Icon(Icons.alt_route_outlined, size: 20),
        isDense: true,
        filled: true,
        fillColor: Theme.of(context).colorScheme.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide:
              BorderSide(color: context.dsColors.border.withValues(alpha: 0.5)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide:
              BorderSide(color: context.dsColors.border.withValues(alpha: 0.5)),
        ),
      ),
      items: [
        for (final source in LeadSource.values)
          DropdownMenuItem(
            value: source,
            child: Text(
              _sourceLabel(source),
              style: TextStyle(fontSize: 14, color: colors.textPrimary),
            ),
          ),
      ],
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
    );
  }
}

String _sourceLabel(LeadSource source) => switch (source) {
      LeadSource.instagram => 'Instagram',
      LeadSource.telegram => 'Telegram',
      LeadSource.referral => 'Referral',
      LeadSource.walkIn => 'Walk-in',
      LeadSource.website => 'Veb-sayt',
      LeadSource.other => 'Boshqa',
    };
