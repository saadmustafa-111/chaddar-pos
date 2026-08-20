'use client';

import { useState } from 'react';
import { PriceCategory, priceCategoriesApi, UpdatePriceCategoryRequest } from '../api/price-categories';
import { formatPaisa, parseRupeeInput } from '../utils/money';

interface Props {
  categories: PriceCategory[];
  onUpdated: (category: PriceCategory) => void;
}

interface EditState {
  id: number | null;
  purchaseRate: string;
  sellingRate: string;
}

export function PriceCategoryTable({ categories, onUpdated }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({
    id: null,
    purchaseRate: '',
    sellingRate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (category: PriceCategory) => {
    setEditingId(category.id);
    setEditState({
      id: category.id,
      purchaseRate: (category.purchaseRatePaisa / 100).toFixed(2),
      sellingRate: (category.sellingRatePaisa / 100).toFixed(2),
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState({ id: null, purchaseRate: '', sellingRate: '' });
    setError('');
  };

  const saveEdit = async () => {
    if (editState.id === null) return;

    setIsLoading(true);
    setError('');

    try {
      const purchasePaisa = parseRupeeInput(editState.purchaseRate);
      const sellingPaisa = parseRupeeInput(editState.sellingRate);

      if (purchasePaisa < 0 || sellingPaisa < 0) {
        setError('Rates cannot be negative');
        setIsLoading(false);
        return;
      }

      const data: UpdatePriceCategoryRequest = {
        purchaseRatePaisa: purchasePaisa,
        sellingRatePaisa: sellingPaisa,
      };

      const updated = await priceCategoriesApi.update(editState.id, data);
      onUpdated(updated);
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <div className="bg-[#141A22] border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
              Category
            </th>
            <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
              Purchase / KG
            </th>
            <th className="text-right px-6 py-4 text-sm font-medium text-zinc-400">
              Selling / KG
            </th>
            <th className="w-24 px-6 py-4"></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr
              key={category.id}
              className="border-b border-zinc-800 last:border-b-0"
            >
              <td className="px-6 py-4">
                <span className="text-zinc-100 font-medium">{category.name}</span>
              </td>

              {editingId === category.id ? (
                <>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-zinc-500 text-sm">Rs</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editState.purchaseRate}
                        onChange={(e) =>
                          setEditState((s) => ({
                            ...s,
                            purchaseRate: e.target.value,
                          }))
                        }
                        onKeyDown={handleKeyDown}
                        className="w-28 bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-right focus:outline-none focus:ring-2 focus:ring-zinc-600"
                        autoFocus
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-zinc-500 text-sm">Rs</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editState.sellingRate}
                        onChange={(e) =>
                          setEditState((s) => ({
                            ...s,
                            sellingRate: e.target.value,
                          }))
                        }
                        onKeyDown={handleKeyDown}
                        className="w-28 bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-right focus:outline-none focus:ring-2 focus:ring-zinc-600"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={isLoading}
                        className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {isLoading ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-6 py-4 text-right text-zinc-100">
                    {formatPaisa(category.purchaseRatePaisa)}
                  </td>
                  <td className="px-6 py-4 text-right text-zinc-100">
                    {formatPaisa(category.sellingRatePaisa)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => startEdit(category)}
                      className="text-zinc-400 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {error && (
        <div className="px-6 py-3 bg-red-500/10 border-t border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
