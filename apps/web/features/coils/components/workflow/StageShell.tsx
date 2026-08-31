'use client';

import { ReactNode } from 'react';

interface Props {
  /** Tiny number above the title, e.g. "Step 3". */
  stepNumber?: string;
  /** Stage headline (e.g. "Cutting"). */
  title: string;
  /** One-sentence description shown under the title. */
  description?: string;
  /** Optional pill chip rendered next to the title. */
  badge?: ReactNode;
  /** Important values block — render above the form. */
  values?: ReactNode;
  /** The form / main content. */
  children: ReactNode;
  /** Single primary action, usually a Complete button. */
  primaryAction?: ReactNode;
  /** Secondary action next to primary, e.g. Skip. */
  secondaryAction?: ReactNode;
  /** Optional helper text under the primary button. */
  helper?: ReactNode;
}

/**
 * The shared shell for any stage in the coil workflow.
 *
 *   [step label]  [title]            [status badge]
 *   one-line description ...
 *
 *   ┌── important values block ──┐
 *   └─────────────────────────────┘
 *
 *   ┌── main form / content ──────┐
 *   └─────────────────────────────┘
 *
 *   [secondary]                              [primary Complete]
 *   helper note (optional)
 */
export function StageShell({
  stepNumber,
  title,
  description,
  badge,
  values,
  children,
  primaryAction,
  secondaryAction,
  helper,
}: Props) {
  return (
    <section
      aria-label={title}
      className="bg-gradient-to-b from-[#141A22] to-[#10141A] border border-zinc-800/80 rounded-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] overflow-hidden"
    >
      <header className="px-6 pt-6 pb-5 border-b border-zinc-800/70">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {stepNumber && <span>{stepNumber}</span>}
              {badge && <span>{badge}</span>}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-sm text-zinc-400 max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        {values && <div className="mt-5">{values}</div>}
      </header>

      <div className="px-6 py-6">{children}</div>

      {(primaryAction || helper) && (
        <footer className="px-6 py-4 bg-[#0D1117]/60 border-t border-zinc-800/70 flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs text-zinc-500">{helper}</div>
          <div className="flex items-center gap-2">
            {secondaryAction}
            {primaryAction}
          </div>
        </footer>
      )}
    </section>
  );
}
