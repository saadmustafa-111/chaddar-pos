'use client';

import { StageStatusDot } from './StageStatusDot';

export interface StageDefinition {
  key: string;
  label: string;
  description: string;
}

export type StageStatus = 'completed' | 'current' | 'upcoming';

interface Props {
  stages: StageDefinition[];
  currentKey: string;
  completedKeys: string[];
  onSelect?: (key: string) => void;
  className?: string;
}

/**
 * Premium 5-step stepper used at the top of the coil detail page. Each
 * step has a dot, a label and a connecting line. The current step gets a
 * soft pulse, completed steps get a green tick, upcoming steps are muted.
 *
 * Clicking a completed step asks the parent to scroll/focus that stage
 * (so the operator can quickly review / edit any earlier work).
 */
export function LifecycleStepper({
  stages,
  currentKey,
  completedKeys,
  onSelect,
  className,
}: Props) {
  return (
    <nav
      aria-label="Coil workflow"
      className={`bg-[#141A22] border border-zinc-800 rounded-2xl p-4 md:p-5 ${
        className ?? ''
      }`}
    >
      <ol className="flex items-center gap-2 md:gap-3">
        {stages.map((stage, index) => {
          const isCurrent = stage.key === currentKey;
          const isCompleted = completedKeys.includes(stage.key);
          const status: StageStatus = isCompleted
            ? 'completed'
            : isCurrent
              ? 'current'
              : 'upcoming';
          const interactive = (isCompleted || isCurrent) && !!onSelect;

          return (
            <li
              key={stage.key}
              className="flex-1 min-w-0 flex items-center gap-2 md:gap-3"
            >
              <button
                type="button"
                disabled={!interactive}
                onClick={() => interactive && onSelect?.(stage.key)}
                className={`group flex items-center gap-2 md:gap-3 min-w-0 ${
                  interactive ? 'cursor-pointer' : 'cursor-default'
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 rounded-lg`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <StageStatusDot state={status} />
                <div className="min-w-0 flex-1 text-left">
                  <div
                    className={`text-[11px] font-medium uppercase tracking-wider truncate ${
                      isCurrent
                        ? 'text-zinc-100'
                        : isCompleted
                          ? 'text-zinc-300'
                          : 'text-zinc-500'
                    }`}
                  >
                    Step {index + 1}
                  </div>
                  <div
                    className={`text-sm font-medium truncate ${
                      isCurrent
                        ? 'text-zinc-100'
                        : isCompleted
                          ? 'text-zinc-200 group-hover:text-zinc-100'
                          : 'text-zinc-500'
                    }`}
                  >
                    {stage.label}
                  </div>
                </div>
              </button>

              {index < stages.length - 1 && (
                <div
                  aria-hidden
                  className={`hidden md:block h-px flex-1 ${
                    isCompleted ? 'bg-green-500/40' : 'bg-zinc-800'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
