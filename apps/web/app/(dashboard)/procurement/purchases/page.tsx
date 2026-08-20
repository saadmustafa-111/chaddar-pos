'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { purchasesApi, Purchase } from '../../../../features/purchases/api/purchases';
import { formatPaisa, formatDate } from '../../../../features/shared/utils/format';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const data = await purchasesApi.findAll();
        if (!isCancelled) {
          setPurchases(data);
        }
      } catch {
        if (!isCancelled) {
          setError('Failed to load purchases');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Purchases</h1>
          <p className="text-sm text-zinc-500 mt-1">
            View and manage coil purchase orders.
          </p>
        </div>
        <Link
          href="/procurement/purchases/new"
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors inline-block"
        >
          New Purchase
        </Link>
      </div>

      {error ? (
        <div className="bg-[#0B0F14] border border-red-500/30 rounded-xl p-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : purchases.length === 0 ? (
        <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No purchases yet.</p>
        </div>
      ) : (
        <div className="bg-[#141A22] border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Purchase #
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Supplier
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Date
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Invoice #
                </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                  Coils
                </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                  Total Weight
                </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                  Total Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => {
                const totalWeight = purchase.coils.reduce(
                  (sum, coil) => sum + Number(coil.purchaseWeight),
                  0,
                );
                const totalAmount = purchase.coils.reduce(
                  (sum, coil) => sum + Number(coil.purchaseAmountPaisa),
                  0,
                );
                return (
                  <tr
                    key={purchase.id}
                    className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/30"
                  >
                    <td className="px-6 py-4 text-sm text-zinc-100 font-medium">
                      {purchase.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      {purchase.supplier?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      {formatDate(purchase.purchaseDate)}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      {purchase.supplierInvoiceNumber || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400 text-right">
                      {purchase.coils.length}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400 text-right">
                      {totalWeight.toFixed(3)} KG
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-100 text-right font-medium">
                      {formatPaisa(totalAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}