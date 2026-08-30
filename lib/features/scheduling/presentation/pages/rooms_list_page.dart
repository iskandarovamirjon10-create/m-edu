import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../application/commands/create_room_command.dart';
import '../../domain/entities/room.dart';
import '../providers/schedule_providers.dart';

/// Xonalar ro'yxati sahifasi (spec §6 #20).
class RoomsListPage extends ConsumerWidget {
  const RoomsListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(roomListProvider);
    final availableCount = ref.watch(availableRoomCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Xonalar'),
        actions: [
          IconButton(
            tooltip: 'Yangi xona',
            icon: const Icon(Icons.add),
            onPressed: () => _showCreateRoomDialog(context, ref),
          ),
        ],
      ),
      body: Column(
        children: [
          // Stats
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: context.dsColors.success.withValues(alpha: 0.1),
                border:
                    Border.all(color: context.dsColors.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.meeting_room,
                      color: context.dsColors.success, size: 20),
                  SizedBox(width: 8),
                  Text(
                    "Bo'sh xonalar: ${availableCount.valueOrNull ?? 0}",
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: context.dsColors.success,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Rooms list
          Expanded(
            child: roomsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Text('Xato: $error',
                    style: TextStyle(color: context.dsColors.error)),
              ),
              data: (rooms) {
                if (rooms.isEmpty) {
                  return _EmptyRooms(
                    onCreate: () => _showCreateRoomDialog(context, ref),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: rooms.length,
                  itemBuilder: (context, index) => _RoomCard(
                    room: rooms[index],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showCreateRoomDialog(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CreateRoomSheet(ref: ref),
    );
  }
}

class _RoomCard extends StatelessWidget {
  final Room room;

  const _RoomCard({required this.room});

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (room.status) {
      RoomStatus.available => context.dsColors.success,
      RoomStatus.occupied => context.dsColors.warning,
      RoomStatus.maintenance => context.dsColors.error,
    };

    final statusLabel = switch (room.status) {
      RoomStatus.available => 'Bo\'sh',
      RoomStatus.occupied => 'Band',
      RoomStatus.maintenance => 'Ta\'mir',
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: context.dsColors.surface,
        border: Border.all(
          color: context.dsColors.border.withValues(alpha: 0.5),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: context.dsColors.divider.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
            spreadRadius: -6,
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              Icons.meeting_room,
              color: statusColor,
              size: 28,
            ),
          ),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  room.name,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textPrimary,
                  ),
                ),
                SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      'Sig\'im: ${room.capacity}',
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.textSecondary,
                      ),
                    ),
                    if (room.location != null) ...[
                      SizedBox(width: 8),
                      Text(
                        room.location!,
                        style: TextStyle(
                          fontSize: 12,
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
                if (room.amenities.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: room.amenities.take(3).map((amenity) {
                      return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: context.dsColors.accent.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          amenity,
                          style: TextStyle(
                            fontSize: 10,
                            color: context.dsColors.accent,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              statusLabel,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: statusColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyRooms extends StatelessWidget {
  final VoidCallback onCreate;

  const _EmptyRooms({required this.onCreate});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                gradient: context.dsColors.accentGradient,
                borderRadius: BorderRadius.circular(28),
              ),
              child: Icon(Icons.meeting_room, size: 44, color: Colors.white),
            ),
            SizedBox(height: 24),
            Text(
              'Hali xonalar yo\'q',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Birinchi xonani yarating — dars jadvalini tuzish uchun zarur.',
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onCreate,
              icon: const Icon(Icons.add),
              label: const Text('Xona qo\'shish'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CreateRoomSheet extends StatefulWidget {
  final WidgetRef ref;

  const _CreateRoomSheet({required this.ref});

  @override
  State<_CreateRoomSheet> createState() => _CreateRoomSheetState();
}

class _CreateRoomSheetState extends State<_CreateRoomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _capacityController = TextEditingController(text: '20');
  final _locationController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _capacityController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
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
              SizedBox(height: 20),
              Text(
                'Yangi xona',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              const SizedBox(height: 20),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Xona nomi *',
                  hintText: 'masalan, 101-xona',
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Xona nomi kiritilishi shart';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _capacityController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Sig\'im *',
                  hintText: '20',
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Sig\'im kiritilishi shart';
                  }
                  final n = int.tryParse(value);
                  if (n == null || n <= 0) {
                    return 'Musbat son kiriting';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _locationController,
                decoration: const InputDecoration(
                  labelText: 'Joylashuv',
                  hintText: 'masalan, A blok, 2-qavat',
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submit,
                  child: const Text('Saqlash'),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    try {
      await widget.ref.read(createRoomCommandProvider).execute(
            CreateRoomRequest(
              name: _nameController.text.trim(),
              capacity: int.parse(_capacityController.text),
              location: _locationController.text.trim().isEmpty
                  ? null
                  : _locationController.text.trim(),
            ),
          );

      widget.ref.invalidate(roomListVersionProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Xato: $e'), backgroundColor: context.dsColors.error),
        );
      }
    }
  }
}
