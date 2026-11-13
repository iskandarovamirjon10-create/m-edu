import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy,
  Crown,
  Sparkles,
  Swords,
  CheckCircle2,
  Users,
  Loader2,
} from 'lucide-react';
import request from '@/lib/api';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useTelegram } from '@/hooks/useTelegram';
import '@/styles/arena-liquid.css';

interface RealGroupItem {
  id: string;
  name: string;
  course?: { name: string };
  teacher?: { user?: { firstName: string; lastName: string } };
  capacity?: number;
  enrollments?: Array<{ id: string; studentId: string }>;
  _count?: { enrollments: number };
}

interface RealLeaderboardEntry {
  studentId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
}

export function ArenaTournamentsHub() {
  const { playSuccess, playTick } = usePremiumSound();
  const { haptic } = useTelegram();

  const [activeTab, setActiveTab] = useState<'STANDINGS' | 'BRACKET'>('STANDINGS');
  const [registeredGroupIds, setRegisteredGroupIds] = useState<string[]>([]);

  // 1. Fetch real groups from organization
  const { data: groupsData, isLoading: groupsLoading } = useQuery<RealGroupItem[] | { items: RealGroupItem[] }>({
    queryKey: ['arena-tournaments-real-groups'],
    queryFn: () => request('/groups'),
    staleTime: 60_000,
  });

  // 2. Fetch live duel leaderboard to compute real group ELO
  const { data: leaderboardData } = useQuery<RealLeaderboardEntry[]>({
    queryKey: ['arena-tournaments-real-leaderboard'],
    queryFn: () => request('/arena/profiles/leaderboard?limit=50'),
    staleTime: 60_000,
  });

  const groupsList = useMemo<RealGroupItem[]>(() => {
    if (!groupsData) return [];
    return Array.isArray(groupsData) ? groupsData : groupsData.items;
  }, [groupsData]);

  // Aggregate real group statistics
  const cohortStandings = useMemo(() => {
    const studentRatingMap = new Map<string, number>();
    const studentWinsMap = new Map<string, number>();

    (leaderboardData || []).forEach((entry) => {
      studentRatingMap.set(entry.studentId, entry.rating);
      studentWinsMap.set(entry.studentId, entry.wins);
    });

    return groupsList.map((g, idx) => {
      const studentCount = g.enrollments?.length ?? g._count?.enrollments ?? 0;
      let totalRating = 0;
      let totalWins = 0;
      let ratedStudents = 0;

      if (g.enrollments && g.enrollments.length > 0) {
        g.enrollments.forEach((e) => {
          const r = studentRatingMap.get(e.studentId);
          if (r !== undefined) {
            totalRating += r;
            ratedStudents++;
          }
          const w = studentWinsMap.get(e.studentId);
          if (w !== undefined) totalWins += w;
        });
      }

      const avgElo = ratedStudents > 0 ? Math.round(totalRating / ratedStudents) : 1000;
      const weeklyPoints = totalWins * 30 + studentCount * 10;
      const winRate = totalWins > 0 ? Math.min(95, Math.round(50 + (avgElo - 1000) / 20)) : 50;

      return {
        rank: idx + 1,
        id: g.id,
        name: g.name,
        courseName: g.course?.name || 'Umumiy Ta’lim',
        teacherName: g.teacher?.user ? `${g.teacher.user.firstName} ${g.teacher.user.lastName}` : null,
        studentsCount: studentCount,
        averageRating: avgElo,
        totalWins,
        winRate,
        weeklyPoints,
        isRegistered: registeredGroupIds.includes(g.id),
      };
    }).sort((a, b) => b.weeklyPoints - a.weeklyPoints).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }, [groupsList, leaderboardData, registeredGroupIds]);

  const handleRegisterGroup = (groupId: string) => {
    playSuccess();
    haptic('celebration');
    setRegisteredGroupIds((prev) => [...prev, groupId]);
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          HEADER BANNER
      ===================================================================== */}
      <div className="arena-glass rounded-3xl p-6 border border-purple-500/25 dark:border-purple-500/30 shadow-md relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full arena-inset text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-500/20">
              <Trophy className="w-3.5 h-3.5 text-purple-500" />
              <span>Haqiqiy Tashkilot Sinflari va Guruhlari</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Guruhlar Turniri & Sinflar Ligasi V2
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              O‘quv markazingiz yoki maktabingizdagi haqiqiy guruhlararo intellektual chempionat. Har bir o‘quvchining 1v1 dueldagi g‘alabasi sinfning umumiy reytingiga hissa qo‘shadi!
            </p>
          </div>

          {/* Tournament Cup Countdown */}
          <div className="p-4 sm:p-5 rounded-2xl arena-inset text-center border border-black/[0.06] dark:border-white/10 shrink-0 min-w-[210px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Haftalik Oltin Kubok
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              Yakshanba 18:00
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Mukofot: 500 M-Coin & Kubok
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-black/[0.06] dark:border-white/10">
          <div className="inline-flex p-1 rounded-2xl arena-inset">
            <button
              onClick={() => {
                playTick();
                setActiveTab('STANDINGS');
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'STANDINGS'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Guruhlar Jadvali ({cohortStandings.length})</span>
            </button>

            <button
              onClick={() => {
                playTick();
                setActiveTab('BRACKET');
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'BRACKET'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Pley-off To‘ri (Bracket)</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: COHORT STANDINGS TABLE
      ===================================================================== */}
      {activeTab === 'STANDINGS' && (
        <div className="space-y-4">
          {groupsLoading ? (
            <div className="p-12 text-center arena-glass rounded-3xl border border-black/[0.06] dark:border-white/10 space-y-3">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Guruhlar ro‘yxati yuklanmoqda...
              </p>
            </div>
          ) : cohortStandings.length === 0 ? (
            <div className="p-12 text-center arena-glass rounded-3xl border border-black/[0.06] dark:border-white/10 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center text-2xl shadow-inner">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Hozircha faol guruhlar mavjud emas
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Tashkilot ma’muriyati tomonidan yangi o‘quv guruhlari tashkil etilganda, ular avtomatik ravishda ushbu turnir jadvaliga biriktiriladi.
              </p>
            </div>
          ) : (
            <div className="arena-glass rounded-3xl p-5 border border-black/[0.06] dark:border-white/10 overflow-x-auto shadow-sm">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3">O‘rin</th>
                    <th className="py-3 px-3">Guruh Nomi</th>
                    <th className="py-3 px-3">Kurs & Murabbiy</th>
                    <th className="py-3 px-3 text-center">O‘quvchilar</th>
                    <th className="py-3 px-3 text-center">O‘rtacha ELO</th>
                    <th className="py-3 px-3 text-center">G‘alaba %</th>
                    <th className="py-3 px-3 text-right">Ochko</th>
                    <th className="py-3 px-3 text-center">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/5 font-medium">
                  {cohortStandings.map((c) => {
                    const medal =
                      c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : `#${c.rank}`;

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-purple-50/40 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-base text-slate-700 dark:text-slate-300">
                          {medal}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-xs">
                              {c.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span>{c.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 text-xs">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {c.courseName}
                          </div>
                          {c.teacherName && (
                            <div className="text-[10px] text-slate-400">{c.teacherName}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {c.studentsCount} ta
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-amber-500">
                          ⚡ {c.averageRating}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {c.winRate}%
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                          +{c.weeklyPoints} pts
                        </td>
                        <td className="py-3 px-3 text-center">
                          {c.isRegistered ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Ro‘yxatda
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRegisterGroup(c.id)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
                            >
                              Yozilish
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: PLAYOFF BRACKET VIEW
      ===================================================================== */}
      {activeTab === 'BRACKET' && (
        <div className="arena-glass rounded-3xl p-6 border border-black/[0.06] dark:border-white/10 space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Haftalik Turnir Pley-off To‘ri
            </h3>
            <p className="text-xs text-slate-400">Tashkilotning yetakchi guruhlari o‘rtasidagi hal qiluvchi bahs</p>
          </div>

          {cohortStandings.length >= 2 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Semi-finals */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block text-center">
                  Yetakchi Juftlik
                </span>

                <div className="p-3.5 rounded-2xl arena-inset border border-blue-500/30 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white">
                    <span>⚡ {cohortStandings[0]?.name || 'Guruh A'}</span>
                    <span className="font-mono text-emerald-500">
                      {cohortStandings[0]?.averageRating} ELO
                    </span>
                  </div>
                  <div className="h-px bg-black/[0.05] dark:bg-white/10" />
                  <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                    <span>🎯 {cohortStandings[1]?.name || 'Guruh B'}</span>
                    <span className="font-mono">
                      {cohortStandings[1]?.averageRating} ELO
                    </span>
                  </div>
                </div>
              </div>

              {/* Final Match Card */}
              <div className="p-5 rounded-3xl arena-inset border-2 border-amber-500/40 text-center space-y-4 shadow-lg">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-black">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span>KUBOK BAHSI</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>{cohortStandings[0]?.name}</span>
                    <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-mono">
                      {cohortStandings[0]?.averageRating} ELO
                    </span>
                  </div>

                  <div className="text-xs font-black text-slate-400">VS</div>

                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>{cohortStandings[1]?.name}</span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                      {cohortStandings[1]?.averageRating} ELO
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                  Yakshanba 18:00
                </div>
              </div>

              {/* Trophy Display */}
              <div className="text-center space-y-2 p-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 text-white mx-auto flex items-center justify-center text-3xl shadow-xl shadow-amber-500/25">
                  🏆
                </div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white">
                  M-EDU Oltin Kubogi
                </h4>
                <p className="text-[11px] text-slate-400">
                  G‘olib guruh o‘quvchilari uchun maxsus nishon va 500 M-Coin mukofot fondi!
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
              Pley-off to‘ri uchun kamida 2 ta guruh ro‘yxatdan o‘tgan bo‘lishi lozim.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
