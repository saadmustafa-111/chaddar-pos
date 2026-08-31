'use client';

import { useState } from 'react';
import {
  PriceCategory,
  UpdatePriceCategoryRequest,
  priceCategoriesApi,
} from '../api/price-categories';
import { formatPaisa, parseRupeeInput } from '../utils/money';
import { ConfirmDialog } from '../../ui';

interface Props {
  categories: PriceCategory[];
  onUpdated: (category: PriceCategory) => void;
  onDeleted?: (id: number) => void;
}

function formatPercent(marginPercentPaisa: number | null): string {
  if (marginPercentPaisa == null) return '—';
  const pct = marginPercentPaisa / 100;
  return `${pct.toFixed(2)}%`;
}

function formatMargin(paisa: number | null): string {
  if (paisa == null) return '—';
  return formatPaisa(paisa);
}

export function PriceCategoryTable({ categories, onUpdated, onDeleted }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftRate, setDraftRate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [deleteCategory, setDeleteCategory] = useState<PriceCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const startEdit = (category: PriceCategory) => {
    setEditingId(category.id);
    setDraftRate((category.sellingRatePaisa / 100).toFixed(2));
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftRate('');
    setError('');
  };

  const saveEdit = async (category: PriceCategory) => {
    setIsLoading(true);
    setError('');

    try {
      const sellingPaisa = parseRupeeInput(draftRate);
      if (sellingPaisa < 0) {
        setError('Selling rate cannot be negative');
        setIsLoading(false);
        return;
      }

      const data: UpdatePriceCategoryRequest = {
        sellingRatePaisa: sellingPaisa,
      };

      const updated = await priceCategoriesApi.update(category.id, data);
      onUpdated(updated);
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  const openDelete = (category: PriceCategory) => {
    setDeleteCategory(category);
    setDeleteError('');
  };

  const closeDelete = () => {
    setDeleteCategory(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteCategory) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await priceCategoriesApi.remove(deleteCategory.id);
      onDeleted?.(deleteCategory.id);
      closeDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-[#141A22] border border-zinc-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-4 text-sm font-medium text-zinc-400 w-40">
                Category
              </th>
              <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                Selling Rate / KG
              </th>
              <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                <span
                  title="System-calculated weighted average cost from available finished stock batches"
                >
                  Current Cost / KG
                </span>
              </th>
              <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                Margin / KG
              </th>
              <th className="text-right px-4 py-4 text-sm font-medium text-zinc-400">
                Margin %
              </th>
              <th className="w-32 px-4 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const isEditing = editingId === category.id;
              const hasCost = category.currentCostPerKgPaisa != null;
              const margin = category.marginPerKgPaisa;
              const marginNeg = margin != null && margin < 0;

              return (
                <tr
                  key={category.id}
                  className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900/50 transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          category.isActive ? 'bg-yellow-500' : 'bg-zinc-600'
                        }`}
                      />
                      <span className="text-zinc-100 font-medium">
                        {category.name}
                      </span>
                      {!category.isActive && (
                        <span className="text-xs text-zinc-500 ml-1">
                          (Inactive)
                        </span>
                      )}
                    </div>
                  </td>

                  {isEditing ? (
                    <>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-zinc-500 text-sm">Rs</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={draftRate}
                            onChange={(e) => setDraftRate(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                void saveEdit(category);
                              } else if (e.key === 'Escape') {
                                cancelEdit();
                              }
                            }}
                            className="w-28 bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-right focus:outline-none focus:ring-2 focus:ring-zinc-600"
                            autoFocus
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-zinc-400 text-sm">
                        {hasCost ? (
                          formatPaisa(category.currentCostPerKgPaisa!)
                        ) : (
                          <span
                            className="text-zinc-500"
                            title="No available finished stock for this category"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-zinc-400 text-sm">
                        {hasCost ? (
                          formatMargin(margin)
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-zinc-400 text-sm">
                        {hasCost ? (
                          formatPercent(category.marginPercentPaisa)
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={cancelEdit}
                            disabled={isLoading}
                            className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void saveEdit(category)}
                            disabled={isLoading}
                            className="bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {isLoading ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4 text-right text-zinc-100 font-medium">
                        {formatPaisa(category.sellingRatePaisa)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {hasCost ? (
                          <span
                            className="text-zinc-400 text-sm"
                            title="Weighted avg cost from available finished stock"
                          >
                            {formatPaisa(category.currentCostPerKgPaisa!)}
                          </span>
                        ) : (
                          <span
                            className="text-zinc-500 text-sm italic"
                            title="No available finished stock for this category"
                          >
                            No stock cost available
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {hasCost ? (
                          <span
                            className={`text-sm font-medium ${
                              marginNeg ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {formatMargin(margin)}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {hasCost ? (
                          <span
                            className={`text-sm font-medium ${
                              marginNeg ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {formatPercent(category.marginPercentPaisa)}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => startEdit(category)}
                          className="text-zinc-400 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDelete(category)}
                          className="text-zinc-400 hover:text-red-400 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <ConfirmDialog
        open={deleteCategory !== null}
        title={`Delete ${deleteCategory?.name ?? ''}?`}
        description={
          deleteCategory
            ? `Permanently delete price category "${deleteCategory.name}"? This cannot be undone. Categories referenced by coils or finished stock cannot be deleted.`
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
