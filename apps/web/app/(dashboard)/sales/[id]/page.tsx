'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  SaleWithItems,
  salePaymentStatusColors,
  salePaymentStatusLabels,
  salesApi,
} from '../../../../features/sales/api/sales';
import { InvoiceDocument } from '../../../../features/sales/components/InvoiceDocument';
import {
  businessProfileApi,
  BusinessProfile,
} from '../../../../features/settings/api/business-profile';
import {
  ErrorBanner,
  LoadingState,
  StatusBadge,
  SectionCard,
  SummaryTile,
  DataTable,
  TBody,
  TR,
  TD,
  PrimaryButton,
} from '../../../../features/ui';
import { formatDate, formatPaisa, formatWeight } from '../../../../features/shared/utils/format';

export default function SaleDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [sale, setSale] = useState<SaleWithItems | null>(null);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!id || isNaN(id)) {
      queueMicrotask(() => {
        if (cancelled) return;
        setError('Invalid sale id');
        setIsLoading(false);
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
        const [saleData, businessData] = await Promise.all([
          salesApi.findOne(id),
          businessProfileApi.get(),
        ]);
        if (cancelled) return;
        setSale(saleData);
        setBusiness(businessData);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load sale',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading sale..." />;
  }

  if (error || !sale) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Link
          href="/sales"
          className="text-sm text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"
        >
          ← Back to Sales
        </Link>
        {error && <ErrorBanner message={error} />}
      </div>
    );
  }

  const { sale: s, items } = sale;
  const totalPieces = items.reduce((sum, i) => sum + i.piecesSold, 0);
  const totalWeight = items.reduce(
    (sum, i) => sum + Number(i.weightSoldKg),
    0,
  );
  const hasDue = Number(s.dueAmountPaisa) > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          href="/sales"
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
          Back to Sales
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-zinc-100">
                Sale {s.code}
              </h1>
              <StatusBadge
                variant={salePaymentStatusColors[s.paymentStatus]}
              >
                {salePaymentStatusLabels[s.paymentStatus]}
              </StatusBadge>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              <span>Sale date: {formatDate(s.saleDate)}</span>
            </div>
          </div>
          <PrimaryButton type="button" onClick={handlePrint}>
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
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print Invoice
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile
          label="Total Amount"
          value={formatPaisa(Number(s.totalAmountPaisa))}
          variant="highlight"
        />
        <SummaryTile
          label="Paid"
          value={formatPaisa(Number(s.paidAmountPaisa))}
          variant="default"
        />
        <SummaryTile
          label="Due"
          value={formatPaisa(Number(s.dueAmountPaisa))}
          variant={hasDue ? 'danger' : 'success'}
        />
        <SummaryTile
          label="Items / Pieces"
          value={`${items.length} / ${totalPieces}`}
          variant="default"
          helper={formatWeight(totalWeight)}
        />
      </div>

      <SectionCard
        title="Customer"
        description={
          s.customer
            ? 'Linked customer for this sale.'
            : 'No customer linked — this was a cash sale.'
        }
      >
        <div className="p-6">
          {s.customer ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-100">
                  {s.customer.name}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  <span className="font-mono">{s.customer.code}</span>
                  {s.customer.phone ? ` · ${s.customer.phone}` : ''}
                </div>
              </div>
              <Link
                href={`/customers/${s.customer.id}`}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline decoration-dotted underline-offset-2"
              >
                View customer →
              </Link>
            </div>
          ) : (
            <span className="text-sm text-zinc-500 italic">Cash sale</span>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Items"
        description="All chaddar items sold on this invoice."
        padded={false}
      >
        <DataTable
          headers={[
            { label: 'Size' },
            { label: 'Pieces', align: 'right' },
            { label: 'Weight', align: 'right' },
            { label: 'Rate / KG', align: 'right' },
            { label: 'Amount', align: 'right' },
          ]}
        >
          <TBody>
            {items.map((item) => (
              <TR key={item.id}>
                <TD className="text-sm font-medium text-zinc-100">
                  {item.sizeLabel}
                </TD>
                <TD align="right" className="text-sm text-zinc-300">
                  {item.piecesSold}
                </TD>
                <TD align="right" className="text-sm text-zinc-300">
                  {formatWeight(Number(item.weightSoldKg))}
                </TD>
                <TD align="right" className="text-sm text-zinc-300">
                  {formatPaisa(Number(item.sellingRatePaisa))}
                </TD>
                <TD
                  align="right"
                  className="text-sm font-semibold text-zinc-100"
                >
                  {formatPaisa(Number(item.lineRevenuePaisa))}
                </TD>
              </TR>
            ))}
          </TBody>
        </DataTable>
      </SectionCard>

      <SectionCard
        title="Payment Summary"
        description="Snapshot of paid and due at the time of sale."
        padded={false}
      >
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryTile
            label="Grand Total"
            value={formatPaisa(Number(s.totalAmountPaisa))}
            variant="highlight"
          />
          <SummaryTile
            label="Paid"
            value={formatPaisa(Number(s.paidAmountPaisa))}
            variant="default"
          />
          <SummaryTile
            label="Remaining Due"
            value={formatPaisa(Number(s.dueAmountPaisa))}
            variant={hasDue ? 'danger' : 'success'}
          />
        </div>
        {s.note && (
          <div className="px-6 pb-6 -mt-2 text-sm text-zinc-400">
            <span className="text-zinc-500 font-medium">Note:</span> {s.note}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Internal Profit Summary"
        description="For operator use. Not shown on the customer invoice."
      >
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryTile
            label="Cost (snapshot)"
            value={formatPaisa(Number(s.totalCostPaisa))}
            variant="default"
          />
          <SummaryTile
            label="Revenue"
            value={formatPaisa(Number(s.totalAmountPaisa))}
            variant="default"
          />
          <SummaryTile
            label="Gross Profit"
            value={formatPaisa(Number(s.grossProfitPaisa))}
            variant={
              Number(s.grossProfitPaisa) >= 0 ? 'success' : 'danger'
            }
          />
        </div>
      </SectionCard>

      <div className="hidden print:block print-invoice">
        <InvoiceDocument
          sale={s}
          items={items}
          business={business}
        />
      </div>
    </div>
  );
}