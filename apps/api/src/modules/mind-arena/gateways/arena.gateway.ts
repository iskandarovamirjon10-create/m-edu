import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { isAllowedOrigin } from '../../../common/cors.util';
import { ArenaBattleEngineService } from '../services/arena-battle-engine.service';
import { ArenaMatchmakingService } from '../services/arena-matchmaking.service';
import {
  ArenaSubjectCategory,
  DuelMode,
  QuestionDifficulty,
} from '@prisma/client';

export interface AuthenticatedArenaSocket extends Socket {
  studentProfile?: {
    studentId: string;
    userId: string;
    organizationId: string;
    name: string;
    avatarUrl: string;
    titleName?: string;
    titleIcon?: string;
    rating: number;
  };
}

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, success: boolean) => void) =>
      callback(
        null,
        isAllowedOrigin(
          origin,
          (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
        ),
      ),
    credentials: true,
  },
  namespace: '/arena',
})
export class ArenaGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ArenaGateway.name);
  private readonly socketToStudent = new Map<string, string>(); // socketId -> studentId
  private readonly studentToSocket = new Map<string, string>(); // studentId -> socketId

  constructor(
    private readonly battleEngine: ArenaBattleEngineService,
    private readonly matchmaking: ArenaMatchmakingService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    this.logger.log('Mind Arena WebSocket Gateway initialized on namespace /arena');
    // Connect battle engine emitter to socket server
    this.battleEngine.setEmitter((event: string, roomId: string, data: any) => {
      this.server.to(roomId).emit(event, data);
    });
  }

  async handleConnection(client: AuthenticatedArenaSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, { secret });
      const userId = payload.sub;

      // Find student and duel profile
      let student = await this.prisma.student.findFirst({
        where: { userId },
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
          duelProfile: {
            include: {
              activeAvatar: true,
              activeTitle: true,
            },
          },
        },
      });

      if (!student) {
        const userRec = await this.prisma.user.findUnique({ where: { id: userId } });
        if (userRec && userRec.organizationId) {
          student = await this.prisma.student.create({
            data: { userId, organizationId: userRec.organizationId },
            include: {
              user: { select: { firstName: true, lastName: true } },
              duelProfile: { include: { activeAvatar: true, activeTitle: true } },
            },
          });
        }
      }

      if (!student) {
        this.logger.warn(`Unauthorized arena connection: User ${userId} has no student record`);
        client.disconnect();
        return;
      }

      const name = `${student.user.firstName} ${student.user.lastName}`.trim();
      const rating = student.duelProfile?.rating || 1000;
      const avatarUrl =
        student.duelProfile?.activeAvatar?.battleRenderUrl ||
        '/avatars/arena/cyber-scholar/battle.png';

      client.studentProfile = {
        studentId: student.id,
        userId: student.userId,
        organizationId: student.organizationId,
        name,
        avatarUrl,
        titleName: student.duelProfile?.activeTitle?.name || 'Aql Jangchisi',
        titleIcon: student.duelProfile?.activeTitle?.icon || '🎖️',
        rating,
      };

      this.socketToStudent.set(client.id, student.id);
      this.studentToSocket.set(student.id, client.id);

      this.logger.log(`Arena client connected: ${name} (${student.id}, rating: ${rating})`);

      client.emit('connected', {
        success: true,
        studentId: student.id,
        name,
        rating,
        avatarUrl,
      });
    } catch (err: any) {
      this.logger.error(`Arena connection failed: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedArenaSocket) {
    const studentId = this.socketToStudent.get(client.id);
    if (studentId) {
      this.matchmaking.dequeuePlayer(studentId);

      // If the player was in an active match, gracefully forfeit and resolve the duel
      const activeRoom = this.battleEngine.findActiveRoomByStudentId(studentId);
      if (activeRoom) {
        this.logger.log(`Active player ${studentId} disconnected from room ${activeRoom.id}. Auto-forfeiting duel.`);
        this.battleEngine.finishDuel(activeRoom.id, studentId).catch((err: any) => {
          this.logger.error(`Failed to forfeit duel for disconnected player ${studentId}: ${err?.message}`);
        });
      }

      this.studentToSocket.delete(studentId);
      this.socketToStudent.delete(client.id);
    }
    this.logger.log(`Arena client disconnected: ${client.id}`);
  }

  // ==========================================================================
  // CLIENT EVENTS
  // ==========================================================================

  @SubscribeMessage('join_queue')
  async handleJoinQueue(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody()
    body: {
      subjectCategory?: ArenaSubjectCategory;
      difficulty?: QuestionDifficulty;
      mode?: DuelMode;
    },
  ) {
    if (!client.studentProfile) {
      return { success: false, message: 'Avtorizatsiyadan o‘tmagan' };
    }

    const profile = client.studentProfile;
    const subjectCategory = body?.subjectCategory || ArenaSubjectCategory.MATHEMATICS;
    const difficulty = body?.difficulty || QuestionDifficulty.MEDIUM;
    const mode = body?.mode || DuelMode.SOLO_1V1;

    await this.matchmaking.enqueuePlayer({
      studentId: profile.studentId,
      userId: profile.userId,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      titleName: profile.titleName,
      titleIcon: profile.titleIcon,
      rating: profile.rating,
      organizationId: profile.organizationId,
      socketId: client.id,
      subjectCategory,
      difficulty,
      mode,
      joinedAt: Date.now(),
    });

    return {
      success: true,
      status: 'SEARCHING',
      message: 'Raqib qidirilmoqda...',
    };
  }

  @SubscribeMessage('leave_queue')
  handleLeaveQueue(@ConnectedSocket() client: AuthenticatedArenaSocket) {
    if (!client.studentProfile) return { success: false };
    this.matchmaking.dequeuePlayer(client.studentProfile.studentId);
    return { success: true, status: 'IDLE' };
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (body?.roomId) {
      client.join(body.roomId);
      this.logger.log(`Socket ${client.id} joined room ${body.roomId}`);
      return { success: true };
    }
    return { success: false };
  }

  @SubscribeMessage('submit_round_answer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody()
    body: {
      roomId: string;
      selectedKey: string;
      timeSpentMs: number;
    },
  ) {
    if (!client.studentProfile) {
      return { success: false, message: 'Unauthorized' };
    }

    const { roomId, selectedKey, timeSpentMs } = body;
    const studentId = client.studentProfile.studentId;

    return this.battleEngine.submitAnswer(
      roomId,
      studentId,
      selectedKey,
      timeSpentMs,
    );
  }

  @SubscribeMessage('surrender_duel')
  async handleSurrender(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!client.studentProfile) return { success: false };
    const { roomId } = body;
    const studentId = client.studentProfile.studentId;

    await this.battleEngine.finishDuel(roomId, studentId);
    return { success: true };
  }

  @SubscribeMessage('send_reaction')
  handleSendReaction(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody() body: { roomId: string; emoji: string },
  ) {
    if (!client.studentProfile || !body?.roomId || !body?.emoji) return { success: false };
    const { roomId, emoji } = body;
    const studentId = client.studentProfile.studentId;
    const name = client.studentProfile.name;

    this.server.to(roomId).emit('reaction_received', {
      studentId,
      name,
      emoji,
      timestamp: Date.now(),
    });
    return { success: true };
  }

  @SubscribeMessage('request_rematch')
  async handleRequestRematch(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!client.studentProfile || !body?.roomId) return { success: false };
    const { roomId } = body;
    const studentId = client.studentProfile.studentId;

    const room = this.battleEngine.getActiveRoom(roomId);
    if (!room) return { success: false, message: 'Xona topilmadi' };

    const hasBot = room.players.some((p) => p.isBot);
    if (hasBot) {
      // Instantly start a new rematch vs the AI Bot
      try {
        const newRoom = await this.battleEngine.createDuelRoom(
          room.organizationId,
          room.players,
          room.subjectCategory,
          room.difficulty,
          room.mode,
        );
        this.server.to(roomId).emit('rematch_accepted', {
          oldRoomId: roomId,
          newRoomId: newRoom.id,
        });
        return { success: true, instant: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    // Broadcast rematch invitation to room
    this.server.to(roomId).emit('rematch_requested', {
      fromStudentId: studentId,
      fromName: client.studentProfile.name,
      roomId,
    });
    return { success: true };
  }

  @SubscribeMessage('accept_rematch')
  async handleAcceptRematch(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody() body: { roomId: string },
  ) {
    if (!client.studentProfile || !body?.roomId) return { success: false };
    const { roomId } = body;
    const room = this.battleEngine.getActiveRoom(roomId);
    if (!room) return { success: false, message: 'Xona topilmadi' };

    try {
      const newRoom = await this.battleEngine.createDuelRoom(
        room.organizationId,
        room.players,
        room.subjectCategory,
        room.difficulty,
        room.mode,
      );
      this.server.to(roomId).emit('rematch_accepted', {
        oldRoomId: roomId,
        newRoomId: newRoom.id,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  @SubscribeMessage('use_power_up')
  handleUsePowerUp(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody() body: { roomId: string; type: 'FIFTY_FIFTY' | 'ADD_TIME' | 'HINT' },
  ) {
    if (!client.studentProfile || !body?.roomId || !body?.type) {
      return { success: false, message: 'Noto‘g‘ri so‘rov' };
    }
    const { roomId, type } = body;
    const studentId = client.studentProfile.studentId;
    return this.battleEngine.usePowerUp(roomId, studentId, type);
  }

  @SubscribeMessage('create_custom_room')
  handleCreateCustomRoom(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody()
    body: {
      subjectCategory?: ArenaSubjectCategory;
      difficulty?: QuestionDifficulty;
    },
  ) {
    if (!client.studentProfile) return { success: false, message: 'Avtorizatsiyadan o‘tmagan' };
    const p = client.studentProfile;
    const roomCode = this.matchmaking.createCustomRoom({
      studentId: p.studentId,
      userId: p.userId,
      name: p.name,
      avatarUrl: p.avatarUrl,
      titleName: p.titleName,
      titleIcon: p.titleIcon,
      rating: p.rating,
      organizationId: p.organizationId,
      socketId: client.id,
      subjectCategory: body?.subjectCategory || ArenaSubjectCategory.MATHEMATICS,
      difficulty: body?.difficulty || QuestionDifficulty.MEDIUM,
      mode: DuelMode.SOLO_1V1,
      joinedAt: Date.now(),
    });

    client.join(roomCode);
    return { success: true, roomCode };
  }

  @SubscribeMessage('join_custom_room')
  async handleJoinCustomRoom(
    @ConnectedSocket() client: AuthenticatedArenaSocket,
    @MessageBody() body: { roomCode: string },
  ) {
    if (!client.studentProfile || !body?.roomCode) return { success: false, message: 'Kod kiritilmadi' };
    const p = client.studentProfile;
    try {
      const room = await this.matchmaking.joinCustomRoom(
        {
          studentId: p.studentId,
          userId: p.userId,
          name: p.name,
          avatarUrl: p.avatarUrl,
          titleName: p.titleName,
          titleIcon: p.titleIcon,
          rating: p.rating,
          organizationId: p.organizationId,
          socketId: client.id,
          subjectCategory: ArenaSubjectCategory.MATHEMATICS,
          difficulty: QuestionDifficulty.MEDIUM,
          mode: DuelMode.SOLO_1V1,
          joinedAt: Date.now(),
        },
        body.roomCode,
      );

      this.server.to(body.roomCode.toUpperCase().trim()).emit('custom_room_matched', { roomId: room.id });
      return { success: true, roomId: room.id };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, c) => {
        const [key, ...rest] = c.trim().split('=');
        if (key) acc[key] = rest.join('=');
        return acc;
      }, {});
      return cookies['access_token'] || null;
    }
    return null;
  }
}
