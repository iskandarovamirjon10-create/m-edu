import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketBaseUrl } from '@/lib/socketUrl';
import { useAuth } from '@/auth/AuthContext';

export interface DuelMatchedPlayer {
  studentId: string;
  name: string;
  avatarUrl: string;
  titleName?: string;
  titleIcon?: string;
  rating: number;
  isBot?: boolean;
}

export interface DuelMatchedPayload {
  roomId: string;
  mode: string;
  subjectCategory: string;
  difficulty: string;
  totalRounds: number;
  players: DuelMatchedPlayer[];
}

export interface RoundStartedPayload {
  roundNumber: number;
  totalRounds: number;
  timeLimitSec: number;
  scores?: Record<string, number>;
  question: {
    questionText: string;
    codeSnippet?: string | null;
    codeLanguage?: string | null;
    imageUrl?: string | null;
    options: Array<{ optionKey: string; optionText: string }>;
  };
}

export interface RoundEndedAnswer {
  studentId: string;
  name: string;
  avatarUrl: string;
  selectedKey: string | null;
  isCorrect: boolean;
  scoreEarned: number;
  speedBonus: number;
  timeSpentMs: number;
  totalScore: number;
}

export interface RoundEndedPayload {
  roundNumber: number;
  correctOptionKey: string;
  explanation: string;
  answers: RoundEndedAnswer[];
}

export interface DuelFinishedPayload {
  roomId: string;
  isDraw: boolean;
  winnerId: string | null;
  players?: Array<{
    studentId: string;
    name: string;
    avatarUrl: string;
    totalScore?: number;
    correctCount?: number;
    ratingDelta?: number;
    newRating?: number;
    xpEarned?: number;
    coinsEarned?: number;
    newTitleUnlocked?: { name: string; icon: string } | null;
  }>;
  results: Array<{
    studentId: string;
    name: string;
    avatarUrl: string;
    isWinner: boolean;
    isDraw: boolean;
    totalScore: number;
    correctCount: number;
    ratingDelta: number;
    newRating: number;
    xpEarned: number;
    coinsEarned: number;
    newTitleUnlocked?: { name: string; icon: string } | null;
  }>;
  roundsHistory?: Array<{
    roundNumber: number;
    questionText: string;
    codeSnippet?: string | null;
    codeLanguage?: string | null;
    options: Array<{ optionKey: string; optionText: string }>;
    correctOptionKey: string;
    explanation: string;
    answers: RoundEndedAnswer[];
  }>;
}

