'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Customer,
  CustomerLedgerEntry,
  CustomerTotals,
  customersApi,
  ledgerEntryTypeLabels,
} from '../../../../features/customers/api/customers';
import { RecordPaymentModal } from '../../../../features/customers/components/RecordPaymentModal';
import {
  SaleWithItems,
  salePaymentStatusColors,
  salePaymentStatusLabels,
  salesApi,
} from '../../../../features/sales/api/sales';
import {
  ErrorBanner,
  LoadingState,
  SummaryTile,
  DataTable,
  TBody,
  TR,
  TD,
  StatusBadge,
  PrimaryButton,
  SectionCard,
} from '../../../../features/ui';
import { formatDate, formatPaisa, formatWeight } from '../../../../features/shared/utils/format';
import { AttachmentsSection } from '../../../../features/attachments';

export default function CustomerDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CustomerLedgerEntry[]>([]);
  const [totals, setTotals] = useState<CustomerTotals | null>(null);
  const [customerSales, setCustomerSales] = useState<SaleWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState(false);

  const loadAll = useCallback(async () => {
    if (!id || isNaN(id)) return;
    setIsLoading(true);
    try {
      const [c, l, t, s] = await Promise.all([
        customersApi.findOne(id),
        customersApi.getLedger(id),
        customersApi.getTotals(id),
        salesApi.findByCustomer(id),
      ]);
      setCustomer(c);
      setLedger(l);
      setTotals(t);
      setCustomerSales(s);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load customer',
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!id || isNaN(id)) {
      queueMicrotask(() => {
        if (cancelled) return;
        setError('Invalid customer id');
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
        const [c, l, t, s] = await Promise.all([
          customersApi.findOne(id),
          customersApi.getLedger(id),
          customersApi.getTotals(id),
          salesApi.findByCustomer(id),
        ]);
        if (cancelled) return;
        setCustomer(c);
        setLedger(l);
        setTotals(t);
        setCustomerSales(s);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load customer',
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
    return <LoadingState message="Loading customer..." />;
  }

  if (error || !customer) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Link
          href="/customers"
          className="text-sm text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"
        >
          ← Back to Customers
        </Link>
        {error && <ErrorBanner message={error} />}
      </div>
    );
  }

  const balance = Number(customer.currentBalancePaisa);
  const hasDue = balance > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          href="/customers"
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
          Back to Customers
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-zinc-100">
                {customer.name}
              </h1>
              <StatusBadge variant={customer.isActive ? 'green' : 'zinc'}>
                {customer.isActive ? 'Active' : 'Inactive'}
              </StatusBadge>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              <span className="font-mono">{customer.code}</span>
              {customer.phone ? ` · ${customer.phone}` : ''}
              {customer.address ? ` · ${customer.address}` : ''}
            </div>
            {customer.note && (
              <div className="text-xs text-zinc-500 mt-1">{customer.note}</div>
            )}
          </div>
          <PrimaryButton
            type="button"
            onClick={() => setShowPayment(true)}
            disabled={!hasDue}
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
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Record Payment
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile
          label="Current Due"
          value={formatPaisa(balance)}
          variant={hasDue ? 'danger' : 'success'}
          helper={hasDue ? 'Outstanding' : 'No due'}
        />
        <SummaryTile
          label="Total Sales"
          value={formatPaisa(totals?.totalSalesPaisa ?? 0)}
          variant="default"
        />
        <SummaryTile
          label="Total Paid"
          value={formatPaisa(totals?.totalPaidPaisa ?? 0)}
          variant="default"
        />
        <SummaryTile
          label="Net Outstanding"
          value={formatPaisa(totals?.outstandingPaisa ?? 0)}
          variant={
            (totals?.outstandingPaisa ?? 0) > 0 ? 'highlight' : 'default'
          }
        />
      </div>

      <SectionCard
        title="Recent Sales"
        description="All sales recorded against this customer."
        padded={false}
      >
        {customerSales.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No sales yet.
          </div>
        ) : (
          <DataTable
            headers={[
              { label: 'Sale' },
              { label: 'Items' },
              { label: 'Pieces', align: 'right' },
              { label: 'Weight', align: 'right' },
              { label: 'Total', align: 'right' },
              { label: 'Paid', align: 'right' },
              { label: 'Due', align: 'right' },
              { label: 'Payment' },
              { label: 'Date' },
            ]}
          >
            <TBody>
              {customerSales.map(({ sale, items }) => {
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
                    <TD className="text-sm font-medium text-zinc-100">
                      {sale.code}
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
                    <TD align="right" className="text-sm text-zinc-300">
                      {formatPaisa(Number(sale.paidAmountPaisa))}
                    </TD>
                    <TD
                      align="right"
                      className={`text-sm font-medium ${
                        Number(sale.dueAmountPaisa) > 0
                          ? 'text-yellow-400'
                          : 'text-green-400'
                      }`}
                    >
                      {formatPaisa(Number(sale.dueAmountPaisa))}
                    </TD>
                    <TD>
                      <StatusBadge
                        variant={salePaymentStatusColors[sale.paymentStatus]}
                      >
                        {salePaymentStatusLabels[sale.paymentStatus]}
                      </StatusBadge>
                    </TD>
                    <TD className="text-sm text-zinc-400">
                      {formatDate(sale.saleDate)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </DataTable>
        )}
      </SectionCard>

      <SectionCard
        title="Ledger / Payment History"
        description="Every sale due and payment is recorded with a running balance."
        padded={false}
      >
        {ledger.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No ledger entries yet.
          </div>
        ) : (
          <DataTable
            headers={[
              { label: 'Date' },
              { label: 'Type' },
              { label: 'Reference' },
              { label: 'Amount', align: 'right' },
              { label: 'Balance After', align: 'right' },
              { label: 'Note' },
            ]}
          >
            <TBody>
              {ledger.map((entry) => (
                <TR key={entry.id}>
                  <TD className="text-sm text-zinc-300">
                    {formatDate(entry.entryDate)}
                  </TD>
                  <TD>
                    <StatusBadge
                      variant={
                        entry.entryType === 'PAYMENT' ? 'green' : 'yellow'
                      }
                    >
                      {ledgerEntryTypeLabels[entry.entryType]}
                    </StatusBadge>
                  </TD>
                  <TD>
                    {entry.saleId ? (
                      <span className="text-xs text-zinc-500 font-mono">
                        Sale #{entry.saleId}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </TD>
                  <TD
                    align="right"
                    className={`text-sm font-medium ${
                      entry.entryType === 'PAYMENT'
                        ? 'text-green-400'
                        : 'text-yellow-400'
                    }`}
                  >
                    {entry.entryType === 'PAYMENT' ? '−' : '+'}
                    {formatPaisa(Number(entry.amountPaisa))}
                  </TD>
                  <TD
                    align="right"
                    className="text-sm font-semibold text-zinc-100"
                  >
                    {formatPaisa(Number(entry.balanceAfterPaisa))}
                  </TD>
                  <TD className="text-xs text-zinc-500">
                    {entry.note ?? '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </DataTable>
        )}
      </SectionCard>

      <RecordPaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        customer={customer}
        onSaved={() => {
          loadAll();
        }}
      />

      <AttachmentsSection
        entityType="CUSTOMER"
        entityId={id}
        title="Customer Documents"
        description="Customer agreements, CNIC and other related files."
        allowedDocumentTypes={['CNIC', 'RECEIPT', 'OTHER']}
      />
    </div>
  );
}