'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  coilsApi,
  Coil,
  InventoryMovement,
  InventoryStatus,
} from '../../../../../features/coils/api/coils';
import {
  landingExpensesApi,
  LandingExpense,
  LandingExpenseType,
  CreateLandingExpenseRequest,
} from '../../../../../features/landing-expenses/api/landing-expenses';
import { formatPaisa, formatWeight, formatDate } from '../../../../../features/shared/utils/format';
import { parseRupeeInput } from '../../../../../features/shared/utils/format';

const statusColors: Record<InventoryStatus, string> = {
  RAW: 'bg-blue-500/10 text-blue-400',
  IN_PROCESS: 'bg-yellow-500/10 text-yellow-400',
  FINISHED: 'bg-green-500/10 text-green-400',
  DEPLETED: 'bg-zinc-500/10 text-zinc-400',
};

const movementTypeLabels: Record<string, string> = {
  PURCHASE_RECEIPT: 'Purchase Receipt',
  PROCESSING_INPUT: 'Processing Input',
  PROCESSING_OUTPUT: 'Processing Output',
  CUTTING_CONSUMPTION: 'Cutting Consumption',
  SHEET_PRODUCTION: 'Sheet Production',
  SCRAP: 'Scrap',
  SALE: 'Sale',
  ADJUSTMENT: 'Adjustment',
  RETURN: 'Return',
};

const expenseTypeLabels: Record<LandingExpenseType, string> = {
  TRANSPORT: 'Transport',
  FREIGHT: 'Freight',
  LOADING: 'Loading',
  UNLOADING: 'Unloading',
  HANDLING: 'Handling',
  DELIVERY: 'Delivery',
  OTHER: 'Other',
};

const EXPENSE_TYPES: LandingExpenseType[] = [
  'TRANSPORT',
  'FREIGHT',
  'LOADING',
  'UNLOADING',
  'HANDLING',
  'DELIVERY',
  'OTHER',
];

type StageKey = 'purchase' | 'landing' | 'processing' | 'wastage' | 'finished' | 'cutting' | 'sale';

interface Stage {
  key: StageKey;
  label: string;
  completed: boolean;
  current: boolean;
  upcoming: boolean;
}

function getCoilStages(coil: Coil, totalLandingExpenses: number): Stage[] {
  const hasPurchase = coil.purchaseAmountPaisa > 0;
  const hasLandingExpenses = totalLandingExpenses > 0;

  return [
    {
      key: 'purchase',
      label: 'Purchase',
      completed: hasPurchase,
      current: false,
      upcoming: false,
    },
    {
      key: 'landing',
      label: 'Landing',
      completed: hasPurchase && hasLandingExpenses,
      current: hasPurchase && !hasLandingExpenses,
      upcoming: !hasPurchase,
    },
    {
      key: 'processing',
      label: 'Processing',
      completed: false,
      current: false,
      upcoming: hasPurchase,
    },
    {
      key: 'wastage',
      label: 'Wastage',
      completed: false,
      current: false,
      upcoming: hasPurchase,
    },
    {
      key: 'finished',
      label: 'Finished Cost',
      completed: false,
      current: false,
      upcoming: hasPurchase,
    },
    {
      key: 'cutting',
      label: 'Cutting',
      completed: false,
      current: false,
      upcoming: hasPurchase,
    },
    {
      key: 'sale',
      label: 'Sale',
      completed: false,
      current: false,
      upcoming: hasPurchase,
    },
  ];
}

