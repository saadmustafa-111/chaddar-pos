'use client';

import { ReactNode } from 'react';
import { Spinner } from './ConfirmDialog';

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-[#0B0F14] border border-red-500/30 rounded-xl p-4">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}

export function InlineWarn({ children }: { children: ReactNode }) {
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
      <div className="text-sm text-yellow-400">{children}</div>
    </div>
  );
}

export function InlineInfo({ children }: { children: ReactNode }) {
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
      <div className="text-sm text-blue-400">{children}</div>
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-8 flex items-center justify-center gap-3 text-sm text-zinc-500">
      <Spinner className="w-4 h-4" />
      <span>{message}</span>
    </div>
  );
}