export function AppleSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const bars = Array.from({ length: 12 });
  const dim = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-9 h-9' : 'w-6 h-6';

  return (
    <div className={`relative ${dim} shrink-0`} aria-hidden="true">
      {bars.map((_, i) => (
        <span
          key={i}
          className="absolute left-[45%] top-[10%] h-[28%] w-[10%] rounded-full bg-current opacity-[0.16] animate-apple-spin"
          style={{
            transform: `rotate(${i * 30}deg)`,
            transformOrigin: '50% 140%',
            animationDelay: `-${((12 - i) * (1 / 12)).toFixed(3)}s`,
          }}
        />
      ))}
    </div>
  );
}
