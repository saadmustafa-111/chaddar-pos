'use client';

import { ReactNode } from 'react';

export function DataTable({
  headers,
  children,
  empty,
  isLoading,
  loadingMessage = 'Loading...',
}: {
  headers: { label: string; align?: 'left' | 'right' | 'center'; className?: string }[];
  children?: ReactNode;
  empty?: ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
}) {
  if (isLoading) {
    return (
      <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-8 text-center text-sm text-zinc-500">
        {loadingMessage}
      </div>
    );
  }
  return (
    <div className="bg-[#141A22] border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-[#0D1117]">
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider ${
                    h.align === 'right'
                      ? 'text-right'
                      : h.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  } ${h.className ?? ''}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          {children}
        </table>
      </div>
      {empty}
    </div>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-zinc-800/60 last:border-b-0 align-top ${
        onClick ? 'hover:bg-zinc-800/30 cursor-pointer' : ''
      }`}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = 'left',
  className,
  colSpan,
}: {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-4 py-3 text-sm ${
        align === 'right'
          ? 'text-right'
          : align === 'center'
            ? 'text-center'
            : 'text-left'
      } ${className ?? ''}`}
    >
      {children}
    </td>
  );
}