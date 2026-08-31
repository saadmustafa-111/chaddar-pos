'use client';

import {
  FinishedChaddarStock,
  finishedChaddarStatusColors,
  finishedChaddarStatusLabels,
} from '../api/sales';
import { formatWeight } from '../../shared/utils/format';
import { formatCategoryRate } from '../../price-categories/api/price-categories';
import {
  DataTable,
  TBody,
  TR,
  TD,
  StatusBadge,
  EmptyState,
} from '../../ui';

interface Props {
  stock: FinishedChaddarStock[];
  isLoading?: boolean;
  onSelect?: (stock: FinishedChaddarStock) => void;
}

function summariseStock(s: FinishedChaddarStock): string {
  const parts: string[] = [];
  parts.push(s.code);
  parts.push(s.sizeLabel);
  if (s.thicknessMm != null) {
    parts.push(`${Number(s.thicknessMm).toFixed(2)}mm`);
  }
  if (s.color) parts.push(s.color);
  if (s.priceCategory) {
    const rate = Number(s.priceCategory.sellingRatePaisa);
    if (rate > 0) {
      parts.push(`Rs ${(rate / 100).toFixed(0)}/KG`);
    }
  }
  const wpp = s.weightPerPieceKg != null ? Number(s.weightPerPieceKg) : null;
  const wppStr = wpp && wpp > 0 ? `${wpp.toFixed(2)} KG/pc` : null;
  parts.push(`${s.remainingPieces} pc / ${Number(s.remainingWeightKg).toFixed(0)} KG`);
  if (wppStr) parts.push(wppStr);
  return parts.join(' · ');
}

export function AvailableStockPanel({ stock, isLoading, onSelect }: Props) {
  if (isLoading) {
    return (
      <DataTable
        isLoading
        loadingMessage="Loading finished stock..."
        headers={[]}
      />
    );
  }

  if (stock.length === 0) {
    return (
      <EmptyState
        title="No sellable finished stock"
        description="Cut a coil into chaddar first to create sellable inventory."
      />
    );
  }

  return (
    <DataTable
      headers={[
        { label: 'Stock' },
        { label: 'Category' },
        { label: 'Available' },
        { label: 'Weight / Piece' },
        { label: 'Default Rate' },
        { label: 'Status' },
        ...(onSelect ? [{ label: '', align: 'right' as const }] : []),
      ]}
    >
      <TBody>
        {stock.map((s) => {
          const wpp = s.weightPerPieceKg != null ? Number(s.weightPerPieceKg) : null;
          const rate = s.priceCategory ? Number(s.priceCategory.sellingRatePaisa) : 0;
          return (
            <TR key={s.id}>
              <TD>
                <div className="text-sm font-medium text-zinc-100">{s.code}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {s.sizeLabel}
                  {s.thicknessMm != null
                    ? ` · ${Number(s.thicknessMm).toFixed(3)} mm`
                    : ''}
                  {s.color ? ` · ${s.color}` : ''}
                </div>
              </TD>
              <TD>
                {s.priceCategory ? (
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    <span className="text-zinc-100 font-medium">
                      {s.priceCategory.name}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    Unassigned
                  </span>
                )}
              </TD>
              <TD align="right">
                <div className="text-sm font-medium text-zinc-100">
                  {s.remainingPieces} pc
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {formatWeight(Number(s.remainingWeightKg))}
                </div>
              </TD>
              <TD align="right" className="text-sm text-zinc-300">
                {wpp != null && wpp > 0 ? formatWeight(wpp) : '—'}
              </TD>
              <TD align="right" className="text-sm text-zinc-300">
                {rate > 0 ? formatCategoryRate(rate) : '—'}
              </TD>
              <TD>
                <StatusBadge variant={finishedChaddarStatusColors[s.status]}>
                  {finishedChaddarStatusLabels[s.status]}
                </StatusBadge>
              </TD>
              {onSelect && (
                <TD align="right">
                  <button
                    type="button"
                    onClick={() => onSelect(s)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium px-3 py-1.5 rounded-lg transition-colors"
                    title={summariseStock(s)}
                  >
                    Sell from this
                  </button>
                </TD>
              )}
            </TR>
          );
        })}
      </TBody>
    </DataTable>
  );
}
