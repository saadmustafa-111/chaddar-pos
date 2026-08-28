'use client';

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'green'
    | 'yellow'
    | 'red'
    | 'blue'
    | 'zinc'
    | 'purple';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  green: 'bg-green-500/10 text-green-400',
  yellow: 'bg-yellow-500/10 text-yellow-400',
  red: 'bg-red-500/10 text-red-400',
  blue: 'bg-blue-500/10 text-blue-400',
  zinc: 'bg-zinc-500/10 text-zinc-400',
  purple: 'bg-purple-500/10 text-purple-400',
};

export function StatusBadge({ children, variant = 'zinc' }: BadgeProps) {
  return (
    <span
      className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}