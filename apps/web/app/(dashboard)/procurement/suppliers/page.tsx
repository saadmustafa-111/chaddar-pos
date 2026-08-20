'use client';

import { useEffect, useState } from 'react';
import { suppliersApi, Supplier, CreateSupplierRequest } from '../../../../features/suppliers/api/suppliers';

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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

  useEffect(() => {
    let isCancelled = false;

    async function loadSuppliers() {
      try {
        const data = await suppliersApi.findAll();
        if (!isCancelled) {
          setSuppliers(data);
        }
      } catch {
        if (!isCancelled) {
          setError('Failed to load suppliers');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSuppliers();

    return () => {
      isCancelled = true;
    };
  }, []);

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
      setSuppliers((prev) => [...prev, created]);
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
      setSubmitError(err instanceof Error ? err.message : 'Failed to create supplier');
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
          <h1 className="text-xl font-semibold text-zinc-100">Suppliers</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage steel coil suppliers and vendor information.
          </p>
        </div>
        <button
          onClick={openModal}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          Add Supplier
        </button>
      </div>

      {error ? (
        <div className="bg-[#0B0F14] border border-red-500/30 rounded-xl p-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No suppliers yet. Add your first supplier to get started.</p>
        </div>
      ) : (
        <div className="bg-[#141A22] border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Code
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Name
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Contact
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Phone
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Email
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/30"
                >
                  <td className="px-6 py-4 text-sm text-zinc-400">{supplier.code}</td>
                  <td className="px-6 py-4 text-sm text-zinc-100 font-medium">
                    {supplier.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {supplier.contactPerson || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {supplier.phone || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {supplier.email || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                        supplier.isActive
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-zinc-500/10 text-zinc-400'
                      }`}
                    >
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100">Add Supplier</h2>
              <button
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Supplier Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formState.name}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="Enter supplier name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formState.contactPerson}
                    onChange={handleInputChange}
                    className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formState.phone}
                    onChange={handleInputChange}
                    className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    placeholder="+92 300 1234567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formState.email}
                  onChange={handleInputChange}
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="supplier@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formState.address}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-none"
                  placeholder="Enter full address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Tax / NTN Number
                </label>
                <input
                  type="text"
                  name="taxNumber"
                  value={formState.taxNumber}
                  onChange={handleInputChange}
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                  placeholder="1234567-8"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formState.notes}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-none"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}