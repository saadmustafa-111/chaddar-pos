'use client';

import {
  Coil,
  FinishedCostSummary as FinishedCost,
} from '../api/coils';
import { formatPaisa, formatWeight } from '../../shared/utils/format';

interface Props {
  coil: Coil;
  finishedCost: FinishedCost;
  isLoading?: boolean;
}

interface Row {
  label: string;
  value: string;
  emphasis?: boolean;
  positive?: boolean;
}

export function FinishedCostSummaryCard({
  coil,
  finishedCost,
  isLoading,
}: Props) {
  const remainingUsable = finishedCost.remainingUsableWeightKg;

  const rows: Row[] = [
    {
      label: 'Purchase Cost',
      value: formatPaisa(finishedCost.purchaseCostPaisa),
    },
    {
      label: '+ Additional Expenses',
      value: formatPaisa(finishedCost.additionalExpensesPaisa),
    },
    {
      label: '= Total Invested Cost',
      value: formatPaisa(finishedCost.totalInvestedCostPaisa),
      emphasis: true,
    },
    {
      label: 'Original / Processed Weight',
      value: formatWeight(finishedCost.originalWeightKg),
    },
    {
      label: '− Wastage',
      value: formatWeight(finishedCost.wastageWeightKg),
    },
    {
      label: 'Remaining Usable Weight',
      value: formatWeight(remainingUsable),
      emphasis: true,
    },
  ];

  const ready = remainingUsable > 0 && finishedCost.totalInvestedCostPaisa > 0;

  return (
    <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            Finished Cost Summary
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Actual cost per usable KG, ready for cutting / chaddar production.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">
            Coil
          </div>
          <div className="text-sm font-medium text-zinc-100 mt-0.5">
            {coil.code}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-500 py-4 text-center">Loading...</div>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  row.emphasis ? 'bg-zinc-800/60 border border-zinc-700' : ''
                }`}
              >
                <span
                  className={`text-xs ${
                    row.emphasis ? 'text-zinc-200 font-medium' : 'text-zinc-500'
                  }`}
                >
                  {row.label}
                </span>
                <span
                  className={`${
                    row.emphasis
                      ? 'text-sm font-semibold text-zinc-100'
                      : 'text-sm font-medium text-zinc-200'
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div
              className={`rounded-xl p-4 ${
                ready
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-zinc-800/40 border border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300 uppercase tracking-wide">
                  Actual Finished Cost / KG
                </span>
                {ready ? (
                  <span className="text-xs text-green-400 font-medium">
                    Ready
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">Pending</span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-semibold ${
                    ready ? 'text-green-400' : 'text-zinc-500'
                  }`}
                >
                  {ready
                    ? formatPaisa(finishedCost.finishedCostPerKgPaisa)
                    : '—'}
                </span>
                {ready && (
                  <span className="text-xs text-zinc-400">/ KG</span>
                )}
              </div>
              {!ready && (
                <p className="text-xs text-zinc-500 mt-2">
                  Add at least one additional expense and record processing
                  wastage to compute the finished cost.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}