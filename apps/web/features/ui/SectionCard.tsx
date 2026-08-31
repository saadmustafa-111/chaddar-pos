'use client';

import { ReactNode } from 'react';

export function SectionCard({
  title,
  description,
  actions,
  children,
  padded = true,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="bg-[#141A22] border border-zinc-800 rounded-xl">
      {(title || description || actions) && (
        <div
          className={`flex flex-col md:flex-row md:items-start md:justify-between gap-3 ${
            padded ? 'p-6' : 'px-6 pt-6'
          } border-b border-zinc-800`}
        >
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            {description && (
              <p className="text-sm text-zinc-400 mt-1.5 max-w-xl">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatRow({
  label,
  value,
  emphasis,
  valueClass,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
        emphasis ? 'bg-zinc-800/60 border border-zinc-700' : ''
      }`}
    >
      <span
        className={`text-xs ${
          emphasis ? 'text-zinc-200 font-medium' : 'text-zinc-500'
        }`}
      >
        {label}
      </span>
      <span
        className={`${
          emphasis
            ? 'text-sm font-semibold text-zinc-100'
            : 'text-sm font-medium text-zinc-200'
        } ${valueClass ?? ''}`}
      >
        {value}
      </span>
    </div>
  );
}

export function SummaryTile({
  label,
  value,
  variant = 'default',
  helper,
}: {
  label: string;
  value: ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'highlight';
  helper?: ReactNode;
}) {
  const variantClasses = {
    default: 'bg-[#0D1117] border border-zinc-800 text-zinc-100',
    highlight: 'bg-zinc-800/70 border border-zinc-700 text-zinc-100',
    success: 'bg-green-500/10 border border-green-500/30 text-green-400',
    danger: 'bg-red-500/10 border border-red-500/30 text-red-400',
  } as const;

  const valueClasses = {
    default: 'text-sm font-medium text-zinc-100',
    highlight: 'text-base font-semibold text-zinc-100',
    success: 'text-2xl font-semibold text-green-400',
    danger: 'text-2xl font-semibold text-red-400',
  } as const;

  return (
    <div className={`rounded-lg px-4 py-3 ${variantClasses[variant]}`}>
      <div
        className={`text-xs ${
          variant === 'success'
            ? 'text-green-400'
            : variant === 'danger'
              ? 'text-red-400'
              : 'text-zinc-500'
        }`}
      >
        {label}
      </div>
      <div className={`mt-1 ${valueClasses[variant]}`}>{value}</div>
      {helper && <div className="text-xs text-zinc-500 mt-1">{helper}</div>}
    </div>
  );
}