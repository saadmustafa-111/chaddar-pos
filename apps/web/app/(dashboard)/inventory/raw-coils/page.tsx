'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  coilsApi,
  Coil,
  InventoryStatus,
  UpdateCoilRequest,
} from '../../../../features/coils/api/coils';
import {
  formatPaisa,
  formatWeight,
  formatDate,
} from '../../../../features/shared/utils/format';
import {
  suppliersApi,
  Supplier,
} from '../../../../features/suppliers/api/suppliers';
import { ConfirmDialog } from '../../../../features/ui';

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

  const [editCoil, setEditCoil] = useState<Coil | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [deleteCoil, setDeleteCoil] = useState<Coil | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  const reload = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await coilsApi.findAll();
      setCoils(data);
    } catch {
      setError('Failed to reload coils');
    } finally {
      setIsLoading(false);
    }
  };

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

  const openEdit = (coil: Coil) => {
    setEditCoil(coil);
    setEditLocation(coil.location ?? '');
    setEditNotes(coil.notes ?? '');
    setSaveError('');
  };

  const closeEdit = () => {
    setEditCoil(null);
    setEditLocation('');
    setEditNotes('');
    setSaveError('');
  };

  const saveEdit = async () => {
    if (!editCoil) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const data: UpdateCoilRequest = {};
      if (editLocation !== (editCoil.location ?? '')) {
        data.location = editLocation || undefined;
      }
      if (editNotes !== (editCoil.notes ?? '')) {
        data.notes = editNotes || undefined;
      }
      if (Object.keys(data).length === 0) {
        closeEdit();
        return;
      }
      const updated = await coilsApi.update(editCoil.id, data);
      setCoils((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      closeEdit();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const openDelete = (coil: Coil) => {
    setDeleteCoil(coil);
    setDeleteError('');
  };

  const closeDelete = () => {
    setDeleteCoil(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteCoil) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await coilsApi.delete(deleteCoil.id);
      setCoils((prev) => prev.filter((c) => c.id !== deleteCoil.id));
      closeDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

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
          <h1 className="text-xl font-semibold text-zinc-100">
            Raw Coil Inventory
          </h1>
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-4 text-sm font-medium text-zinc-400">
                    Coil #
                  </th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-zinc-400">
                    Supplier
                  </th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-zinc-400">
                    Material
                  </th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-zinc-400">
                    Price Category
                  </th>
                  <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                    Width
                  </th>
                  <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                    Thickness (mm)
                  </th>
                  <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                    Original Wt
                  </th>
                  <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                    Current Wt
                  </th>
                  <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                    Rate / KG
                  </th>
                  <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                    Purchase Cost
                  </th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-zinc-400">
                    Status
                  </th>
                  <th className="text-left px-4 py-4 text-sm font-medium text-zinc-400">
                    Date
                  </th>
                  <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCoils.map((coil) => (
                  <tr
                    key={coil.id}
                    className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/inventory/raw-coils/${coil.id}`}
                          className="text-sm text-zinc-100 font-medium hover:text-zinc-300 underline decoration-dotted underline-offset-2"
                        >
                          {coil.code}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {coil.supplier?.name || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {coil.materialFamily?.name || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-300">
                      {coil.priceCategory?.name || (
                        <span className="text-zinc-600">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400 text-right">
                      {coil.width ? Number(coil.width).toFixed(3) : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400 text-right">
                      {coil.thicknessMm
                        ? Number(coil.thicknessMm).toFixed(3)
                        : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400 text-right">
                      {formatWeight(coil.purchaseWeight)}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-100 text-right font-medium">
                      {formatWeight(coil.currentWeight)}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400 text-right">
                      {formatPaisa(coil.purchaseRatePaisa)}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-100 text-right font-medium">
                      {formatPaisa(coil.purchaseAmountPaisa)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                          statusColors[coil.status]
                        }`}
                      >
                        {coil.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {formatDate(coil.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(coil)}
                          className="text-zinc-400 hover:text-zinc-100 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDelete(coil)}
                          className="text-zinc-400 hover:text-red-400 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editCoil && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-100">
                Edit Coil {editCoil.code}
              </h2>
              <button
                onClick={closeEdit}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {saveError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{saveError}</p>
                </div>
              )}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Warehouse A, Rack 3"
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Any notes about this coil..."
                  rows={3}
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
              <button
                onClick={closeEdit}
                disabled={isSaving}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveEdit()}
                disabled={isSaving}
                className="bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteCoil !== null}
        title={`Delete Coil ${deleteCoil?.code ?? ''}?`}
        description={
          deleteCoil
            ? `This will permanently delete coil ${deleteCoil.code}. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={closeDelete}
      />

      {deleteError && (
        <div className="fixed bottom-4 right-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 max-w-sm z-50">
          <p className="text-sm text-red-400">{deleteError}</p>
        </div>
      )}
    </div>
  );
}
