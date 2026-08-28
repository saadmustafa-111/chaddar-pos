'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  otherItemsApi,
  OtherItem,
  CreateOtherItemRequest,
  UpdateOtherItemRequest,
} from '../../../../features/other-items/api/other-items';
import {
  ErrorBanner,
  LoadingState,
  PrimaryButton,
  SectionCard,
  TextInput,
  FormField,
  DataTable,
  TBody,
  TR,
  TD,
  EmptyState,
} from '../../../../features/ui';
import { formatPaisa, parseRupeeInput } from '../../../../features/shared/utils/format';
import { ConfirmDialog } from '../../../../features/ui/ConfirmDialog';

export default function OtherItemsPage() {
  const [items, setItems] = useState<OtherItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<OtherItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OtherItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formNote, setFormNote] = useState('');

  const loadItems = useCallback(async (searchTerm?: string) => {
    try {
      const data = await otherItemsApi.findAll(searchTerm);
      setItems(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    (async () => {
      try {
        const data = await otherItemsApi.findAll(search || undefined);
        if (cancelled) return;
        setItems(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load items');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search]);

  const resetForm = () => {
    setFormName('');
    setFormPrice('');
    setFormNote('');
    setFormError('');
  };

  const openAddForm = () => {
    resetForm();
    setEditingItem(null);
    setShowAddForm(true);
  };

  const openEditForm = (item: OtherItem) => {
    setFormName(item.name);
    setFormPrice((item.pricePaisa / 100).toFixed(2));
    setFormNote(item.note || '');
    setEditingItem(item);
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingItem(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const pricePaisa = parseRupeeInput(formPrice);
    if (pricePaisa < 0) {
      setFormError('Price must be a valid positive number');
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        const data: UpdateOtherItemRequest = {
          name: formName.trim(),
          pricePaisa,
          note: formNote.trim() || undefined,
        };
        await otherItemsApi.update(editingItem.id, data);
      } else {
        const data: CreateOtherItemRequest = {
          name: formName.trim(),
          pricePaisa,
          note: formNote.trim() || undefined,
        };
        await otherItemsApi.create(data);
      }
      closeForm();
      await loadItems(search || undefined);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await otherItemsApi.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadItems(search || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  if (isLoading) {
    return <LoadingState message="Loading items..." />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Other Items</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Miscellaneous items that do not follow the coil inventory lifecycle.
          </p>
        </div>
        <PrimaryButton type="button" onClick={openAddForm}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Item
        </PrimaryButton>
      </div>

      {error && <ErrorBanner message={error} />}

      <SectionCard
        title="Items"
        description="Manage miscellaneous items like scrap, spares, or old chaddar."
      >
        <div className="p-6 border-b border-zinc-800">
          <FormField label="Search" className="max-w-sm">
            <TextInput
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name..."
            />
          </FormField>
        </div>

        <DataTable
          headers={[
            { label: 'Item Name' },
            { label: 'Price', align: 'right' },
            { label: 'Note' },
            { label: 'Added', align: 'right' },
            { label: 'Actions' },
          ]}
        >
          <TBody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    title="No items found"
                    description={search ? 'Try a different search term.' : 'Click "Add Item" to create one.'}
                  />
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <TR key={item.id}>
                  <TD className="text-sm font-medium text-zinc-100">
                    {item.name}
                  </TD>
                  <TD align="right" className="text-sm font-medium text-zinc-100">
                    {formatPaisa(item.pricePaisa)}
                  </TD>
                  <TD className="text-sm text-zinc-400 max-w-xs truncate">
                    {item.note || '—'}
                  </TD>
                  <TD align="right" className="text-sm text-zinc-500">
                    {new Date(item.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </SectionCard>

      {showAddForm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
          onClick={closeForm}
        >
          <div
            className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-100">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {editingItem
                  ? 'Update the item details below.'
                  : 'Enter the details for the new miscellaneous item.'}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <FormField label="Name" required>
                <TextInput
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Old Chaddar, Scrap Material"
                  required
                  autoFocus
                />
              </FormField>
              <FormField label="Price (Rs)" required>
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </FormField>
              <FormField label="Note (optional)">
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Optional description or notes..."
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-y min-h-[60px]"
                />
              </FormField>
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{formError}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="text-sm text-zinc-400 hover:text-zinc-200 font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <PrimaryButton
                  type="submit"
                  isLoading={isSaving}
                  loadingLabel="Saving..."
                >
                  {editingItem ? 'Update' : 'Create'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Item"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
