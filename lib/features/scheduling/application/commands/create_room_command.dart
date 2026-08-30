import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/room.dart';
import '../../domain/events/schedule_events.dart';
import '../../domain/repositories/schedule_repository.dart';

/// Yangi xona yaratish uchun so'rov.
class CreateRoomRequest {
  final String name;
  final String? code;
  final int capacity;
  final String? location;
  final List<String> amenities;
  final String? notes;

  const CreateRoomRequest({
    required this.name,
    this.code,
    required this.capacity,
    this.location,
    this.amenities = const [],
    this.notes,
  });
}

/// `CreateRoom` command'i.
class CreateRoomCommand {
  final ScheduleRepository _repository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): xona boshqaruvi — jadval moduli.
  final UserRole actorRole;

  CreateRoomCommand({
    required ScheduleRepository repository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _eventBus = eventBus;

  Future<Room> execute(CreateRoomRequest request) async {
    Permissions.require(actorRole, AppPermission.scheduleCreate);
    _validate(request);

    final room = Room(
      roomId: _generateRoomId(),
      name: request.name.trim(),
      code: request.code?.trim().toUpperCase(),
      capacity: request.capacity,
      location: request.location,
      amenities: request.amenities,
      notes: request.notes,
    );

    final saved = await _repository.saveRoom(room);

    _eventBus.publish(RoomCreatedEvent(
      room: saved,
      occurredAt: DateTime.now(),
    ));

    return saved;
  }

  void _validate(CreateRoomRequest request) {
    if (request.name.trim().isEmpty) {
      throw const ValidationFailure('Xona nomi kiritilishi shart');
    }
    if (request.capacity <= 0) {
      throw const ValidationFailure('Sig\'im musbat son bo\'lishi shart');
    }
  }

  String _generateRoomId() {
    final random = Random();
    return 'ROOM-${random.nextInt(99999).toString().padLeft(5, '0')}';
  }
}
