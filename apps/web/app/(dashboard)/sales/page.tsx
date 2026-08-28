'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FinishedChaddarStock,
  FinishedChaddarStatus,
  SaleWithItems,
  finishedChaddarStockApi,
  salesApi,
} from '../../../features/sales/api/sales';
import { NewSaleForm } from '../../../features/sales/components/NewSaleForm';
import { SalesHistory } from '../../../features/sales/components/SalesHistory';
import { ErrorBanner, SummaryTile } from '../../../features/ui';
import { formatPaisa } from '../../../features/shared/utils/format';

export default function SalesPage() {
  const router = useRouter();
  const [stock, setStock] = useState<FinishedChaddarStock[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    setIsLoadingSales(true);
    try {
      const [stockData, salesData] = await Promise.all([
        finishedChaddarStockApi.findAll(),
        salesApi.findAll(),
      ]);
      setStock(stockData);
      setSales(salesData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales');
    } finally {
      setIsLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stockData, salesData] = await Promise.all([
          finishedChaddarStockApi.findAll(),
          salesApi.findAll(),
        ]);
        if (cancelled) return;
        setStock(stockData);
        setSales(salesData);
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load sales',
        );
      } finally {
        if (!cancelled) {
          setIsLoadingSales(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableStock = useMemo(
    () =>
      stock.filter(
        (s) =>
          s.status === FinishedChaddarStatus.AVAILABLE ||
          s.status === FinishedChaddarStatus.PARTIALLY_SOLD,
      ),
    [stock],
  );

  const totals = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let profit = 0;
    let due = 0;
    for (const s of sales) {
      revenue += Number(s.sale.totalAmountPaisa);
      cost += Number(s.sale.totalCostPaisa);
      profit += Number(s.sale.grossProfitPaisa);
      due += Number(s.sale.dueAmountPaisa);
    }
    return { revenue, cost, profit, due, count: sales.length };
  }, [sales]);

  const handleSelectCustomer = useCallback(
    (customerId: number) => {
      router.push(`/customers/${customerId}`);
    },
    [router],
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <header className="bg-gradient-to-b from-[#141A22] to-[#10141A] border border-zinc-800/80 rounded-2xl px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Sales / POS
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-100 tracking-tight">
              Record a sale
            </h1>
            <p className="mt-1.5 text-sm text-zinc-400 max-w-xl">
              Pick finished stock, enter pieces, complete the payment. Sold-out
              stock is hidden automatically.
            </p>
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 md:text-right md:min-w-[26rem]">
            <SummaryTile label="Sales" value={String(totals.count)} />
            <SummaryTile
              label="Revenue"
              value={formatPaisa(totals.revenue)}
            />
            <SummaryTile
              label="Gross Profit"
              value={formatPaisa(totals.profit)}
              variant={totals.profit >= 0 ? 'success' : 'danger'}
            />
            <SummaryTile
              label="Customer Due"
              value={formatPaisa(totals.due)}
              variant={totals.due > 0 ? 'highlight' : 'default'}
            />
          </dl>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}

      <NewSaleForm
        key="default"
        availableStock={availableStock}
        onCreated={() => {
          loadAll();
        }}
      />

      <div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">
          Sales History
        </h2>
        <SalesHistory
          sales={sales}
          isLoading={isLoadingSales}
          onSelectCustomer={handleSelectCustomer}
        />
      </div>
    </div>
  );
}
