'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  expensesApi,
  Expense,
  ExpenseSummary,
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS,
  CreateExpenseDto,
  UpdateExpenseDto,
} from '../../../features/expenses/api/expenses';
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
  SelectInput,
} from '../../../features/ui';
import { formatPaisa, parseRupeeInput } from '../../../features/shared/utils/format';
import { ConfirmDialog } from '../../../features/ui/ConfirmDialog';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(todayIso);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [formDate, setFormDate] = useState(todayIso());
  const [formCategory, setFormCategory] = useState<ExpenseCategory>(ExpenseCategory.MISCELLANEOUS);
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [expensesData, summaryData] = await Promise.all([
        expensesApi.findAll({
          dateFrom,
          dateTo,
          category: categoryFilter || undefined,
          search: search || undefined,
        }),
        expensesApi.getSummary({ dateFrom, dateTo }),
      ]);
      setExpenses(
        (expensesData ?? []).filter(
          (e): e is Expense => e !== null && e !== undefined && e.id != null,
        ),
      );
      setSummary(summaryData ?? null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, categoryFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormDate(todayIso());
    setFormCategory(ExpenseCategory.MISCELLANEOUS);
    setFormCustomCategory('');
    setFormAmount('');
    setFormNote('');
    setFormError('');
  };

  const openAddForm = () => {
    resetForm();
    setEditingExpense(null);
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setFormDate(expense.expenseDate);
    setFormCategory(expense.category as ExpenseCategory);
    setFormCustomCategory(expense.customCategory || '');
    setFormAmount((expense.amountPaisa / 100).toFixed(2));
    setFormNote(expense.note || '');
    setEditingExpense(expense);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingExpense(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const amountPaisa = parseRupeeInput(formAmount);
    if (amountPaisa < 0) {
      setFormError('Amount must be a valid positive number');
      return;
    }

    if (formCategory === ExpenseCategory.OTHER && !formCustomCategory.trim()) {
      setFormError('Custom category name is required when selecting "Other / Custom"');
      return;
    }

    setIsSaving(true);
    try {
      if (editingExpense) {
        const data: UpdateExpenseDto = {
          expenseDate: formDate,
          category: formCategory,
          customCategory: formCategory === ExpenseCategory.OTHER ? formCustomCategory.trim() : undefined,
          amountPaisa,
          note: formNote.trim() || undefined,
        };
        await expensesApi.update(editingExpense.id, data);
      } else {
        const data: CreateExpenseDto = {
          expenseDate: formDate,
          category: formCategory,
          customCategory: formCategory === ExpenseCategory.OTHER ? formCustomCategory.trim() : undefined,
          amountPaisa,
          note: formNote.trim() || undefined,
        };
        await expensesApi.create(data);
      }
      closeForm();
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await expensesApi.remove(deleteTarget.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setDeleteTarget(null);
      setIsDeleting(false);
      await loadData();
    }
  };

  const getCategoryLabel = (expense: Expense | null | undefined): string => {
    if (!expense) return 'Unknown';
    if (expense.category === ExpenseCategory.OTHER && expense.customCategory) {
      return expense.customCategory;
    }
    return EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory] ?? expense.category ?? 'Unknown';
  };

  if (isLoading) {
    return <LoadingState message="Loading expenses..." />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Daily Expenses</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Track operating expenses separately from coil costing.
          </p>
        </div>
        <PrimaryButton type="button" onClick={openAddForm}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </PrimaryButton>
      </div>

      {error && <ErrorBanner message={error} />}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#141A22] border border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-500 mb-1">Total Expenses</div>
            <div className="text-lg font-semibold text-red-400">{formatPaisa(summary.totalExpensesPaisa)}</div>
          </div>
          {summary.byCategory.slice(0, 3).map((cat) => (
            <div key={cat.category} className="bg-[#141A22] border border-zinc-800 rounded-xl p-4">
              <div className="text-xs text-zinc-500 mb-1 truncate">
                {EXPENSE_CATEGORY_LABELS[cat.category as ExpenseCategory] ?? cat.category}
              </div>
              <div className="text-lg font-semibold text-zinc-100">{formatPaisa(cat.total)}</div>
            </div>
          ))}
        </div>
      )}

      <SectionCard title="Expenses" description="Operating expenses within the selected date range.">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <FormField label="From" className="w-full sm:w-40">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </FormField>
            <FormField label="To" className="w-full sm:w-40">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
              />
            </FormField>
            <FormField label="Category" className="w-full sm:w-52">
              <SelectInput
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')}
              >
                <option value="">All Categories</option>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="Search" className="flex-1">
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes..."
              />
            </FormField>
          </div>
        </div>

        <DataTable
          headers={[
            { label: 'Date' },
            { label: 'Category' },
            { label: 'Amount', align: 'right' },
            { label: 'Note' },
            { label: 'Added By' },
            { label: 'Actions' },
          ]}
        >
          <TBody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState
                    title="No expenses found"
                    description={search || categoryFilter || dateFrom !== thirtyDaysAgo() || dateTo !== todayIso()
                      ? 'Try adjusting your filters.'
                      : 'Click "Add Expense" to record your first daily expense.'}
                  />
                </td>
              </tr>
            ) : (
              expenses.map((expense) => (
                <TR key={expense.id}>
                  <TD className="text-sm font-medium text-zinc-100">
                    {new Date(expense.expenseDate).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TD>
                  <TD className="text-sm text-zinc-100">
                    {getCategoryLabel(expense)}
                  </TD>
                  <TD align="right" className="text-sm font-medium text-red-400">
                    {formatPaisa(expense.amountPaisa)}
                  </TD>
                  <TD className="text-sm text-zinc-400 max-w-xs truncate">
                    {expense.note || '—'}
                  </TD>
                  <TD className="text-sm text-zinc-500">
                    {expense.createdBy || '—'}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(expense)}
                        className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(expense)}
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

      {showForm && (
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
                {editingExpense ? 'Edit Expense' : 'Add New Expense'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {editingExpense
                  ? 'Update the expense details below.'
                  : 'Enter the details for the new operating expense.'}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <FormField label="Date" required>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600"
                />
              </FormField>
              <FormField label="Category" required>
                <SelectInput
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                  required
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </SelectInput>
              </FormField>
              {formCategory === ExpenseCategory.OTHER && (
                <FormField label="Custom Category Name" required>
                  <TextInput
                    value={formCustomCategory}
                    onChange={(e) => setFormCustomCategory(e.target.value)}
                    placeholder="e.g. Marketing, Legal Fees"
                    required
                    autoFocus
                  />
                </FormField>
              )}
              <FormField label="Amount (Rs)" required>
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </FormField>
              <FormField label="Note (optional)">
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Optional description or details..."
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
                  {editingExpense ? 'Update' : 'Create'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete Expense"
          description={`Are you sure you want to delete this ${getCategoryLabel(deleteTarget)} expense of ${formatPaisa(deleteTarget.amountPaisa)}? This action cannot be undone.`}
          confirmLabel="Delete"
          isLoading={isDeleting}
          destructive
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
