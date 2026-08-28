'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  planeStockApi,
  PlaneStockRow,
} from '../../../../../features/plane-stock/api/plane-stock';
import { InventoryMovement } from '../../../../../features/coils/api/coils';
import { coilsApi } from '../../../../../features/coils/api/coils';
import {
  ErrorBanner,
  LoadingState,
  SummaryTile,
  SectionCard,
  DataTable,
  TBody,
  TR,
  TD,
  StatusBadge,
} from '../../../../../features/ui';
import { formatDate, formatPaisa, formatWeight } from '../../../../../features/shared/utils/format';

export default function PlaneStockDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [plane, setPlane] = useState<PlaneStockRow | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!id || isNaN(id)) {
      queueMicrotask(() => {
        if (!cancelled) {
          setError('Invalid plane id');
          setIsLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    (async () => {
      try {
        const p = await planeStockApi.findOne(id);
        if (cancelled) return;
        setPlane(p);
        const ms = await coilsApi.getMovements(p.coilId);
        if (cancelled) return;
        setMovements(ms.filter((m) => m.type === 'PLANE_TRANSFER' && m.referenceId === p.id));
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
  }, [id]);

  if (isLoading) {
    return <LoadingState message="Loading plane stock..." />;
  }

  if (error || !plane) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Link
          href="/inventory/plane-stock"
          className="text-sm text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"
        >
          ← Back to Plane Stock
        </Link>
        {error && <ErrorBanner message={error} />}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href="/inventory/plane-stock"
          className="text-sm text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 mb-2"
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
          Back to Plane Stock
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-zinc-100">
                Plane entry #{plane.id}
              </h1>
              <StatusBadge
                variant={plane.status === 'AVAILABLE' ? 'green' : 'zinc'}
              >
                {plane.status}
              </StatusBadge>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Source Coil →{' '}
              <Link
                href={`/inventory/raw-coils/${plane.coilId}`}
                className="text-zinc-300 underline decoration-dotted underline-offset-2"
              >
                {plane.coilCode ?? `Coil #${plane.coilId}`}
              </Link>
              {plane.supplierName ? ` · ${plane.supplierName}` : ''}
            </div>
            {plane.note && (
              <div className="text-xs text-zinc-500 mt-1">
                Note: {plane.note}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile
          label="Plane Weight"
          value={formatWeight(plane.weightKg)}
          helper={`${plane.kgPerFoot.toFixed(3)} KG / ft`}
          variant="highlight"
        />
        <SummaryTile
          label="Total Feet"
          value={`${plane.calculatedFeet.toFixed(3)} ft`}
        />
        <SummaryTile
          label="Cost / KG"
          value={formatPaisa(plane.costPerKgPaisa)}
          helper="snapshot at creation"
        />
        <SummaryTile
          label="Total Value"
          value={formatPaisa(plane.totalValuePaisa)}
        />
      </div>

      <SectionCard
        title="Coil specification"
        description="Resolved from the source coil - not duplicated on the plane row."
        padded={false}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6">
          <Spec label="Color" value={plane.color} />
          <Spec label="Brand" value={plane.brand} />
          <Spec label="Material family" value={plane.materialFamilyName} />
          <Spec
            label="Width"
            value={
              plane.widthMm != null ? `${plane.widthMm.toFixed(0)} mm` : null
            }
          />
          <Spec
            label="Thickness"
            value={
              plane.thicknessMm != null
                ? `${plane.thicknessMm.toFixed(3)} mm`
                : null
            }
          />
          <Spec
            label="Purchase"
            value={plane.purchaseCode ? `Purchase ${plane.purchaseCode}` : null}
          />
          <Spec
            label="Created"
            value={formatDate(plane.createdAt)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Plane movements"
        description="Inventory movements that affected this plane entry."
        padded={false}
      >
        {movements.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No inventory movements linked to this entry.
          </div>
        ) : (
          <DataTable
            headers={[
              { label: 'Date' },
              { label: 'Type' },
              { label: 'Delta', align: 'right' },
              { label: 'Coil Balance', align: 'right' },
              { label: 'Notes' },
            ]}
          >
            <TBody>
              {movements.map((m) => (
                <TR key={m.id}>
                  <TD className="text-sm text-zinc-300">
                    {formatDate(m.createdAt)}
                  </TD>
                  <TD>
                    <StatusBadge variant="yellow">{m.type}</StatusBadge>
                  </TD>
                  <TD
                    align="right"
                    className={`text-sm font-medium ${
                      m.weightDelta < 0 ? 'text-yellow-400' : 'text-green-400'
                    }`}
                  >
                    {m.weightDelta.toFixed(3)} KG
                  </TD>
                  <TD align="right" className="text-sm text-zinc-100">
                    {m.weightBalance.toFixed(3)} KG
                  </TD>
                  <TD className="text-xs text-zinc-500">{m.notes ?? '—'}</TD>
                </TR>
              ))}
            </TBody>
          </DataTable>
        )}
      </SectionCard>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="text-sm text-zinc-100 mt-0.5">{value ?? '—'}</div>
    </div>
  );
}