'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Supplier,
  SupplierLedgerEntry,
  SupplierTotals,
  suppliersApi,
  supplierLedgerEntryTypeLabels,
} from '../../../../../features/suppliers/api/suppliers';
import { RecordSupplierPaymentModal } from '../../../../../features/suppliers/components/RecordSupplierPaymentModal';
import {
  LoadingState,
  ErrorBanner,
  SummaryTile,
  DataTable,
  TBody,
  TR,
  TD,
  StatusBadge,
  PrimaryButton,
  SectionCard,
} from '../../../../../features/ui';
import { formatDate, formatPaisa } from '../../../../../features/shared/utils/format';
import { AttachmentsSection } from '../../../../../features/attachments';

interface PurchaseSummary {
  id: number;
  code: string;
  purchaseDate: string;
  coilsCount: number;
  totalAmountPaisa: number;
}

export default function SupplierDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<SupplierLedgerEntry[]>([]);
  const [totals, setTotals] = useState<SupplierTotals | null>(null);
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState(false);

  const loadAll = useCallback(async () => {
    if (!id || isNaN(id)) return;
    setIsLoading(true);
    try {
      const [s, l, t, p] = await Promise.all([
        suppliersApi.findOne(id),
        suppliersApi.getLedger(id),
        suppliersApi.getTotals(id),
        fetch(`/api/v1/purchases`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ]);
      setSupplier(s);
      setLedger(l);
      setTotals(t);
      const own = (p as Array<{
        id: number;
        code: string;
        purchaseDate: string;
        supplierId: number;
        coils?: unknown[];
        coilsCount?: number;
        totalAmountPaisa?: number;
      }>).filter((row) => row.supplierId === id);
      const summaries: PurchaseSummary[] = own.map((row) => ({
        id: row.id,
        code: row.code,
        purchaseDate: row.purchaseDate,
        coilsCount: row.coilsCount ?? row.coils?.length ?? 0,
        totalAmountPaisa: row.totalAmountPaisa ?? 0,
      }));
      setPurchases(summaries);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load supplier',
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!id || isNaN(id)) {
      queueMicrotask(() => {
        if (!cancelled) {
          setError('Invalid supplier id');
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
        const [s, l, t, p] = await Promise.all([
          suppliersApi.findOne(id),
          suppliersApi.getLedger(id),
          suppliersApi.getTotals(id),
          fetch(`/api/v1/purchases`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);
        if (cancelled) return;
        setSupplier(s);
        setLedger(l);
        setTotals(t);
        const own = (p as Array<{
          id: number;
          code: string;
          purchaseDate: string;
          supplierId: number;
          coils?: unknown[];
          coilsCount?: number;
          totalAmountPaisa?: number;
        }>).filter((row) => row.supplierId === id);
        const summaries: PurchaseSummary[] = own.map((row) => ({
          id: row.id,
          code: row.code,
          purchaseDate: row.purchaseDate,
          coilsCount: row.coilsCount ?? row.coils?.length ?? 0,
          totalAmountPaisa: row.totalAmountPaisa ?? 0,
        }));
        setPurchases(summaries);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load supplier',
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
    return <LoadingState message="Loading supplier..." />;
  }

  if (error || !supplier || !totals) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Link
          href="/procurement/suppliers"
          className="text-sm text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"
        >
          ← Back to Suppliers
        </Link>
        {error && <ErrorBanner message={error} />}
      </div>
    );
  }

  const outstanding = Number(totals.outstandingPaisa);
  const totalPurchase = Number(totals.totalPurchasePaisa);
  const totalPaid = Number(totals.totalPaidPaisa);
  const hasDue = outstanding > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          href="/procurement/suppliers"
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
          Back to Suppliers
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-zinc-100">
                {supplier.name}
              </h1>
              <StatusBadge variant={supplier.isActive ? 'green' : 'zinc'}>
                {supplier.isActive ? 'Active' : 'Inactive'}
              </StatusBadge>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              <span className="font-mono">{supplier.code}</span>
              {supplier.contactPerson ? ` · ${supplier.contactPerson}` : ''}
              {supplier.phone ? ` · ${supplier.phone}` : ''}
              {supplier.email ? ` · ${supplier.email}` : ''}
            </div>
            {supplier.address && (
              <div className="text-xs text-zinc-500 mt-1">{supplier.address}</div>
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
            Pay Supplier
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SummaryTile
          label="Total Purchases"
          value={formatPaisa(totalPurchase)}
          helper="All time"
        />
        <SummaryTile
          label="Total Paid"
          value={formatPaisa(totalPaid)}
          helper="All time"
        />
        <SummaryTile
          label="Outstanding Balance"
          value={formatPaisa(outstanding)}
          variant={hasDue ? 'highlight' : 'success'}
          helper={
            hasDue
              ? totalPurchase > 0
                ? `${Math.round((outstanding / totalPurchase) * 100)}% of purchases unpaid`
                : 'Outstanding'
              : 'All settled'
          }
        />
      </div>

      <SectionCard
        title="Recent Purchases"
        description="All purchases booked against this supplier."
        padded={false}
      >
        {purchases.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No purchases recorded for this supplier yet.
          </div>
        ) : (
          <DataTable
            headers={[
              { label: 'Purchase' },
              { label: 'Coils', align: 'right' },
              { label: 'Amount', align: 'right' },
              { label: 'Date' },
            ]}
          >
            <TBody>
              {purchases.map((p) => (
                <TR key={p.id}>
                  <TD className="text-sm font-medium text-zinc-100">
                    {p.code}
                  </TD>
                  <TD
                    align="right"
                    className="text-sm text-zinc-300"
                  >
                    {p.coilsCount}
                  </TD>
                  <TD
                    align="right"
                    className="text-sm font-medium text-zinc-100"
                  >
                    {formatPaisa(Number(p.totalAmountPaisa))}
                  </TD>
                  <TD className="text-sm text-zinc-400">
                    {formatDate(p.purchaseDate)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </DataTable>
        )}
      </SectionCard>

      <SectionCard
        title="Ledger / Payment History"
        description="Every purchase due and payment with running balance. Newest first."
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
                      {supplierLedgerEntryTypeLabels[entry.entryType]}
                    </StatusBadge>
                  </TD>
                  <TD>
                    {entry.purchaseId ? (
                      <span className="text-xs text-zinc-500 font-mono">
                        Purchase #{entry.purchaseId}
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

      <RecordSupplierPaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        supplier={supplier}
        outstandingPaisa={outstanding}
        onSaved={() => {
          loadAll();
        }}
      />

      <AttachmentsSection
        entityType="SUPPLIER"
        entityId={id}
        title="Supplier Documents"
        description="Business documents, CNIC, agreements and other supplier-related files."
        allowedDocumentTypes={['CNIC', 'INVOICE', 'RECEIPT', 'OTHER']}
      />
    </div>
  );
}