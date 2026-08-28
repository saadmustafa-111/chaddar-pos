'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DashboardSummary,
  DASHBOARD_RANGES,
  DashboardRange,
  dashboardApi,
  dashboardRangeLabels,
} from '../../../features/dashboard/api/dashboard';
import { useHideAmounts } from '../../../features/dashboard/components/useHideAmounts';
import { DualLineChart } from '../../../features/dashboard/components/DualLineChart';
import {
  ErrorBanner,
  EmptyState,
} from '../../../features/ui';
import {
  formatDate,
  formatPaisa,
  formatWeight,
} from '../../../features/shared/utils/format';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/* ------------------------------------------------------------------ */
/* Money value — consistent formatter for all cards                    */
/* ------------------------------------------------------------------ */

function MoneyValue({
  paisa,
  hide,
  className,
}: {
  paisa: number;
  hide: boolean;
  className?: string;
}) {
  if (hide) {
    return (
      <span className={className ?? 'text-2xl font-semibold text-zinc-500 tabular-nums'}>
        ••••••
      </span>
    );
  }
  return (
    <span className={className ?? 'text-2xl font-semibold text-zinc-100 tabular-nums'}>
      {formatPaisa(paisa)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Range picker                                                        */
/* ------------------------------------------------------------------ */

function RangePicker({
  value,
  onChange,
}: {
  value: DashboardRange;
  onChange: (next: DashboardRange) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-[#0D1117] p-0.5">
      {DASHBOARD_RANGES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
              active
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {dashboardRangeLabels[r]}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Eye / privacy toggle                                                */
/* ------------------------------------------------------------------ */

function EyeButton({
  hide,
  onToggle,
}: {
  hide: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hide}
      title={hide ? 'Show financial values' : 'Hide financial values'}
      className="text-zinc-300 hover:text-zinc-100 bg-[#0D1117] hover:bg-zinc-800 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
    >
      {hide ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      )}
      {hide ? 'Show' : 'Hide'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Primary KPI card                                                    */
/* All four primary cards share an identical fixed-height structure.   */
/* Badge (if present) is always top-right — never shifts the amount.  */
/* ------------------------------------------------------------------ */

function PrimaryKpiCard({
  title,
  amount,
  hide,
  accent,
  helper,
  href,
  icon,
  badge,
}: {
  title: string;
  amount: number;
  hide: boolean;
  accent: string;
  helper?: string;
  href?: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  const card = (
    <div className="relative bg-[#111827] border border-zinc-800 rounded-2xl px-4 py-4 flex items-start gap-3 hover:border-zinc-700 transition-colors h-full">
      {/* Badge — top-right */}
      {badge && (
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 whitespace-nowrap">
            {badge}
          </span>
        </div>
      )}

      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-[#0D1117] border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-300 mt-0.5">
        {icon}
      </div>

      {/* Content — fixed column structure, always reserves same space */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Label */}
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mb-1">
          {title}
        </div>

        {/* Amount — single line, smaller refined size */}
        <div className="min-h-[28px] flex items-center">
          <MoneyValue
            paisa={amount}
            hide={hide}
            className={`text-xl font-semibold ${accent} leading-none tracking-tight`}
          />
        </div>

        {/* Helper text — always rendered to reserve vertical space */}
        <div className="min-h-[18px] text-[11px] text-zinc-500 leading-snug mt-0.5">
          {helper ?? ''}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full">{card}</Link>;
  }
  return card;
}

/* ------------------------------------------------------------------ */
/* Secondary KPI card                                                  */
/* Identical structure to PrimaryKpiCard but visually quieter.         */
/* ------------------------------------------------------------------ */

function SecondaryKpiCard({
  title,
  amount,
  hide,
  accent,
  helper,
  href,
  icon,
  badge,
}: {
  title: string;
  amount: number;
  hide: boolean;
  accent?: string;
  helper?: string;
  href?: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  const card = (
    <div className="relative bg-[#0F1420] border border-zinc-800/70 rounded-xl px-4 py-4 flex items-start gap-3 hover:border-zinc-700 transition-colors h-full">
      {badge && (
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 whitespace-nowrap">
            {badge}
          </span>
        </div>
      )}
      <div className="w-8 h-8 rounded-lg bg-[#0D1117] border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400 mt-0.5">
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mb-1">
          {title}
        </div>
        <div className="min-h-[24px] flex items-center">
          <MoneyValue
            paisa={amount}
            hide={hide}
            className={`text-lg font-semibold ${accent ?? 'text-zinc-100'}`}
          />
        </div>
        <div className="min-h-[18px] text-[11px] text-zinc-500 leading-snug truncate mt-0.5">
          {helper ?? ''}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full">{card}</Link>;
  }
  return card;
}

/* ------------------------------------------------------------------ */
/* Stat tile — compact, used in Today snapshot                        */
/* ------------------------------------------------------------------ */

function StatTile({
  label,
  amount,
  hide,
  accent,
  helper,
}: {
  label: string;
  amount: number;
  hide: boolean;
  accent?: string;
  helper?: string;
}) {
  return (
    <div className="bg-[#0F1420] border border-zinc-800/70 rounded-xl px-4 py-4 flex items-center gap-3">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mb-1.5">
          {label}
        </div>
        <MoneyValue
          paisa={amount}
          hide={hide}
          className={`text-lg font-semibold ${accent ?? 'text-zinc-100'}`}
        />
      </div>
      {helper && (
        <div className="text-[11px] text-zinc-500 text-right shrink-0 leading-snug">
          {helper}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chart skeleton                                                      */
/* ------------------------------------------------------------------ */

function ChartSkeleton() {
  return (
    <div className="h-56 rounded-xl bg-[#0D1117] border border-zinc-800 animate-pulse" />
  );
}

/* ------------------------------------------------------------------ */
/* Inline icons                                                        */
/* ------------------------------------------------------------------ */

function SalesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m0-10c1.11 0 2.08.402 2.599 1M12 6c-1.11 0-2.08.402-2.599 1" />
    </svg>
  );
}

function ProfitIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function ExpenseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function ReceivableIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PayableIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m0-10c1.11 0 2.08.402 2.599 1M12 6c-1.11 0-2.08.402-2.599 1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>('30d');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { hide, toggle } = useHideAmounts();

  const load = useCallback(async (r: DashboardRange) => {
    setIsLoading(true);
    setError('');
    try {
      const data = await dashboardApi.getSummary(r);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const timeSeriesPoints = useMemo(() => {
    if (!summary) return [];
    return summary.timeSeries.map((p) => ({
      label: p.label,
      primary: p.salesPaisa,
      secondary: p.profitPaisa,
    }));
  }, [summary]);

  const totalKg = summary
    ? summary.inventory.rawCoilKg +
      summary.inventory.finishedStockKg +
      summary.inventory.planeStockKg
    : 0;

  const isFirstLoad = isLoading && !summary;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {summary
              ? `${dashboardRangeLabels[summary.range]} · ${formatDate(summary.rangeStart)} – ${formatDate(summary.rangeEnd)}`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RangePicker value={range} onChange={setRange} />
          <EyeButton hide={hide} onToggle={toggle} />
        </div>
      </header>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && !isFirstLoad && <ErrorBanner message={error} />}

      {/* ── 1. Primary KPIs ─────────────────────────────────────── */}
      {/* All four cards share identical height and internal structure */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <PrimaryKpiCard
          title="Total Sales"
          amount={summary?.kpis.totalSalesPaisa ?? 0}
          hide={hide}
          accent="text-zinc-100"
          icon={<SalesIcon />}
          helper={
            summary
              ? `${summary.kpis.totalSalesCount} invoices`
              : undefined
          }
          href="/sales"
        />

        <PrimaryKpiCard
          title="Gross Profit"
          amount={summary?.kpis.totalProfitPaisa ?? 0}
          hide={hide}
          accent={
            (summary?.kpis.totalProfitPaisa ?? 0) >= 0
              ? 'text-green-400'
              : 'text-red-400'
          }
          icon={<ProfitIcon />}
          badge={
            summary && summary.kpis.totalSalesPaisa > 0
              ? `${((summary.kpis.totalProfitPaisa / summary.kpis.totalSalesPaisa) * 100).toFixed(1)}%`
              : undefined
          }
          helper={
            summary?.kpis.totalSalesPaisa
              ? 'Revenue minus COGS'
              : 'No sales yet'
          }
        />

        <PrimaryKpiCard
          title="Expenses"
          amount={summary?.kpis.totalExpensesPaisa ?? 0}
          hide={hide}
          accent="text-red-400"
          icon={<ExpenseIcon />}
          badge={
            summary && summary.kpis.periodExpensesPaisa > 0
              ? formatPaisa(summary.kpis.periodExpensesPaisa)
              : undefined
          }
          helper="Operating expenses (excl. COGS)"
          href="/expenses"
        />

        <PrimaryKpiCard
          title="Net Profit"
          amount={summary?.kpis.netProfitPaisa ?? 0}
          hide={hide}
          accent={
            (summary?.kpis.netProfitPaisa ?? 0) >= 0
              ? 'text-emerald-400'
              : 'text-red-500'
          }
          icon={<ProfitIcon />}
          helper="Gross profit minus expenses"
        />
      </section>

      {/* ── 2. Secondary financial overview ─────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SecondaryKpiCard
          title="Receivables"
          amount={summary?.kpis.totalReceivablePaisa ?? 0}
          hide={hide}
          accent={
            (summary?.kpis.totalReceivablePaisa ?? 0) > 0
              ? 'text-yellow-400'
              : 'text-zinc-100'
          }
          icon={<ReceivableIcon />}
          helper={
            summary
              ? `${summary.receivables.customersWithBalance} customers with balance`
              : undefined
          }
          href="/customers"
        />
        <SecondaryKpiCard
          title="Payables"
          amount={summary?.kpis.totalPayablePaisa ?? 0}
          hide={hide}
          accent={
            (summary?.kpis.totalPayablePaisa ?? 0) > 0
              ? 'text-orange-400'
              : 'text-zinc-100'
          }
          icon={<PayableIcon />}
          helper={
            summary
              ? `${summary.payables.suppliersWithBalance} suppliers with balance`
              : undefined
          }
          href="/procurement/suppliers"
        />
        <SecondaryKpiCard
          title="Inventory Value"
          amount={summary?.kpis.inventoryValuePaisa ?? 0}
          hide={hide}
          accent="text-zinc-100"
          icon={<InventoryIcon />}
          helper={
            summary
              ? `${totalKg.toFixed(1)} kg total · Raw · Finished · Plane`
              : undefined
          }
          href="/inventory"
        />
      </section>

      {/* ── 3. Today snapshot ───────────────────────────────────── */}
      <section>
        <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium mb-3 px-1">
          Today
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile
            label="Today's Sales"
            amount={summary?.kpis.todaysSalesPaisa ?? 0}
            hide={hide}
            accent="text-zinc-100"
            helper={
              summary
                ? `${summary.kpis.todaysSalesCount} invoice${summary.kpis.todaysSalesCount !== 1 ? 's' : ''}`
                : undefined
            }
          />
          <StatTile
            label="Today's Profit"
            amount={summary?.kpis.todaysProfitPaisa ?? 0}
            hide={hide}
            accent={
              (summary?.kpis.todaysProfitPaisa ?? 0) >= 0
                ? 'text-green-400'
                : 'text-red-400'
            }
            helper={formatDate(todayIso())}
          />
          <StatTile
            label="Cash Received"
            amount={summary?.kpis.totalReceivedPaisa ?? 0}
            hide={hide}
            accent="text-green-400"
            helper="Lifetime customer payments"
          />
        </div>
      </section>

      {/* ── 4. Charts ───────────────────────────────────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Sales vs Gross Profit */}
        <div className="xl:col-span-2 bg-[#0F1420] border border-zinc-800/80 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Sales vs Gross Profit
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {summary
                  ? `${dashboardRangeLabels[summary.range]} · ${formatDate(summary.rangeStart)} – ${formatDate(summary.rangeEnd)}`
                  : dashboardRangeLabels[range]}
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-zinc-400 inline-block" />
                Sales
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-green-500 inline-block" />
                Gross Profit
              </span>
            </div>
          </div>
          {isFirstLoad ? (
            <ChartSkeleton />
          ) : timeSeriesPoints.length === 0 ? (
            <div className="h-56 flex items-center justify-center">
              <EmptyState
                title="No sales yet"
                description="Daily trends will appear here once sales are recorded."
              />
            </div>
          ) : (
            <DualLineChart
              points={timeSeriesPoints}
              primaryLabel="Sales"
              secondaryLabel="Gross Profit"
              hideValues={hide}
            />
          )}
        </div>

        {/* Inventory Snapshot */}
        <div className="bg-[#0F1420] border border-zinc-800/80 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-100 mb-1">
            Inventory Snapshot
          </h2>
          <p className="text-xs text-zinc-500 mb-5">Total active stock</p>

          {isFirstLoad ? (
            <ChartSkeleton />
          ) : (
            <>
              <div className="text-center mb-5 pb-5 border-b border-zinc-800">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                  Total Stock
                </div>
                {hide ? (
                  <span className="text-2xl font-bold text-zinc-500 tabular-nums">
                    ••••••
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-zinc-100 tabular-nums">
                    {formatWeight(totalKg)}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm text-zinc-300">Raw Coil</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-100 tabular-nums">
                    {hide ? '••••' : formatWeight(summary?.inventory.rawCoilKg ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-zinc-300">Finished</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-100 tabular-nums">
                    {hide ? '••••' : formatWeight(summary?.inventory.finishedStockKg ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-sm text-zinc-300">Plane</span>
                  </div>
                  <span className="text-sm font-medium text-zinc-100 tabular-nums">
                    {hide ? '••••' : formatWeight(summary?.inventory.planeStockKg ?? 0)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── 5. Recent Sales + Top Customers/Suppliers ─────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent Sales */}
        <div className="xl:col-span-2 bg-[#0F1420] border border-zinc-800/80 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-zinc-100">Recent Sales</h2>
            <Link
              href="/sales"
              className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              View all →
            </Link>
          </div>

          {isFirstLoad ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={`sk-${i}`}
                  className="h-10 rounded-lg bg-[#0D1117] border border-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : summary?.recentSales.length ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-zinc-600 border-b border-zinc-800">
                    <th className="text-left font-medium pb-2 pr-4">Sale</th>
                    <th className="text-left font-medium pb-2 pr-4">Customer</th>
                    <th className="text-right font-medium pb-2 pr-4">Total</th>
                    <th className="text-right font-medium pb-2 pr-4">Paid</th>
                    <th className="text-right font-medium pb-2">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentSales.map((s) => (
                    <tr key={s.id} className="border-t border-zinc-800/60">
                      <td className="py-2.5 pr-4 text-zinc-100 font-mono text-xs">
                        {s.code}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-300 truncate max-w-[160px]">
                        {s.customerName ?? (
                          <span className="text-zinc-600">Walk-in</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <MoneyValue
                          paisa={s.totalAmountPaisa}
                          hide={hide}
                          className="text-sm font-medium text-zinc-100"
                        />
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <MoneyValue
                          paisa={s.paidAmountPaisa}
                          hide={hide}
                          className="text-sm font-medium text-green-400"
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <MoneyValue
                          paisa={s.dueAmountPaisa}
                          hide={hide}
                          className={`text-sm font-medium ${
                            s.dueAmountPaisa > 0 ? 'text-yellow-400' : 'text-zinc-600'
                          }`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No recent sales"
              description="New sales will appear here as they are recorded."
            />
          )}
        </div>

        {/* Top Customers + Suppliers */}
        <div className="bg-[#0F1420] border border-zinc-800/80 rounded-2xl p-6 space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium mb-3">
              Top Customers
            </div>
            {summary?.receivables.top.length ? (
              <ul className="space-y-2.5">
                {summary.receivables.top.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-zinc-200 truncate">{c.name}</span>
                    <MoneyValue
                      paisa={c.outstandingPaisa}
                      hide={hide}
                      className="text-sm font-medium text-yellow-400 shrink-0 tabular-nums"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-zinc-600">No outstanding customers.</div>
            )}
          </div>

          <div className="border-t border-zinc-800" />

          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium mb-3">
              Top Suppliers
            </div>
            {summary?.payables.top.length ? (
              <ul className="space-y-2.5">
                {summary.payables.top.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-zinc-200 truncate">{s.name}</span>
                    <MoneyValue
                      paisa={s.outstandingPaisa}
                      hide={hide}
                      className="text-sm font-medium text-orange-400 shrink-0 tabular-nums"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-zinc-600">No outstanding suppliers.</div>
            )}
          </div>
        </div>
      </section>

      {/* ── Final error ─────────────────────────────────────────── */}
      {error && isFirstLoad && <ErrorBanner message={error} />}
    </div>
  );
}
