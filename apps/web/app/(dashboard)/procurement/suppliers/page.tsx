'use client';

import { useEffect, useState } from 'react';
import {
  suppliersApi,
  Supplier,
  SupplierWithTotals,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from '../../../../features/suppliers/api/suppliers';
import {
  FormField,
  TextInput,
  PrimaryButton,
  ErrorBanner,
  LoadingState,
  EmptyState,
  DataTable,
  TBody,
  TR,
  TD,
  StatusBadge,
  ConfirmDialog,
} from '../../../../features/ui';
import { formatPaisa, formatDate } from '../../../../features/shared/utils/format';
import Link from 'next/link';

interface SupplierFormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  notes: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithTotals[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState<SupplierFormState>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState<SupplierFormState>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    notes: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [saveEditError, setSaveEditError] = useState('');

  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    (async () => {
      try {
        const data = await suppliersApi.findAllWithTotals();
        if (cancelled) return;
        setSuppliers(data);
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load suppliers',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = async () => {
    try {
      const data = await suppliersApi.findAllWithTotals();
      setSuppliers(data);
    } catch {
      /* keep existing list on reload failure */
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const data: CreateSupplierRequest = {
        name: formState.name,
        contactPerson: formState.contactPerson || undefined,
        phone: formState.phone || undefined,
        email: formState.email || undefined,
        address: formState.address || undefined,
        taxNumber: formState.taxNumber || undefined,
        notes: formState.notes || undefined,
      };

      const created = await suppliersApi.create(data);
      setSuppliers((prev) => [
        ...prev,
        {
          supplier: created,
          totals: {
            totalPurchasePaisa: 0,
            totalPaidPaisa: 0,
            outstandingPaisa: 0,
          },
        },
      ]);
      setShowModal(false);
      setFormState({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        taxNumber: '',
        notes: '',
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to create supplier',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openModal = () => {
    setSubmitError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitError('');
    setFormState({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      notes: '',
    });
  };

  const openEdit = (s: Supplier) => {
    setEditSupplier(s);
    setEditForm({
      name: s.name,
      contactPerson: s.contactPerson ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      taxNumber: s.taxNumber ?? '',
      notes: s.notes ?? '',
    });
    setSaveEditError('');
  };

  const closeEdit = () => {
    setEditSupplier(null);
    setEditForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      notes: '',
    });
    setSaveEditError('');
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveEdit = async () => {
    if (!editSupplier) return;
    setIsSavingEdit(true);
    setSaveEditError('');
    try {
      const data: UpdateSupplierRequest = {
        name: editForm.name,
        contactPerson: editForm.contactPerson || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
        taxNumber: editForm.taxNumber || undefined,
        notes: editForm.notes || undefined,
      };
      const updated = await suppliersApi.update(editSupplier.id, data);
      setSuppliers((prev) =>
        prev.map((st) =>
          st.supplier.id === updated.id ? { ...st, supplier: updated } : st,
        ),
      );
      closeEdit();
    } catch (err) {
      setSaveEditError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openDelete = (s: Supplier) => {
    setDeleteSupplier(s);
    setDeleteError('');
  };

  const closeDelete = () => {
    setDeleteSupplier(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteSupplier) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await suppliersApi.remove(deleteSupplier.id);
      setSuppliers((prev) =>
        prev.filter((st) => st.supplier.id !== deleteSupplier.id),
      );
      closeDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading suppliers..." />;
  }

  const totalOutstanding = suppliers.reduce(
    (sum, s) => sum + Number(s.totals.outstandingPaisa),
    0,
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Suppliers</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage steel coil suppliers and pay running balances.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Supplier
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#141A22] border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">
            Active suppliers
          </div>
          <div className="text-base font-semibold text-zinc-100 mt-1">
            {suppliers.filter((s) => s.supplier.isActive).length}
          </div>
        </div>
        <div className="bg-[#141A22] border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">
            Total outstanding
          </div>
          <div
            className={`text-base font-semibold mt-1 ${
              totalOutstanding > 0 ? 'text-yellow-400' : 'text-zinc-100'
            }`}
          >
            {formatPaisa(totalOutstanding)}
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="Add your first supplier to start tracking purchases and payments."
          action={
            <button
              type="button"
              onClick={openModal}
              className="text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium px-4 py-2 rounded-lg"
            >
              Add Supplier
            </button>
          }
        />
      ) : (
        <div className="bg-[#141A22] border border-zinc-800 rounded-xl overflow-hidden">
          <DataTable
            headers={[
              { label: 'Code' },
              { label: 'Name' },
              { label: 'Contact' },
              { label: 'Phone' },
              { label: 'Total Purchases', align: 'right' },
              { label: 'Outstanding', align: 'right' },
              { label: 'Status' },
              { label: '', align: 'right' },
            ]}
          >
            <TBody>
              {suppliers.map(({ supplier, totals }) => (
                <TR key={supplier.id}>
                  <TD className="text-xs text-zinc-500 font-mono">
                    {supplier.code}
                  </TD>
                  <TD>
                    <Link
                      href={`/procurement/suppliers/${supplier.id}`}
                      className="text-sm text-zinc-100 font-medium hover:text-zinc-300 underline decoration-dotted underline-offset-2"
                    >
                      {supplier.name}
                    </Link>
                    {supplier.contactPerson && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {supplier.contactPerson}
                      </div>
                    )}
                  </TD>
                  <TD className="text-sm text-zinc-400">
                    {supplier.email || '—'}
                  </TD>
                  <TD className="text-sm text-zinc-400">
                    {supplier.phone || '—'}
                  </TD>
                  <TD align="right" className="text-sm text-zinc-300">
                    {formatPaisa(Number(totals.totalPurchasePaisa))}
                  </TD>
                  <TD
                    align="right"
                    className={`text-sm font-semibold ${
                      Number(totals.outstandingPaisa) > 0
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    {formatPaisa(Number(totals.outstandingPaisa))}
                  </TD>
                  <TD>
                    <StatusBadge variant={supplier.isActive ? 'green' : 'zinc'}>
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(supplier)}
                        className="text-zinc-400 hover:text-zinc-100 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDelete(supplier)}
                        className="text-zinc-400 hover:text-red-400 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </DataTable>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100">
                Add Supplier
              </h2>
              <button
                onClick={closeModal}
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

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}

              <FormField label="Supplier Name" required>
                <TextInput
                  value={formState.name}
                  onChange={handleInputChange}
                  required
                  name="name"
                  maxLength={100}
                  placeholder="e.g. Mubarak Steel"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Contact Person">
                  <TextInput
                    name="contactPerson"
                    value={formState.contactPerson}
                    onChange={handleInputChange}
                    maxLength={100}
                    placeholder="John Doe"
                  />
                </FormField>
                <FormField label="Phone">
                  <TextInput
                    name="phone"
                    value={formState.phone}
                    onChange={handleInputChange}
                    maxLength={20}
                    placeholder="+92 300 1234567"
                  />
                </FormField>
              </div>

              <FormField label="Email">
                <TextInput
                  type="email"
                  name="email"
                  value={formState.email}
                  onChange={handleInputChange}
                  maxLength={100}
                  placeholder="supplier@example.com"
                />
              </FormField>

              <FormField label="Address">
                <TextInput
                  name="address"
                  value={formState.address}
                  onChange={handleInputChange}
                  maxLength={255}
                  placeholder="Full address"
                />
              </FormField>

              <FormField label="Tax / NTN Number">
                <TextInput
                  name="taxNumber"
                  value={formState.taxNumber}
                  onChange={handleInputChange}
                  maxLength={50}
                  placeholder="1234567-8"
                />
              </FormField>

              <FormField label="Notes">
                <TextInput
                  name="notes"
                  value={formState.notes}
                  onChange={handleInputChange}
                  maxLength={255}
                  placeholder="Anything to remember"
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <PrimaryButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingLabel="Creating..."
                  disabled={!formState.name.trim()}
                >
                  Create Supplier
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {editSupplier && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100">
                Edit Supplier
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
            <div className="p-6 space-y-4">
              {saveEditError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{saveEditError}</p>
                </div>
              )}
              <FormField label="Supplier Name" required>
                <TextInput
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                  name="name"
                  maxLength={100}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Contact Person">
                  <TextInput
                    name="contactPerson"
                    value={editForm.contactPerson}
                    onChange={handleEditChange}
                    maxLength={100}
                  />
                </FormField>
                <FormField label="Phone">
                  <TextInput
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    maxLength={20}
                  />
                </FormField>
              </div>
              <FormField label="Email">
                <TextInput
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  maxLength={100}
                />
              </FormField>
              <FormField label="Address">
                <TextInput
                  name="address"
                  value={editForm.address}
                  onChange={handleEditChange}
                  maxLength={255}
                />
              </FormField>
              <FormField label="Tax / NTN Number">
                <TextInput
                  name="taxNumber"
                  value={editForm.taxNumber}
                  onChange={handleEditChange}
                  maxLength={50}
                />
              </FormField>
              <FormField label="Notes">
                <TextInput
                  name="notes"
                  value={editForm.notes}
                  onChange={handleEditChange}
                  maxLength={255}
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={closeEdit}
                disabled={isSavingEdit}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveEdit()}
                disabled={isSavingEdit}
                className="bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteSupplier !== null}
        title={`Delete Supplier ${deleteSupplier?.name ?? ''}?`}
        description={
          deleteSupplier
            ? `Permanently delete ${deleteSupplier.name}? Suppliers with purchase or payment history cannot be deleted — archive them instead to keep records intact.`
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
