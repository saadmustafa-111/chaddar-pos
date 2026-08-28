'use client';

import { ReactNode } from 'react';
import { StageStatusDot } from './StageStatusDot';

interface Props {
  stepNumber?: string;
  title: string;
  description?: string;
  values?: ReactNode;
  children?: ReactNode;
  primaryAction?: ReactNode;
  editable?: boolean;
  onEdit?: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function StageSummary({
  stepNumber,
  title,
  description,
  values,
  children,
  primaryAction,
  editable = false,
  onEdit,
  isOpen = false,
  onToggle,
}: Props) {
  return (
    <section
      className={`bg-[#141A22] border rounded-2xl overflow-hidden transition-colors ${
        isOpen
          ? 'border-zinc-700/80'
          : 'border-zinc-800/80 hover:border-zinc-700/80'
      }`}
    >
      <header className="px-5 py-4 flex items-start gap-4">
        <StageStatusDot state="completed" size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-green-400">
            {stepNumber && <span>{stepNumber}</span>}
            <span>Completed</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-zinc-100">{title}</h3>
          {description && (
            <p className="mt-1 text-xs text-zinc-500 max-w-2xl">
              {description}
            </p>
          )}
          {values && <div className="mt-3">{values}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {primaryAction}
          {editable && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs text-zinc-100 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
          {children && onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              className="text-xs text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors inline-flex items-center gap-1"
            >
              {isOpen ? 'Hide details' : 'Show details'}
              <svg
                className={`w-3 h-3 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
        </div>
      </header>

      {isOpen && children && (
        <div className="px-5 pb-5 border-t border-zinc-800/80">
          <div className="pt-5">{children}</div>
        </div>
      )}
    </section>
  );
}
