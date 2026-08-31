'use client';

import { useEffect, useState } from 'react';
import {
  Customer,
  customersApi,
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from '../../../features/customers/api/customers';
import {
  FormField,
  TextInput,
  TextareaInput,
  PrimaryButton,
  ErrorBanner,
  LoadingState,
  EmptyState,
  DataTable,
  TBody,
  TR,
  TD,
  StatusBadge,
  InlineError,
  ConfirmDialog,
} from '../../../features/ui';
import { formatPaisa, formatDate } from '../../../features/shared/utils/format';
import Link from 'next/link';

function CustomerFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setName('');
      setPhone('');
      setAddress('');
      setNote('');
      setError('');
    });
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const payload: CreateCustomerRequest = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      note: note.trim() || undefined,
    };
    setIsSaving(true);
    try {
      const created = await customersApi.create(payload);
      onSaved(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">
            Add Customer
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Create a customer record to track sales, credit and payments.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Name" required>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={100}
              required
              placeholder="e.g. Khan Traders"
            />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Phone">
              <TextInput
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Address">
              <TextInput
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={255}
                placeholder="Optional"
              />
            </FormField>
          </div>
          <FormField label="Note">
            <TextareaInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Optional"
            />
          </FormField>
          {error && <InlineError message={error} />}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="text-sm text-zinc-400 hover:text-zinc-200 font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <PrimaryButton
              type="submit"
              isLoading={isSaving}
              loadingLabel="Creating..."
            >
              Create Customer
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? '');
  const [address, setAddress] = useState(customer.address ?? '');
  const [note, setNote] = useState(customer.note ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const payload: UpdateCustomerRequest = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      note: note.trim() || undefined,
    };
    setIsSaving(true);
    try {
      const updated = await customersApi.update(customer.id, payload);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">
            Edit Customer
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Update customer details. To archive, use the active/inactive toggle.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Name" required>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={100}
              required
            />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Phone">
              <TextInput
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
              />
            </FormField>
            <FormField label="Address">
              <TextInput
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={255}
              />
            </FormField>
          </div>
          <FormField label="Note">
            <TextareaInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </FormField>
          {error && <InlineError message={error} />}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              Save Changes
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    (async () => {
      try {
        const data = await customersApi.findAll(search);
        if (cancelled) return;
        setCustomers(data);
        setError('');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load customers');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search]);

  const handleSaved = (c: Customer) => {
    setCustomers((prev) => {
      const exists = prev.some((x) => x.id === c.id);
      if (exists) return prev.map((x) => (x.id === c.id ? c : x));
      return [c, ...prev];
    });
  };

  const openDelete = (c: Customer) => {
    setDeleteCustomer(c);
    setDeleteError('');
  };

  const closeDelete = () => {
    setDeleteCustomer(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteCustomer) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await customersApi.remove(deleteCustomer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== deleteCustomer.id));
      closeDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Customers</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage customers, track credit and payments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
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
          Add Customer
        </button>
      </div>

      <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or code..."
          className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600"
        />
      </div>

      {error && <ErrorBanner message={error} />}

      {isLoading ? (
        <LoadingState message="Loading customers..." />
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to start tracking credit sales and payments."
          action={
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium px-4 py-2 rounded-lg"
            >
              Add Customer
            </button>
          }
        />
      ) : (
        <DataTable
          headers={[
            { label: 'Code' },
            { label: 'Name' },
            { label: 'Phone' },
            { label: 'Outstanding', align: 'right' },
            { label: 'Status' },
            { label: 'Added' },
            { label: '', align: 'right' },
          ]}
        >
          <TBody>
            {customers.map((c) => {
              const balance = Number(c.currentBalancePaisa);
              return (
                <TR key={c.id}>
                  <TD className="text-xs text-zinc-500 font-mono">
                    {c.code}
                  </TD>
                  <TD>
                    <Link
                      href={`/customers/${c.id}`}
                      className="text-sm text-zinc-100 font-medium hover:text-zinc-300 underline decoration-dotted underline-offset-2"
                    >
                      {c.name}
                    </Link>
                    {c.address && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {c.address}
                      </div>
                    )}
                  </TD>
                  <TD className="text-sm text-zinc-400">
                    {c.phone || <span className="text-zinc-600">—</span>}
                  </TD>
                  <TD align="right">
                    <span
                      className={`text-sm font-semibold ${
                        balance > 0
                          ? 'text-red-400'
                          : balance < 0
                            ? 'text-blue-400'
                            : 'text-zinc-300'
                      }`}
                    >
                      {formatPaisa(balance)}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge variant={c.isActive ? 'green' : 'zinc'}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </TD>
                  <TD className="text-sm text-zinc-500">
                    {formatDate(c.createdAt)}
                  </TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditCustomer(c)}
                        className="text-zinc-400 hover:text-zinc-100 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDelete(c)}
                        className="text-zinc-400 hover:text-red-400 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </DataTable>
      )}

      <CustomerFormModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={(c) => {
          handleSaved(c);
        }}
      />

      {editCustomer && (
        <EditCustomerModal
          customer={editCustomer}
          onClose={() => setEditCustomer(null)}
          onSaved={(c) => {
            handleSaved(c);
            setEditCustomer(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteCustomer !== null}
        title={`Delete Customer ${deleteCustomer?.name ?? ''}?`}
        description={
          deleteCustomer
            ? `Permanently delete ${deleteCustomer.name}? Customers with sales or payment history cannot be deleted — archive them instead to keep records intact.`
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
