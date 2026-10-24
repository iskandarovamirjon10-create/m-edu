import { memo } from 'react';

export type AuroraVariant = 'default' | 'corporate' | 'subtle' | 'security' | 'playful';

export interface AuroraMeshProps {
  variant?: AuroraVariant;
  opacity?: number;
  className?: string;
}

const VARIANTS: Record<
  AuroraVariant,
  {
    orb1: string;
    orb2: string;
    orb3: string;
  }
> = {
  default: {
    orb1: 'from-rose-500/12 via-orange-500/8 to-transparent dark:from-rose-600/16 dark:via-orange-600/10',
    orb2: 'from-amber-500/12 via-indigo-500/8 to-transparent dark:from-amber-600/16 dark:via-indigo-600/10',
    orb3: 'from-cyan-500/10 via-blue-500/6 to-transparent dark:from-cyan-600/14 dark:via-blue-600/10',
  },
  corporate: {
    orb1: 'from-blue-500/12 via-indigo-500/8 to-transparent dark:from-blue-600/16 dark:via-indigo-600/10',
    orb2: 'from-cyan-500/10 via-teal-500/8 to-transparent dark:from-cyan-600/14 dark:via-teal-600/10',
    orb3: 'from-violet-500/10 via-purple-500/6 to-transparent dark:from-violet-600/14 dark:via-purple-600/10',
  },
  subtle: {
    orb1: 'from-slate-400/10 via-zinc-400/6 to-transparent dark:from-slate-600/12 dark:via-zinc-600/8',
    orb2: 'from-blue-400/8 via-slate-400/6 to-transparent dark:from-blue-600/10 dark:via-slate-600/8',
    orb3: 'from-indigo-400/8 via-cyan-400/5 to-transparent dark:from-indigo-600/10 dark:via-cyan-600/8',
  },
  security: {
    orb1: 'from-emerald-500/12 via-teal-500/8 to-transparent dark:from-emerald-600/16 dark:via-teal-600/10',
    orb2: 'from-cyan-500/12 via-blue-500/8 to-transparent dark:from-cyan-600/16 dark:via-blue-600/10',
    orb3: 'from-amber-500/10 via-emerald-500/6 to-transparent dark:from-amber-600/14 dark:via-emerald-600/10',
  },
  playful: {
    orb1: 'from-fuchsia-500/14 via-pink-500/9 to-transparent dark:from-fuchsia-600/18 dark:via-pink-600/12',
    orb2: 'from-amber-500/12 via-rose-500/8 to-transparent dark:from-amber-600/16 dark:via-rose-600/10',
    orb3: 'from-violet-500/12 via-purple-500/8 to-transparent dark:from-violet-600/16 dark:via-purple-600/10',
  },
};

export const AuroraMesh = memo(function AuroraMesh({
  variant = 'default',
  opacity,
  className = '',
}: AuroraMeshProps) {
  const v = VARIANTS[variant] ?? VARIANTS.default;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
      style={opacity !== undefined ? { opacity } : undefined}
    >
      <div
        className={`absolute -left-[10%] -top-[15%] h-[560px] w-[560px] rounded-full bg-gradient-to-br ${v.orb1} blur-[120px]`}
      />
      <div
        className={`absolute -right-[10%] top-[30%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl ${v.orb2} blur-[120px]`}
      />
      <div
        className={`absolute bottom-[-15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr ${v.orb3} blur-[110px]`}
      />
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
});

export default AuroraMesh;