function LifecycleStepper({ stages }: { stages: Stage[] }) {
  return (
    <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  stage.completed
                    ? 'bg-green-500/20 text-green-400'
                    : stage.current
                    ? 'bg-zinc-700 text-zinc-100 ring-2 ring-zinc-500'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {stage.completed ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stage.current ? (
                  <div className="w-2 h-2 bg-zinc-100 rounded-full" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium ${
                  stage.completed
                    ? 'text-green-400'
                    : stage.current
                    ? 'text-zinc-100'
                    : 'text-zinc-500'
                }`}
              >
                {stage.label}
              </span>
            </div>
            {index < stages.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 mb-5 ${
                  stage.completed ? 'bg-green-500/40' : 'bg-zinc-800'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingStageCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="bg-[#0D1117] border border-zinc-800 rounded-xl p-4 opacity-60">
      <div className="mb-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Coming in next phase
        </span>
      </div>
      <h3 className="text-sm font-semibold text-zinc-400 mb-1">{title}</h3>
      <p className="text-xs text-zinc-600 mb-3">{description}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="inline-block text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-500"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function CostJourney({
  purchaseCost,
  landingExpenses,
  totalLandedCost,
  landedCostPerKg,
}: {
  purchaseCost: number;
  landingExpenses: number;
  totalLandedCost: number;
  landedCostPerKg: number;
}) {
  return (
    <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4">Cost Journey</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Purchase Cost</span>
          <span className="text-sm font-medium text-zinc-100">{formatPaisa(purchaseCost)}</span>
        </div>
        <div className="flex justify-center">
          <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">+ Landing Expenses</span>
          <span className="text-sm font-medium text-zinc-100">{formatPaisa(landingExpenses)}</span>
        </div>
        <div className="flex justify-center">
          <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2">
          <span className="text-xs font-medium text-zinc-100">Current Landed Cost</span>
          <span className="text-sm font-semibold text-zinc-100">{formatPaisa(totalLandedCost)}</span>
        </div>
        <div className="flex justify-center">
          <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">+ Processing</span>
          <span className="text-xs text-zinc-600 italic">Not added yet</span>
        </div>
        <div className="flex justify-center">
          <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">- Wastage</span>
          <span className="text-xs text-zinc-600 italic">Not calculated</span>
        </div>
        <div className="flex justify-center">
          <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-700 pt-3">
          <span className="text-xs font-medium text-zinc-400">Actual Finished Cost</span>
          <span className="text-xs text-zinc-600 italic">Pending</span>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Landed Cost / KG</span>
          <span className="text-sm font-medium text-zinc-100">{formatPaisa(Math.round(landedCostPerKg))}</span>
        </div>
      </div>
    </div>
  );
}

function AddExpenseModal({
  coilId,
  isOpen,
  onClose,
  onSuccess,
}: {
  coilId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<LandingExpenseType>('TRANSPORT');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const amountPaisa = parseRupeeInput(amount);
    if (amountPaisa <= 0) {
      setError('Amount must be greater than zero');
      setIsSubmitting(false);
      return;
    }

    try {
      const data: CreateLandingExpenseRequest = {
        type,
        amountPaisa,
        expenseDate,
        description: description.trim() || undefined,
        referenceNumber: reference.trim() || undefined,
      };
      await landingExpensesApi.create(coilId, data);
      setType('TRANSPORT');
      setAmount('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setReference('');
      setDescription('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Add Landing Expense</h2>
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
              Expense Type <span className="text-red-400">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LandingExpenseType)}
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {expenseTypeLabels[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Amount (Rs) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Expense Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              Reference #
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
              placeholder="Optional"
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
              disabled={isSubmitting || !amount}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {isSubmitting ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CoilDetailPage() {
  const params = useParams();
  const [coil, setCoil] = useState<Coil | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [expenses, setExpenses] = useState<LandingExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const loadExpenses = useCallback(async () => {
    if (!params.id) return;
    setIsLoadingExpenses(true);
    try {
      const data = await landingExpensesApi.findByCoil(Number(params.id));
      setExpenses(data);
    } catch {
      // Silently fail - expenses are not critical
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const id = parseInt(params.id as string, 10);
        if (isNaN(id)) {
          setError('Invalid coil ID');
          setIsLoading(false);
          return;
        }

        const [coilData, movementsData, expensesData] = await Promise.all([
          coilsApi.findOne(id),
          coilsApi.getMovements(id),
          landingExpensesApi.findByCoil(id).catch(() => [] as LandingExpense[]),
        ]);

        if (!cancelled) {
          setCoil(coilData);
          setMovements(movementsData);
          setExpenses(expensesData);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load coil details');
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const totalLandingExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.amountPaisa),
    0,
  );
  const landedCost = coil ? Number(coil.purchaseAmountPaisa) + totalLandingExpenses : 0;
  const landedCostPerKg =
    coil && Number(coil.currentWeight) > 0
      ? landedCost / Number(coil.currentWeight)
      : 0;

  const stages = coil ? getCoilStages(coil, totalLandingExpenses) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !coil) {
    return (
      <div className="p-8">
        <div className="bg-[#0B0F14] border border-red-500/30 rounded-xl p-6">
          <p className="text-sm text-red-400">{error || 'Coil not found'}</p>
        </div>
      </div>
    );
  }

  const coilSpec =
    [
      coil.materialFamily?.name,
      coil.thicknessMm ? `${Number(coil.thicknessMm).toFixed(3)} mm` : null,
      coil.width ? `${Number(coil.width).toFixed(3)} mm` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <AddExpenseModal
        coilId={coil.id}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadExpenses}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/inventory/raw-coils"
            className="text-sm text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Inventory
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-zinc-100">{coil.code}</h1>
            <span
              className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                statusColors[coil.status]
              }`}
            >
              {coil.status.replace('_', ' ')}
            </span>
          </div>
          {coilSpec && <p className="text-sm text-zinc-400 mt-1">{coilSpec}</p>}
          {coil.supplier && <p className="text-xs text-zinc-500 mt-0.5">Supplier: {coil.supplier.name}</p>}
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-xs text-zinc-500">Current Weight</div>
            <div className="text-sm font-medium text-zinc-100">{formatWeight(Number(coil.currentWeight))}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Purchase Cost</div>
            <div className="text-sm font-medium text-zinc-100">{formatPaisa(Number(coil.purchaseAmountPaisa))}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Landed Cost</div>
            <div className="text-sm font-semibold text-zinc-100">
              {isLoadingExpenses ? '...' : formatPaisa(landedCost)}
            </div>
          </div>
        </div>
      </div>

      {/* Lifecycle Stepper */}
      <LifecycleStepper stages={stages} />

      {/* Current Stage - Landing */}
      <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">
              Current Stage
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">Landing & Logistics</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Record transport, loading, unloading and other logistics costs incurred before manufacturing begins.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Landing Expense
          </button>
        </div>

        {/* Expense Type Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {EXPENSE_TYPES.map((type) => (
            <span
              key={type}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
              {expenseTypeLabels[type]}
            </span>
          ))}
        </div>

        {/* Landing Expenses Summary */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-[#0D1117] rounded-xl">
          <div>
            <div className="text-xs text-zinc-500 mb-1">Purchase Cost</div>
            <div className="text-sm font-medium text-zinc-100">{formatPaisa(Number(coil.purchaseAmountPaisa))}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">Landing Expenses</div>
            <div className="text-sm font-medium text-zinc-100">
              {isLoadingExpenses ? '...' : formatPaisa(totalLandingExpenses)}
            </div>
          </div>
          <div className="border-l border-zinc-700 pl-4">
            <div className="text-xs text-zinc-500 mb-1">Current Landed Cost</div>
            <div className="text-sm font-semibold text-zinc-100">
              {isLoadingExpenses ? '...' : formatPaisa(landedCost)}
            </div>
          </div>
          <div className="border-l border-zinc-700 pl-4">
            <div className="text-xs text-zinc-500 mb-1">Landed Cost / KG</div>
            <div className="text-sm font-semibold text-zinc-100">
              {isLoadingExpenses ? '...' : formatPaisa(Math.round(landedCostPerKg))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="col-span-2 space-y-6">
          {/* Landing Expense History */}
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4">Landing Expense History</h3>

            {isLoadingExpenses ? (
              <p className="text-sm text-zinc-500">Loading...</p>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-500 text-sm mb-2">No landing expenses recorded yet.</p>
                <p className="text-zinc-600 text-xs mb-4">
                  Add transport, freight, loading or other logistics costs before moving into manufacturing.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-zinc-400 hover:text-zinc-100 text-sm font-medium px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                >
                  + Add Landing Expense
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-3 bg-[#0D1117] rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                        <span className="text-xs font-medium text-zinc-400">
                          {expenseTypeLabels[expense.type]?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-zinc-100">
                          {expenseTypeLabels[expense.type] || expense.type}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          {expense.referenceNumber && <span>{expense.referenceNumber}</span>}
                          <span>{formatDate(expense.expenseDate)}</span>
                          {expense.description && <span className="text-zinc-600">· {expense.description}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-zinc-100">
                      {formatPaisa(Number(expense.amountPaisa))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inventory History */}
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-4">Inventory History</h3>

            {movements.length === 0 ? (
              <p className="text-sm text-zinc-500">No inventory movements recorded.</p>
            ) : (
              <div className="space-y-2">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between p-3 bg-[#0D1117] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          Number(movement.weightDelta) >= 0
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {Number(movement.weightDelta) >= 0 ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-zinc-100">
                          {movementTypeLabels[movement.type] || movement.type}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatDate(movement.createdAt)}
                          {movement.referenceCode && ` · ${movement.referenceCode}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-medium ${
                          Number(movement.weightDelta) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {Number(movement.weightDelta) >= 0 ? '+' : ''}
                        {formatWeight(movement.weightDelta)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Balance: {formatWeight(movement.weightBalance)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Cost Journey */}
          <CostJourney
            purchaseCost={Number(coil.purchaseAmountPaisa)}
            landingExpenses={totalLandingExpenses}
            totalLandedCost={landedCost}
            landedCostPerKg={landedCostPerKg}
          />

          {/* Upcoming Stages */}
          <UpcomingStageCard
            title="Processing & Manufacturing"
            description="Paint, coating, chemicals, labour, machine and electricity costs"
            items={['Paint / Coating', 'Chemical Treatment', 'Labour', 'Machine', 'Electricity', 'Other']}
          />

          <UpcomingStageCard
            title="Wastage & Scrap"
            description="Process loss, damage and rejection tracking"
            items={['Input Weight', 'Process Loss', 'Scrap Generated', 'Damage / Rejection']}
          />

          <UpcomingStageCard
            title="Actual Finished Cost"
            description="Total cost per usable unit"
            items={['Total Cost', 'Usable Weight', 'Finished Cost / KG']}
          />

          <UpcomingStageCard
            title="Cutting"
            description="Sheet cutting and dimension planning"
            items={['Length', 'Width', 'Quantity', 'Cutting Charges']}
          />
        </div>
      </div>
    </div>
  );
}