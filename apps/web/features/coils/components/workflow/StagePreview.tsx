'use client';

import { ReactNode } from 'react';
import { StageStatusDot } from './StageStatusDot';

interface Props {
  stepNumber?: string;
  title: string;
  preview?: ReactNode;
  expectations?: string[];
  helper?: ReactNode;
}

/**
 * Locked, low-emphasis preview of an upcoming workflow stage. Used while
 * a previous stage is not yet complete. The user can see what's coming,
 * but no form is rendered to avoid clutter.
 */
export function StagePreview({
  stepNumber,
  title,
  preview,
  expectations,
  helper,
}: Props) {
  return (
    <section className="bg-[#10141A] border border-dashed border-zinc-800 rounded-2xl px-5 py-5 opacity-70">
      <header className="flex items-start gap-4">
        <StageStatusDot state="upcoming" size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {stepNumber && <span>{stepNumber}</span>}
            <span>Upcoming</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-zinc-300">
            {title}
          </h3>
          {preview && (
            <div className="mt-2 text-xs text-zinc-500 max-w-2xl">
              {preview}
            </div>
          )}
          {expectations && expectations.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {expectations.map((line) => (
                <li
                  key={line}
                  className="text-xs text-zinc-500 flex items-start gap-2"
                >
                  <span
                    aria-hidden
                    className="mt-1 w-1 h-1 rounded-full bg-zinc-600 shrink-0"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>
      {helper && (
        <div className="mt-3 pl-11 text-[11px] text-zinc-600">{helper}</div>
      )}
    </section>
  );
}
