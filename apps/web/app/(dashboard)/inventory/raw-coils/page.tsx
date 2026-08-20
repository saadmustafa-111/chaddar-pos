'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { coilsApi, Coil, InventoryStatus } from '../../../../features/coils/api/coils';
import { formatPaisa, formatWeight, formatDate } from '../../../../features/shared/utils/format';
import { suppliersApi, Supplier } from '../../../../features/suppliers/api/suppliers';

const statusColors: Record<InventoryStatus, string> = {
  RAW: 'bg-blue-500/10 text-blue-400',
  IN_PROCESS: 'bg-yellow-500/10 text-yellow-400',
  FINISHED: 'bg-green-500/10 text-green-400',
  DEPLETED: 'bg-zinc-500/10 text-zinc-400',
};

export default function RawCoilsPage() {
  const [coils, setCoils] = useState<Coil[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    supplierId: '' as number | '',
    status: '' as InventoryStatus | '',
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [coilsData, suppliersData] = await Promise.all([
          coilsApi.findAll(),
          suppliersApi.findActive(),
        ]);
        if (!cancelled) {
          setCoils(coilsData);
          setSuppliers(suppliersData);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load coils');
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCoils = coils.filter((coil) => {
    if (filters.supplierId && coil.supplierId !== filters.supplierId) {
      return false;
    }
    if (filters.status && coil.status !== filters.status) {
      return false;
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        coil.code.toLowerCase().includes(search) ||
        coil.batchNumber?.toLowerCase().includes(search) ||
        coil.supplier?.name.toLowerCase().includes(search) ||
        coil.purchase?.code.toLowerCase().includes(search)
      );
    }
    return true;
  });

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
          <h1 className="text-xl font-semibold text-zinc-100">Raw Coil Inventory</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Track and manage raw steel coil inventory.
          </p>
        </div>
      </div>

      <div className="bg-[#141A22] border border-zinc-800 rounded-xl mb-6 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by coil #, batch #, supplier, purchase #..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>

          <select
            value={filters.supplierId}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                supplierId: e.target.value ? parseInt(e.target.value) : '',
              }))
            }
            className="bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value as InventoryStatus | '',
              }))
            }
            className="bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
          >
            <option value="">All Status</option>
            <option value="RAW">Raw</option>
            <option value="IN_PROCESS">In Process</option>
            <option value="FINISHED">Finished</option>
            <option value="DEPLETED">Depleted</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="bg-[#0B0F14] border border-red-500/30 rounded-xl p-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : filteredCoils.length === 0 ? (
        <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No coils found.</p>
        </div>
      ) : (
        <div className="bg-[#141A22] border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Coil #
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Supplier
                </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                    Category
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                    Width
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                    Thickness (mm)
                  </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                  Original Wt
                </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                  Current Wt
                </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                  Rate / KG
                </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
                    Purchase Cost
                  </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCoils.map((coil) => (
                <tr
                  key={coil.id}
                  className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/30"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/inventory/raw-coils/${coil.id}`}
                        className="text-sm text-zinc-100 font-medium hover:text-zinc-300 underline decoration-dotted underline-offset-2"
                      >
                        {coil.code}
                      </Link>
                      <Link
                        href={`/inventory/raw-coils/${coil.id}`}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="View coil details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {coil.supplier?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {coil.materialFamily?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400 text-right">
                    {coil.width ? Number(coil.width).toFixed(3) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400 text-right">
                    {coil.thicknessMm ? Number(coil.thicknessMm).toFixed(3) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400 text-right">
                    {formatWeight(coil.purchaseWeight)}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-100 text-right font-medium">
                    {formatWeight(coil.currentWeight)}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400 text-right">
                    {formatPaisa(coil.purchaseRatePaisa)}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-100 text-right font-medium">
                    {formatPaisa(coil.purchaseAmountPaisa)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                        statusColors[coil.status]
                      }`}
                    >
                      {coil.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {formatDate(coil.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}