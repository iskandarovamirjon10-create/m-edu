import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import 'package:m_edu/features/settings/domain/repositories/settings_repository.dart';
/// Sozlamalar o'qish operatsiyalari (CQRS queries).
class SettingsQueries {
  final SettingsRepository _repository;

  SettingsQueries({required SettingsRepository repository})
      : _repository = repository;

  Future<AppSettings> getSettings() => _repository.getSettings();

  Future<List<AppUser>> fetchUsers() => _repository.fetchUsers();

  Future<List<Subject>> fetchSubjects() => _repository.fetchSubjects();
}
