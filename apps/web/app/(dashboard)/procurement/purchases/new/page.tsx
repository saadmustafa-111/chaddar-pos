'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { suppliersApi, Supplier } from '../../../../../features/suppliers/api/suppliers';
import {
  purchasesApi,
  CreatePurchaseRequest,
  CreateCoilRequest,
} from '../../../../../features/purchases/api/purchases';
import {
  materialFamiliesApi,
  MaterialFamily,
  CreateMaterialFamilyRequest,
} from '../../../../../features/material-families/api/material-families';
import { formatPaisa, parseRupeeInput, parseWeightInput } from '../../../../../features/shared/utils/format';

interface CoilFormState {
  materialFamilyId: number | '';
  brand: string;
  color: string;
  batchNumber: string;
  width: string;
  thicknessMm: string;
  grossWeight: string;
  purchaseWeight: string;
  purchaseRate: string;
  location: string;
  notes: string;
}

const emptyCoilForm = (): CoilFormState => ({
  materialFamilyId: '',
  brand: '',
  color: '',
  batchNumber: '',
  width: '',
  thicknessMm: '',
  grossWeight: '',
  purchaseWeight: '',
  purchaseRate: '',
  location: '',
  notes: '',
});

function CategoryComboBox({
  families,
  value,
  onChange,
  onAddNew,
  isLoading,
}: {
  families: MaterialFamily[];
  value: number | '';
  onChange: (id: number | '') => void;
  onAddNew: () => void;
  isLoading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = families.find((f) => f.id === value);

  const filtered = families.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-500 text-sm">
        Loading categories...
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-left text-sm flex items-center justify-between"
      >
        {selected ? (
          <span className="text-zinc-100">{selected.name}</span>
        ) : (
          <span className="text-zinc-500">Select category</span>
        )}
        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#141A22] border border-zinc-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-zinc-800">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category..."
              className="w-full bg-[#0D1117] border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500 text-center">
                No categories found
              </div>
            ) : (
              filtered.map((family) => (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => {
                    onChange(family.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  {family.name}
                </button>
              ))
            )}
          </div>

          <div className="p-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSearch('');
                onAddNew();
              }}
              className="w-full px-3 py-2 text-left text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              Add New Family / Category
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddCategoryModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (family: MaterialFamily) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const data: CreateMaterialFamilyRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
      };
      const created = await materialFamiliesApi.create(data);
      onCreated(created);
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Add Family / Category</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
              placeholder="e.g. Galvanized Steel"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-none"
              placeholder="Optional description..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewPurchasePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialFamilies, setMaterialFamilies] = useState<MaterialFamily[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [isLoadingFamilies, setIsLoadingFamilies] = useState(true);
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [notes, setNotes] = useState('');
  const [coils, setCoils] = useState<CoilFormState[]>([emptyCoilForm()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [activeCoilIndex, setActiveCoilIndex] = useState<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSuppliers() {
      try {
        const data = await suppliersApi.findActive();
        if (!isCancelled) {
          setSuppliers(data);
        }
      } catch {
        if (!isCancelled) {
          setError('Failed to load suppliers');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSuppliers(false);
        }
      }
    }

    async function loadMaterialFamilies() {
      try {
        const data = await materialFamiliesApi.findActive();
        if (!isCancelled) {
          setMaterialFamilies(data);
        }
      } catch {
        if (!isCancelled) {
          setError('Failed to load categories');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingFamilies(false);
        }
      }
    }

    loadSuppliers();
    loadMaterialFamilies();

    return () => {
      isCancelled = true;
    };
  }, []);

  const addCoil = () => {
    setCoils((prev) => [...prev, emptyCoilForm()]);
  };

  const removeCoil = (index: number) => {
    if (coils.length > 1) {
      setCoils((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateCoil = (index: number, field: keyof CoilFormState, value: string | number) => {
    setCoils((prev) =>
      prev.map((coil, i) => (i === index ? { ...coil, [field]: value } : coil)),
    );
  };

  const handleAddCategory = (index: number) => {
    setActiveCoilIndex(index);
    setShowCategoryModal(true);
  };

  const handleCategoryCreated = (family: MaterialFamily) => {
    setMaterialFamilies((prev) => [...prev, family]);
    if (activeCoilIndex !== null) {
      setCoils((prev) =>
        prev.map((coil, i) =>
          i === activeCoilIndex ? { ...coil, materialFamilyId: family.id } : coil,
        ),
      );
    }
    setActiveCoilIndex(null);
  };

  const calculateCoilAmount = (coil: CoilFormState): number => {
    const weight = parseWeightInput(coil.purchaseWeight);
    const rate = parseRupeeInput(coil.purchaseRate);
    if (weight <= 0 || rate <= 0) return 0;
    return Math.round(weight * rate);
  };

  const calculateTotalWeight = (): number => {
    return coils.reduce((sum, coil) => sum + parseWeightInput(coil.purchaseWeight), 0);
  };

  const calculateTotalAmount = (): number => {
    return coils.reduce((sum, coil) => sum + calculateCoilAmount(coil), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const coilRequests: CreateCoilRequest[] = coils
        .filter((coil) => coil.purchaseWeight && coil.purchaseRate)
        .map((coil) => ({
          materialFamilyId: coil.materialFamilyId !== '' ? (coil.materialFamilyId as number) : undefined,
          brand: coil.brand || undefined,
          color: coil.color || undefined,
          batchNumber: coil.batchNumber || undefined,
          width: parseWeightInput(coil.width) || 0,
          thicknessMm: coil.thicknessMm ? parseWeightInput(coil.thicknessMm) : undefined,
          grossWeight: coil.grossWeight ? parseWeightInput(coil.grossWeight) : undefined,
          purchaseWeight: parseWeightInput(coil.purchaseWeight),
          purchaseRatePaisa: parseRupeeInput(coil.purchaseRate),
          location: coil.location || undefined,
          notes: coil.notes || undefined,
        }));

      if (coilRequests.length === 0) {
        setError('At least one valid coil is required');
        setIsSubmitting(false);
        return;
      }

      const data: CreatePurchaseRequest = {
        supplierId: supplierId as number,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        purchaseDate,
        notes: notes || undefined,
        coils: coilRequests,
      };

      await purchasesApi.create(data);
      router.push('/procurement/purchases');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingSuppliers || isLoadingFamilies) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">New Coil Purchase</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Record a new coil purchase from a supplier.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">
            Purchase Information
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Supplier <span className="text-red-400">*</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) =>
                  setSupplierId(e.target.value ? parseInt(e.target.value) : '')
                }
                required
                className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Purchase Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Supplier Invoice #
              </label>
              <input
                type="text"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-none"
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-100">Coils</h2>
            <button
              type="button"
              onClick={addCoil}
              className="text-zinc-400 hover:text-zinc-100 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              + Add Another Coil
            </button>
          </div>

          <div className="space-y-6">
            {coils.map((coil, index) => (
              <div
                key={index}
                className="bg-[#0D1117] border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-zinc-400">
                    Coil #{index + 1}
                  </span>
                  {coils.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCoil(index)}
                      className="text-zinc-500 hover:text-red-400 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
                      Material
                    </label>
                    <CategoryComboBox
                      families={materialFamilies}
                      value={coil.materialFamilyId}
                      onChange={(id) => updateCoil(index, 'materialFamilyId', id)}
                      onAddNew={() => handleAddCategory(index)}
                      isLoading={isLoadingFamilies}
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                        Brand
                      </label>
                      <input
                        type="text"
                        value={coil.brand}
                        onChange={(e) => updateCoil(index, 'brand', e.target.value)}
                        className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                        Color
                      </label>
                      <input
                        type="text"
                        value={coil.color}
                        onChange={(e) => updateCoil(index, 'color', e.target.value)}
                        className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                        Batch / Heat #
                      </label>
                      <input
                        type="text"
                        value={coil.batchNumber}
                        onChange={(e) => updateCoil(index, 'batchNumber', e.target.value)}
                        className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                        Location
                      </label>
                      <input
                        type="text"
                        value={coil.location}
                        onChange={(e) => updateCoil(index, 'location', e.target.value)}
                        className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-4">
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
                      Dimensions
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                          Width (mm) <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={coil.width}
                          onChange={(e) => updateCoil(index, 'width', e.target.value)}
                          required
                          className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                          placeholder="0.000"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                          Gauge / Thickness (mm)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={coil.thicknessMm}
                          onChange={(e) => updateCoil(index, 'thicknessMm', e.target.value)}
                          className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                          placeholder="0.000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-4">
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
                      Inventory
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                          Gross Weight (KG)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={coil.grossWeight}
                          onChange={(e) => updateCoil(index, 'grossWeight', e.target.value)}
                          className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                          placeholder="0.000"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                          Purchase Weight (KG) <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={coil.purchaseWeight}
                          onChange={(e) => updateCoil(index, 'purchaseWeight', e.target.value)}
                          required
                          className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                          placeholder="0.000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-4">
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
                      Purchase Pricing
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                          Rate / KG (Rs) <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={coil.purchaseRate}
                          onChange={(e) => updateCoil(index, 'purchaseRate', e.target.value)}
                          required
                          className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="col-span-2 flex items-end">
                        <div className="bg-zinc-800/50 rounded-lg px-3 py-2 w-full">
                          <div className="text-xs font-medium text-zinc-500 mb-0.5">
                            Calculated Cost
                          </div>
                          <div className="text-sm font-semibold text-zinc-100">
                            {formatPaisa(calculateCoilAmount(coil))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={coil.notes}
                      onChange={(e) => updateCoil(index, 'notes', e.target.value)}
                      className="w-full bg-[#141A22] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                      placeholder="Optional notes for this coil"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">
            Purchase Summary
          </h2>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-1">
                Number of Coils
              </div>
              <div className="text-2xl font-semibold text-zinc-100">
                {coils.filter((c) => c.purchaseWeight).length}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-500 mb-1">
                Total Weight
              </div>
              <div className="text-2xl font-semibold text-zinc-100">
                {calculateTotalWeight().toFixed(3)} KG
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-500 mb-1">
                Purchase Total
              </div>
              <div className="text-2xl font-semibold text-zinc-100">
                {formatPaisa(calculateTotalAmount())}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !supplierId || coils.length === 0}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Save Purchase'}
          </button>
        </div>
      </form>

      <AddCategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setActiveCoilIndex(null);
        }}
        onCreated={handleCategoryCreated}
      />
    </div>
  );
}