export function useArenaBattleSocket() {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState<
    'IDLE' | 'SEARCHING' | 'MATCHED'
  >('IDLE');
  const [searchSeconds, setSearchSeconds] = useState(0);

  const [currentMatch, setCurrentMatch] = useState<DuelMatchedPayload | null>(null);
  const [currentRound, setCurrentRound] = useState<RoundStartedPayload | null>(null);
  const [roundTimeLeft, setRoundTimeLeft] = useState(15);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [opponentHasAnswered, setOpponentHasAnswered] = useState(false);
  const [roundResult, setRoundResult] = useState<RoundEndedPayload | null>(null);
  const [duelFinishResult, setDuelFinishResult] = useState<DuelFinishedPayload | null>(null);
  const [latestReaction, setLatestReaction] = useState<{
    studentId: string;
    name: string;
    emoji: string;
    timestamp: number;
  } | null>(null);
  const [rematchRequestedBy, setRematchRequestedBy] = useState<{
    fromStudentId: string;
    fromName: string;
  } | null>(null);
  const [isRematchWaiting, setIsRematchWaiting] = useState(false);

  // Premium Power-Ups & Custom Room States
  const [disabledOptionKeys, setDisabledOptionKeys] = useState<string[]>([]);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [powerUpsUsed, setPowerUpsUsed] = useState<{
    fiftyFifty: boolean;
    addTime: boolean;
    hint: boolean;
  }>({ fiftyFifty: false, addTime: false, hint: false });
  const [roundsHistory, setRoundsHistory] = useState<any[]>([]);
  const [customRoomCode, setCustomRoomCode] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const searchTimerRef = useRef<any>(null);
  const roundStartTimeRef = useRef<number>(0);

  // Initialize Socket connection
  useEffect(() => {
    if (!isAuthenticated) return;

    const baseUrl = getSocketBaseUrl();
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';

    const socket = io(`${baseUrl}/arena`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // 1. Duel Matched
    socket.on('duel_matched', (data: DuelMatchedPayload) => {
      setMatchmakingStatus('MATCHED');
      setCurrentMatch(data);
      setDuelFinishResult(null);
      setRoundResult(null);
      setCurrentRound(null);
      setDisabledOptionKeys([]);
      setActiveHint(null);
      setPowerUpsUsed({ fiftyFifty: false, addTime: false, hint: false });
      setRoundsHistory([]);
      setCustomRoomCode(null);
      socket.emit('join_room', { roomId: data.roomId });
    });

    // 2. Round Started
    socket.on('round_started', (data: RoundStartedPayload) => {
      setCurrentRound(data);
      setRoundResult(null);
      setSelectedOptionKey(null);
      setHasAnswered(false);
      setOpponentHasAnswered(false);
      setDisabledOptionKeys([]);
      setActiveHint(null);
      setRoundTimeLeft(data.timeLimitSec);
      roundStartTimeRef.current = Date.now();

      // Start countdown timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRoundTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    // 3. Opponent Answered indicator
    socket.on('player_answered', (data: { studentId: string }) => {
      if (data.studentId !== user?.id) {
        setOpponentHasAnswered(true);
      }
    });

    // 4. Round Ended
    socket.on('round_ended', (data: RoundEndedPayload) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setRoundResult(data);
    });

    // 5. Duel Finished
    socket.on('duel_finished', (data: DuelFinishedPayload) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setDuelFinishResult(data);
      setRoundsHistory(data.roundsHistory || []);
      setCurrentRound(null);
    });

    // 6. Live Reaction / Emote Received
    let reactionTimer: ReturnType<typeof setTimeout> | null = null;
    socket.on('reaction_received', (data: { studentId: string; name: string; emoji: string; timestamp: number }) => {
      setLatestReaction(data);
      if (reactionTimer) clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => {
        setLatestReaction((curr) => (curr?.timestamp === data.timestamp ? null : curr));
      }, 3200);
    });

    // 7. Rematch Request & Accept
    socket.on('rematch_requested', (data: { fromStudentId: string; fromName: string; roomId: string }) => {
      if (data.fromStudentId !== user?.id) {
        setRematchRequestedBy({ fromStudentId: data.fromStudentId, fromName: data.fromName });
      }
    });

    socket.on('rematch_accepted', (data: { oldRoomId: string; newRoomId: string }) => {
      setIsRematchWaiting(false);
      setRematchRequestedBy(null);
      setDuelFinishResult(null);
      setRoundResult(null);
      setCurrentRound(null);
      setDisabledOptionKeys([]);
      setActiveHint(null);
      setPowerUpsUsed({ fiftyFifty: false, addTime: false, hint: false });
      socket.emit('join_room', { roomId: data.newRoomId });
    });

    // 8. Server Time Extension (Power-Up)
    socket.on('round_time_extended', (data: { studentId: string; addedSec: number }) => {
      setRoundTimeLeft((prev) => prev + data.addedSec);
    });

    // 9. Custom Room Matched
    socket.on('custom_room_matched', (data: { roomId: string }) => {
      setCustomRoomCode(null);
      setMatchmakingStatus('MATCHED');
      socket.emit('join_room', { roomId: data.roomId });
    });

    return () => {
      if (reactionTimer) clearTimeout(reactionTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
      socket.disconnect();
    };
  }, [isAuthenticated, user?.id]);

  // Join matchmaking queue
  const joinQueue = useCallback(
    (subjectCategory = 'MATHEMATICS', difficulty = 'MEDIUM', mode = 'SOLO_1V1') => {
      if (!socketRef.current) return;

      setMatchmakingStatus('SEARCHING');
      setSearchSeconds(0);
      setCurrentMatch(null);
      setDuelFinishResult(null);

      socketRef.current.emit(
        'join_queue',
        { subjectCategory, difficulty, mode },
        (res: any) => {
          if (res?.success) {
            if (searchTimerRef.current) clearInterval(searchTimerRef.current);
            searchTimerRef.current = setInterval(() => {
              setSearchSeconds((s) => s + 1);
            }, 1000);
          }
        },
      );
    },
    [],
  );

  // Leave matchmaking queue
  const leaveQueue = useCallback(() => {
    if (!socketRef.current) return;
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);

    socketRef.current.emit('leave_queue');
    setMatchmakingStatus('IDLE');
    setSearchSeconds(0);
  }, []);

  // Submit answer for active round
  const submitAnswer = useCallback(
    (optionKey: string) => {
      if (!socketRef.current || !currentMatch || hasAnswered) return;

      const timeSpentMs = Date.now() - roundStartTimeRef.current;
      setSelectedOptionKey(optionKey);
      setHasAnswered(true);

      socketRef.current.emit('submit_round_answer', {
        roomId: currentMatch.roomId,
        selectedKey: optionKey,
        timeSpentMs,
      });
    },
    [currentMatch, hasAnswered],
  );

  // Surrender duel
  const surrenderDuel = useCallback(() => {
    if (!socketRef.current || !currentMatch) return;
    socketRef.current.emit('surrender_duel', { roomId: currentMatch.roomId });
  }, [currentMatch]);

  // Send rapid emote / reaction during duel
  const sendReaction = useCallback(
    (emoji: string) => {
      if (!socketRef.current || !currentMatch) return;
      socketRef.current.emit('send_reaction', {
        roomId: currentMatch.roomId,
        emoji,
      });
    },
    [currentMatch],
  );

  // Request rematch with the same player
  const requestRematch = useCallback(() => {
    if (!socketRef.current || !currentMatch) return;
    setIsRematchWaiting(true);
    socketRef.current.emit('request_rematch', { roomId: currentMatch.roomId });
  }, [currentMatch]);

  // Accept incoming rematch
  const acceptRematch = useCallback(() => {
    if (!socketRef.current || !currentMatch) return;
    socketRef.current.emit('accept_rematch', { roomId: currentMatch.roomId });
  }, [currentMatch]);

  // Use Tactical Cyber Power-Up
  const usePowerUp = useCallback(
    (type: 'FIFTY_FIFTY' | 'ADD_TIME' | 'HINT') => {
      if (!socketRef.current || !currentMatch) return Promise.resolve(null);
      return new Promise<any>((resolve) => {
        socketRef.current?.emit(
          'use_power_up',
          { roomId: currentMatch.roomId, type },
          (res: any) => {
            if (res?.success) {
              if (type === 'FIFTY_FIFTY') {
                setDisabledOptionKeys(res.removedKeys || []);
                setPowerUpsUsed((p) => ({ ...p, fiftyFifty: true }));
              } else if (type === 'ADD_TIME') {
                setRoundTimeLeft((prev) => prev + (res.addedSec || 5));
                setPowerUpsUsed((p) => ({ ...p, addTime: true }));
              } else if (type === 'HINT') {
                setActiveHint(res.hint || null);
                setPowerUpsUsed((p) => ({ ...p, hint: true }));
              }
            }
            resolve(res);
          },
        );
      });
    },
    [currentMatch],
  );

  // Create Private 1v1 Room with 6-Digit Code
  const createCustomRoom = useCallback(
    (subjectCategory = 'MATHEMATICS', difficulty = 'MEDIUM') => {
      if (!socketRef.current) return Promise.resolve(null);
      return new Promise<string>((resolve) => {
        socketRef.current?.emit(
          'create_custom_room',
          { subjectCategory, difficulty },
          (res: any) => {
            if (res?.success) {
              setCustomRoomCode(res.roomCode);
              resolve(res.roomCode);
            }
          },
        );
      });
    },
    [],
  );

  // Join Private 1v1 Room with Code
  const joinCustomRoom = useCallback((roomCode: string) => {
    if (!socketRef.current) return Promise.resolve(null);
    return new Promise<any>((resolve) => {
      socketRef.current?.emit('join_custom_room', { roomCode }, (res: any) => {
        resolve(res);
      });
    });
  }, []);

  // Reset to idle
  const resetBattle = useCallback(() => {
    setCurrentMatch(null);
    setCurrentRound(null);
    setRoundResult(null);
    setDuelFinishResult(null);
    setMatchmakingStatus('IDLE');
    setSelectedOptionKey(null);
    setHasAnswered(false);
    setLatestReaction(null);
    setRematchRequestedBy(null);
    setIsRematchWaiting(false);
    setDisabledOptionKeys([]);
    setActiveHint(null);
    setPowerUpsUsed({ fiftyFifty: false, addTime: false, hint: false });
    setRoundsHistory([]);
    setCustomRoomCode(null);
  }, []);

  return {
    isConnected,
    matchmakingStatus,
    searchSeconds,
    currentMatch,
    currentRound,
    roundTimeLeft,
    selectedOptionKey,
    hasAnswered,
    opponentHasAnswered,
    roundResult,
    duelFinishResult,
    latestReaction,
    rematchRequestedBy,
    isRematchWaiting,
    disabledOptionKeys,
    activeHint,
    powerUpsUsed,
    roundsHistory,
    customRoomCode,
    joinQueue,
    leaveQueue,
    submitAnswer,
    sendReaction,
    requestRematch,
    acceptRematch,
    usePowerUp,
    createCustomRoom,
    joinCustomRoom,
    surrenderDuel,
    resetBattle,
  };
}
