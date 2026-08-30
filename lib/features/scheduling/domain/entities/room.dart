import 'package:equatable/equatable.dart';

/// Xona holati.
enum RoomStatus { available, occupied, maintenance }

/// Xona entity'si (spec §6 #20).
///
/// Xona ma'lumotlarini saqlaydi:
/// - Xona nomi/kodi
/// - Sig'im
/// - Joylashuv
/// - Jihozlar
class Room extends Equatable {
  /// Xonaning yagona identifikatori.
  final String roomId;

  /// Xona nomi (masalan, "101-xona", "A block - 205").
  final String name;

  /// Xona kodi (qisqa).
  final String? code;

  /// Sig'im (odamlar soni).
  final int capacity;

  /// Joylashuv (bino, qavat).
  final String? location;

  /// Xona holati.
  final RoomStatus status;

  /// Jihozlar (masalan, ["proektor", "konditsioner", "doska"]).
  final List<String> amenities;

  /// Rasmi (fayl yo'li).
  final String? photoPath;

  /// Izoh.
  final String? notes;

  /// Sinxronlash versiyasi.
  final int syncVersion;

  const Room({
    required this.roomId,
    required this.name,
    this.code,
    required this.capacity,
    this.location,
    this.status = RoomStatus.available,
    this.amenities = const [],
    this.photoPath,
    this.notes,
    this.syncVersion = 1,
  });

  bool get isAvailable => status == RoomStatus.available;
  bool get isOccupied => status == RoomStatus.occupied;

  @override
  List<Object?> get props => [
        roomId,
        name,
        code,
        capacity,
        location,
        status,
        amenities,
        photoPath,
        notes,
        syncVersion,
      ];
}
