const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/web/src/pages/TelegramWebApp.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `  const rewardsQ = useQuery<RewardItem[]>({
    queryKey: ['tg-student-rewards'],
    queryFn: async () => {
      const res = (await request(\`/gamification/rewards\`\)) as { items?: RewardItem[] };
      return itemsOf<RewardItem>(res);
    },
    staleTime: 120_000,
    retry: false,
  });`;

const replacement1 = `  const rewardsQ = useQuery<RewardItem[]>({
    queryKey: ['tg-student-rewards'],
    queryFn: async () => {
      const res = (await request(\`/gamification/rewards\`\)) as { items?: RewardItem[] };
      return itemsOf<RewardItem>(res);
    },
    staleTime: 120_000,
    retry: false,
  });

  const arenaQ = useQuery<{
    profile: {
      rating: number;
      wins: number;
      winStreak: number;
      activeAvatar?: { name: string; title: string; thumbnailUrl: string };
      activeTitle?: { name: string; icon: string };
    };
  }>({
    queryKey: ['tg-student-arena-profile'],
    queryFn: () => request('/arena/profiles/me'),
    staleTime: 60_000,
    retry: false,
  });`;

const target2 = `      <Surface tone="purple" className="p-5">
        <CardHead
          icon={I.sparkles}
          tone="purple"
          title="So'nggi yutuqlar"`;

const replacement2 = `      {/* Mind Arena 3D Avatar Profile Widget */}
      <Surface className="p-4 border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-purple-950/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-2xl bg-black/60 border border-cyan-500/40 flex items-center justify-center overflow-hidden p-1 shadow-[0_0_15px_rgba(0,242,254,0.25)]">
              <img
                src={arenaQ.data?.profile?.activeAvatar?.thumbnailUrl || '/avatars/arena/cyber-scholar/thumbnail.png'}
                alt={arenaQ.data?.profile?.activeAvatar?.name || 'Avatar'}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Mind Arena Qahramoni</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-extrabold">3D</span>
              </div>
              <h4 className="text-sm font-extrabold text-white">
                {arenaQ.data?.profile?.activeAvatar?.name || 'Cyber Scholar'}
              </h4>
              {arenaQ.data?.profile?.activeTitle && (
                <p className="text-[11px] text-purple-300 font-semibold flex items-center gap-1">
                  <span>{arenaQ.data.profile.activeTitle.icon}</span>
                  <span>{arenaQ.data.profile.activeTitle.name}</span>
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-slate-400 font-semibold">Duel Reyting</div>
            <div className="text-base font-black text-amber-400">⚡ {arenaQ.data?.profile?.rating ?? 1000}</div>
            <a
              href="/arena"
              className="mt-1 inline-block text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline"
            >
              Studiyaga kirish ➔
            </a>
          </div>
        </div>
      </Surface>

      <Surface tone="purple" className="p-5">
        <CardHead
          icon={I.sparkles}
          tone="purple"
          title="So'nggi yutuqlar"`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedT1 = target1.replace(/\r\n/g, '\n');
const normalizedT2 = target2.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedT1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
if (!normalizedContent.includes(normalizedT2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}

let updated = normalizedContent.replace(normalizedT1, replacement1.replace(/\r\n/g, '\n'));
updated = updated.replace(normalizedT2, replacement2.replace(/\r\n/g, '\n'));

const finalContent = updated.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log('Successfully updated TelegramWebApp.tsx with Mind Arena widget!');
