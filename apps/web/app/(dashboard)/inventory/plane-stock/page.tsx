'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  planeStockApi,
  PlaneStockRow,
  PlaneStockSummary,
} from '../../../../features/plane-stock/api/plane-stock';
import {
  ErrorBanner,
  LoadingState,
  SummaryTile,
  DataTable,
  TBody,
  TR,
  TD,
  StatusBadge,
  EmptyState,
} from '../../../../features/ui';
import { formatDate, formatPaisa } from '../../../../features/shared/utils/format';

export default function PlaneStockPage() {
  const [rows, setRows] = useState<PlaneStockRow[]>([]);
  const [summary, setSummary] = useState<PlaneStockSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, sum] = await Promise.all([
        planeStockApi.findAll(),
        planeStockApi.getSummary(),
      ]);
      setRows(list);
      setSummary(sum);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load plane stock',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    (async () => {
      try {
        const [list, sum] = await Promise.all([
          planeStockApi.findAll(),
          planeStockApi.getSummary(),
        ]);
        if (cancelled) return;
        setRows(list);
        setSummary(sum);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load plane stock',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading plane stock..." />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Plane Stock</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Material that has been set aside from raw coils before cutting.
          Linked back to its source coil for traceability.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile
          label="Total Plane Weight"
          value={`${(summary?.totalWeightKg ?? 0).toFixed(3)} KG`}
          helper={`${summary?.entryCount ?? 0} entries`}
        />
        <SummaryTile
          label="Total Plane Feet"
          value={`${(summary?.totalFeet ?? 0).toFixed(3)} ft`}
          helper="across all entries"
        />
        <SummaryTile
          label="Total Plane Value"
          value={formatPaisa(summary?.totalValuePaisa ?? 0)}
          helper="at current finished cost"
          variant="highlight"
        />
        <SummaryTile
          label="Source Coils"
          value={String(new Set(rows.map((r) => r.coilId)).size)}
          helper="unique"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No plane stock yet"
          description="Use 'Move to Plane' on any raw coil detail page to set aside weight for later use."
        />
      ) : (
        <div className="bg-[#141A22] border border-zinc-800 rounded-xl overflow-hidden">
          <DataTable
            headers={[
              { label: 'Source Coil' },
              { label: 'Color / Brand' },
              { label: 'Thickness' },
              { label: 'Width' },
              { label: 'Weight (KG)', align: 'right' },
              { label: 'Total Feet', align: 'right' },
              { label: 'Cost / KG', align: 'right' },
              { label: 'Total Value', align: 'right' },
              { label: 'Created' },
            ]}
          >
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <Link
                      href={`/inventory/plane-stock/${row.id}`}
                      className="text-sm text-zinc-100 font-medium hover:text-zinc-300 underline decoration-dotted underline-offset-2"
                    >
                      {row.coilCode ?? `Coil #${row.coilId}`}
                    </Link>
                    <div className="text-xs text-zinc-500 mt-0.5 font-mono">
                      PLANE-{String(row.id).padStart(5, '0')}
                    </div>
                  </TD>
                  <TD>
                    <div className="text-sm text-zinc-100">
                      {row.color ?? row.brand ?? '—'}
                    </div>
                    {row.brand && row.color && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {row.brand}
                      </div>
                    )}
                    {row.materialFamilyName && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {row.materialFamilyName}
                      </div>
                    )}
                  </TD>
                  <TD className="text-sm text-zinc-300">
                    {row.thicknessMm != null
                      ? `${row.thicknessMm.toFixed(3)} mm`
                      : '—'}
                  </TD>
                  <TD className="text-sm text-zinc-300">
                    {row.widthMm != null
                      ? `${row.widthMm.toFixed(0)} mm`
                      : '—'}
                  </TD>
                  <TD align="right" className="text-sm font-medium text-zinc-100">
                    {row.weightKg.toFixed(3)}
                  </TD>
                  <TD align="right" className="text-sm text-zinc-300">
                    {row.calculatedFeet.toFixed(3)}
                  </TD>
                  <TD align="right" className="text-sm text-zinc-400">
                    {formatPaisa(row.costPerKgPaisa)}
                  </TD>
                  <TD align="right" className="text-sm font-medium text-zinc-100">
                    {formatPaisa(row.totalValuePaisa)}
                  </TD>
                  <TD className="text-sm text-zinc-400">
                    {formatDate(row.createdAt)}
                    <div className="mt-0.5">
                      <StatusBadge
                        variant={
                          row.status === 'AVAILABLE' ? 'green' : 'zinc'
                        }
                      >
                        {row.status}
                      </StatusBadge>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </DataTable>
        </div>
      )}
    </div>
  );
}