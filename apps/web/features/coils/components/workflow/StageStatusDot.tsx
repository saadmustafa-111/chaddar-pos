'use client';

interface Props {
  /** "completed" (green), "current" (zinc with ring), "upcoming" (muted). */
  state: 'completed' | 'current' | 'upcoming';
  size?: 'sm' | 'md';
}

export function StageStatusDot({ state, size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  if (state === 'completed') {
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center bg-green-500/15 text-green-400 ring-1 ring-green-500/30`}
      >
        <svg
          className={iconSize}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  }
  if (state === 'current') {
    return (
      <div
        className={`relative ${sizeClass} rounded-full flex items-center justify-center bg-zinc-100 text-zinc-900 ring-2 ring-zinc-100/30`}
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full ring-2 ring-zinc-100/20 animate-ping"
        />
        <span className="relative text-xs font-semibold">●</span>
      </div>
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center bg-zinc-800/70 text-zinc-500 ring-1 ring-zinc-800`}
    >
      <span className="text-xs font-medium">○</span>
    </div>
  );
}
