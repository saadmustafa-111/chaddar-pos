'use client';

import Link from 'next/link';
import { SaleWithItems, salePaymentStatusColors, salePaymentStatusLabels } from '../api/sales';
import { formatDate, formatPaisa, formatWeight } from '../../shared/utils/format';
import { EmptyState, DataTable, TBody, TR, TD, StatusBadge } from '../../ui';

interface Props {
  sales: SaleWithItems[];
  isLoading?: boolean;
  onSelectCustomer?: (customerId: number) => void;
}

export function SalesHistory({ sales, isLoading, onSelectCustomer }: Props) {
  return (
    <DataTable
      isLoading={isLoading}
      loadingMessage="Loading sales history..."
      headers={[
        { label: 'Sale' },
        { label: 'Customer' },
        { label: 'Items' },
        { label: 'Pieces', align: 'right' },
        { label: 'Weight', align: 'right' },
        { label: 'Revenue', align: 'right' },
        { label: 'Cost', align: 'right' },
        { label: 'Profit', align: 'right' },
        { label: 'Payment' },
        { label: 'Date' },
      ]}
    >
      <TBody>
        {sales.length === 0 ? (
          <tr>
            <td colSpan={10} className="p-0">
              <EmptyState
                title="No sales yet"
                description="Recorded sales will appear here. Use the form above to record your first sale."
              />
            </td>
          </tr>
        ) : (
          sales.map(({ sale, items }) => {
            const totalPieces = items.reduce(
              (sum, i) => sum + i.piecesSold,
              0,
            );
            const totalWeight = items.reduce(
              (sum, i) => sum + Number(i.weightSoldKg),
              0,
            );
            return (
              <TR key={sale.id}>
                <TD>
                  <Link
                    href={`/sales/${sale.id}`}
                    className="text-sm font-medium text-zinc-100 hover:text-zinc-300 underline decoration-dotted underline-offset-2"
                  >
                    {sale.code}
                  </Link>
                  {sale.note && (
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {sale.note}
                    </div>
                  )}
                </TD>
                <TD>
                  {sale.customer ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSelectCustomer?.(sale.customer!.id)
                      }
                      className="text-left hover:underline decoration-dotted underline-offset-2"
                    >
                      <div className="text-sm text-zinc-100 font-medium">
                        {sale.customer.name}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {sale.customer.code}
                        {sale.customer.phone
                          ? ` · ${sale.customer.phone}`
                          : ''}
                      </div>
                    </button>
                  ) : (
                    <span className="text-sm text-zinc-500 italic">
                      Cash sale
                    </span>
                  )}
                </TD>
                <TD>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs text-zinc-400"
                      >
                        <span className="text-zinc-200 font-medium">
                          {item.sizeLabel}
                        </span>
                        <span className="text-zinc-500">
                          {' '}
                          · {formatWeight(Number(item.weightSoldKg))} · {item.piecesSold} pc
                        </span>
                      </div>
                    ))}
                  </div>
                </TD>
                <TD align="right" className="text-sm font-medium text-zinc-100">
                  {totalPieces}
                </TD>
                <TD align="right" className="text-sm font-medium text-zinc-100">
                  {formatWeight(totalWeight)}
                </TD>
                <TD align="right" className="text-sm font-medium text-zinc-100">
                  {formatPaisa(Number(sale.totalAmountPaisa))}
                </TD>
                <TD align="right" className="text-sm text-zinc-400">
                  {formatPaisa(Number(sale.totalCostPaisa))}
                </TD>
                <TD align="right">
                  <span
                    className={`text-sm font-semibold ${
                      Number(sale.grossProfitPaisa) >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {formatPaisa(Number(sale.grossProfitPaisa))}
                  </span>
                </TD>
                <TD>
                  <div className="flex flex-col gap-1">
                    <StatusBadge
                      variant={salePaymentStatusColors[sale.paymentStatus]}
                    >
                      {salePaymentStatusLabels[sale.paymentStatus]}
                    </StatusBadge>
                    {sale.customer && (
                      <span className="text-xs text-zinc-500">
                        Due {formatPaisa(Number(sale.dueAmountPaisa))}
                      </span>
                    )}
                  </div>
                </TD>
                <TD className="text-sm text-zinc-400">
                  {formatDate(sale.saleDate)}
                </TD>
              </TR>
            );
          })
        )}
      </TBody>
    </DataTable>
  );
}