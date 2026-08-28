'use client';

import Link from 'next/link';
import { Coil } from '../../api/coils';
import { PriceCategoryBadge } from '../../../price-categories/components/PriceCategoryBadge';
import { formatPaisa, formatWeight } from '../../../shared/utils/format';

interface Props {
  coil: Coil;
  totalAdditionalExpensesPaisa: number;
  isLoadingExpenses: boolean;
  /** Breakdown of where the original coil weight has gone. All values
   * are in KG; the header sums them and the source-of-truth remaining
   * field to make audits trivial. */
  breakdown: {
    usedInCuttingKg: number;
    movedToPlaneKg: number;
    wastageKg: number;
  };
  onMoveToPlane?: () => void;
}

const statusColors: Record<string, string> = {
  RAW: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30',
  IN_PROCESS: 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/30',
  FINISHED: 'bg-green-500/10 text-green-400 ring-1 ring-green-500/30',
  DEPLETED: 'bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/30',
};

export function CoilSummaryHeader({
  coil,
  totalAdditionalExpensesPaisa,
  isLoadingExpenses,
  breakdown,
  onMoveToPlane,
}: Props) {
  const coilSpec = [
    coil.materialFamily?.name,
    coil.thicknessMm ? `${Number(coil.thicknessMm).toFixed(3)} mm` : null,
    coil.width ? `${Number(coil.width).toFixed(3)} mm` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const totalCoilCost =
    Number(coil.purchaseAmountPaisa) + totalAdditionalExpensesPaisa;

  const depleted = Number(coil.currentWeight) <= 0.0005;

  return (
    <header className="bg-gradient-to-b from-[#141A22] to-[#10141A] border border-zinc-800/80 rounded-2xl px-6 py-5">
      <Link
        href="/inventory/raw-coils"
        className="text-sm text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1.5 mb-3"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Inventory
      </Link>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
              {coil.code}
            </h1>
            {coil.status && (
              <span
                className={`inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full uppercase tracking-wide ${
                  statusColors[coil.status] ?? statusColors.RAW
                }`}
              >
                {coil.status.replace('_', ' ')}
              </span>
            )}
          </div>
          {coilSpec && (
            <p className="mt-1.5 text-sm text-zinc-300">{coilSpec}</p>
          )}
          {coil.supplier && (
            <p className="mt-1 text-xs text-zinc-500">
              Supplier: {coil.supplier.name}
            </p>
          )}
          <div className="mt-2">
            <PriceCategoryBadge
              category={coil.priceCategory ?? null}
              showSellingRate
            />
          </div>
        </div>

        <div className="space-y-3">
          <dl className="grid grid-cols-3 gap-4 md:text-right md:min-w-[26rem]">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Current Weight
              </dt>
              <dd className="mt-1 text-base font-semibold text-zinc-100">
                {formatWeight(Number(coil.currentWeight))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Purchase Cost
              </dt>
              <dd className="mt-1 text-base font-medium text-zinc-200">
                {formatPaisa(Number(coil.purchaseAmountPaisa))}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
                Coil Cost (so far)
              </dt>
              <dd className="mt-1 text-base font-semibold text-zinc-100">
                {isLoadingExpenses ? '…' : formatPaisa(totalCoilCost)}
              </dd>
            </div>
          </dl>

          {onMoveToPlane && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onMoveToPlane}
                disabled={depleted}
                title={
                  depleted
                    ? 'Coil is depleted, nothing to move'
                    : 'Set aside some of the coil weight into Plane Stock'
                }
                className="text-sm bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7h18M3 12h18M3 17h12"
                  />
                </svg>
                Move to Plane
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <BreakdownTile
          label="In Cutting"
          value={formatWeight(breakdown.usedInCuttingKg)}
        />
        <BreakdownTile
          label="In Plane"
          value={formatWeight(breakdown.movedToPlaneKg)}
        />
        <BreakdownTile
          label="Wastage / Scrap"
          value={formatWeight(breakdown.wastageKg)}
        />
        <BreakdownTile
          label="Remaining"
          value={formatWeight(Number(coil.currentWeight))}
          highlight
        />
      </div>
    </header>
  );
}

function BreakdownTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2.5 border ${
        highlight
          ? 'bg-zinc-800/70 border-zinc-700'
          : 'bg-[#0D1117] border-zinc-800'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-1 text-sm ${
          highlight ? 'text-base font-semibold text-zinc-100' : 'font-medium text-zinc-200'
        }`}
      >
        {value}
      </div>
    </div>
  );
}