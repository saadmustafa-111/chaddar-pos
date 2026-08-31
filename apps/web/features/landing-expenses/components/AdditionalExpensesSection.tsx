'use client';

import { useEffect, useState } from 'react';
import {
  CreateLandingExpenseRequest,
  UpdateLandingExpenseRequest,
  getExpenseDisplayName,
  landingExpensesApi,
  LandingExpense,
} from '../api/landing-expenses';
import {
  formatDate,
  formatPaisa,
  parseRupeeInput,
} from '../../shared/utils/format';

interface Props {
  coilId: number;
  expenses: LandingExpense[];
  purchaseAmountPaisa: number;
  isLoading: boolean;
  onChange: () => void;
  /**
   * When true, drops the outer card chrome so the section can be
   * embedded inside an outer stage card. Default `false`.
   */
  embedded?: boolean;
}

interface FormState {
  description: string;
  amount: string;
  expenseDate: string;
  note: string;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function emptyForm(): FormState {
  return {
    description: '',
    amount: '',
    expenseDate: todayIso(),
    note: '',
  };
}

function toDateInput(value: string): string {
  if (!value) return todayIso();
  if (value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (isNaN(d.getTime())) return todayIso();
  return d.toISOString().split('T')[0];
}

function validateForm(form: FormState): string | null {
  if (!form.description.trim()) {
    return 'Please enter an expense name.';
  }
  const amountPaisa = parseRupeeInput(form.amount);
  if (amountPaisa <= 0) {
    return 'Amount must be greater than zero.';
  }
  if (!form.expenseDate) {
    return 'Please choose a date.';
  }
  return null;
}

function FormFields({
  form,
  onChange,
  disabled,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
      <div className="md:col-span-5">
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
          Expense Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          required
          maxLength={255}
          disabled={disabled}
          placeholder="e.g. Transport from Lahore, Manufacturing, Labour"
          className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
          Amount (Rs) <span className="text-red-400">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={form.amount}
          onChange={(e) => onChange({ ...form, amount: e.target.value })}
          required
          disabled={disabled}
          placeholder="0.00"
          className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
          Date
        </label>
        <input
          type="date"
          value={form.expenseDate}
          onChange={(e) => onChange({ ...form, expenseDate: e.target.value })}
          required
          disabled={disabled}
          className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-60"
        />
      </div>
      <div className="md:col-span-3">
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
          Note
        </label>
        <input
          type="text"
          value={form.note}
          onChange={(e) => onChange({ ...form, note: e.target.value })}
          maxLength={255}
          disabled={disabled}
          placeholder="Optional"
          className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
        />
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`px-4 py-3 rounded-lg ${
        emphasis ? 'bg-zinc-800/70 border border-zinc-700' : ''
      }`}
    >
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`mt-1 ${
          emphasis
            ? 'text-base font-semibold text-zinc-100'
            : 'text-sm font-medium text-zinc-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  isLoading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={() => {
        if (!isLoading) onCancel();
      }}
    >
      <div
        className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          </div>
          <p className="text-sm text-zinc-400 ml-12">{description}</p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-500/90 hover:bg-red-500 disabled:bg-red-500/40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdditionalExpensesSection({
  coilId,
  expenses,
  purchaseAmountPaisa,
  isLoading,
  onChange,
  embedded = false,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const totalAdditional = expenses.reduce(
    (sum, e) => sum + Number(e.amountPaisa),
    0,
  );
  const currentCoilCost = purchaseAmountPaisa + totalAdditional;

  const resetForm = () => {
    setForm(emptyForm());
    setFormError('');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validation = validateForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }

    const amountPaisa = parseRupeeInput(form.amount);
    setIsSubmitting(true);
    try {
      const data: CreateLandingExpenseRequest = {
        description: form.description.trim(),
        amountPaisa,
        expenseDate: form.expenseDate,
        referenceNumber: form.note.trim() || undefined,
      };
      await landingExpensesApi.create(coilId, data);
      resetForm();
      onChange();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (expense: LandingExpense) => {
    setEditingId(expense.id);
    setEditForm({
      description: expense.description ?? '',
      amount: (Number(expense.amountPaisa) / 100).toFixed(2),
      expenseDate: toDateInput(expense.expenseDate),
      note: expense.referenceNumber ?? '',
    });
    setEditError('');
    setDeletingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm());
    setEditError('');
  };

  const handleUpdate = async () => {
    if (editingId === null) return;
    setEditError('');

    const validation = validateForm(editForm);
    if (validation) {
      setEditError(validation);
      return;
    }

    const amountPaisa = parseRupeeInput(editForm.amount);
    setIsUpdating(true);
    try {
      const data: UpdateLandingExpenseRequest = {
        description: editForm.description.trim(),
        amountPaisa,
        expenseDate: editForm.expenseDate,
        referenceNumber: editForm.note.trim() || undefined,
      };
      await landingExpensesApi.update(coilId, editingId, data);
      cancelEdit();
      onChange();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update expense');
    } finally {
      setIsUpdating(false);
    }
  };

  const requestDelete = (id: number) => {
    setDeletingId(id);
    setDeleteError('');
    setEditingId(null);
  };

  const cancelDelete = () => {
    setDeletingId(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (deletingId === null) return;
    setIsDeleting(true);
    try {
      await landingExpensesApi.remove(coilId, deletingId);
      setDeletingId(null);
      onChange();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete expense',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const deletingTarget =
    deletingId !== null ? expenses.find((e) => e.id === deletingId) ?? null : null;

  return (
    <div
      className={
        embedded
          ? ''
          : 'bg-[#141A22] border border-zinc-800 rounded-xl'
      }
    >
      <div className="p-6 border-b border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="min-w-0">
            <h2
              className={`text-lg font-semibold text-zinc-100 ${
                embedded ? 'sr-only' : ''
              }`}
            >
              Additional Expenses
            </h2>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-xl">
              Add any cost that happened after purchasing this coil, such as
              transport, manufacturing, labour, loading, chemical, machine
              cost, etc.
            </p>
          </div>
          <div className="md:text-right shrink-0">
            <div className="text-xs text-zinc-500 uppercase tracking-wide">
              Total Additional Expenses
            </div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">
              {formatPaisa(totalAdditional)}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleAdd} className="p-6 border-b border-zinc-800">
        <FormFields form={form} onChange={setForm} disabled={isSubmitting} />
        {formError && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-400">{formError}</p>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Adding...
              </>
            ) : (
              <>
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
                Add Expense
              </>
            )}
          </button>
        </div>
      </form>

      <div className="px-2 md:px-6 py-4">
        {isLoading ? (
          <div className="text-sm text-zinc-500 px-4 py-6 text-center">
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">
              No additional expenses yet.
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Use the form above to add the first one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Expense
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const isEditing = editingId === expense.id;
                  return (
                    <tr
                      key={expense.id}
                      className="border-b border-zinc-800/60 last:border-b-0 align-top"
                    >
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-2 min-w-[260px]">
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  description: e.target.value,
                                })
                              }
                              required
                              maxLength={255}
                              disabled={isUpdating}
                              placeholder="Expense name"
                              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
                            />
                            <input
                              type="text"
                              value={editForm.note}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  note: e.target.value,
                                })
                              }
                              maxLength={255}
                              disabled={isUpdating}
                              placeholder="Optional note"
                              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-medium text-zinc-100">
                              {getExpenseDisplayName(expense)}
                            </div>
                            {expense.referenceNumber && (
                              <div className="text-xs text-zinc-500 mt-0.5">
                                {expense.referenceNumber}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-2 min-w-[140px]">
                            <input
                              type="date"
                              value={editForm.expenseDate}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  expenseDate: e.target.value,
                                })
                              }
                              required
                              disabled={isUpdating}
                              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-60"
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={editForm.amount}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  amount: e.target.value,
                                })
                              }
                              required
                              disabled={isUpdating}
                              placeholder="Amount (Rs)"
                              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
                            />
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-400">
                            {formatDate(expense.expenseDate)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="text-xs text-zinc-500">shown left</div>
                        ) : (
                          <div className="text-sm font-medium text-zinc-100">
                            {formatPaisa(Number(expense.amountPaisa))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={isUpdating}
                              className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleUpdate}
                              disabled={isUpdating}
                              className="text-xs bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              {isUpdating && (
                                <svg
                                  className="animate-spin w-3 h-3"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                  />
                                </svg>
                              )}
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(expense)}
                              disabled={deletingId !== null}
                              className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40"
                              title="Edit expense"
                              aria-label="Edit expense"
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
                                  strokeWidth={1.5}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(expense.id)}
                              disabled={deletingId !== null}
                              className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40"
                              title="Delete expense"
                              aria-label="Delete expense"
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
                                  strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {editError && (
              <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400">{editError}</p>
              </div>
            )}
            {deleteError && (
              <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400">{deleteError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-zinc-800 bg-[#0D1117] rounded-b-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCell
            label="Purchase Cost"
            value={formatPaisa(purchaseAmountPaisa)}
          />
          <SummaryCell
            label="+ Additional Expenses"
            value={formatPaisa(totalAdditional)}
          />
          <SummaryCell
            label="= Current Coil Cost"
            value={formatPaisa(currentCoilCost)}
            emphasis
          />
        </div>
      </div>

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete this expense?"
        description={
          deletingTarget
            ? `${getExpenseDisplayName(deletingTarget)} — ${formatPaisa(
                Number(deletingTarget.amountPaisa),
              )} will be removed.`
            : ''
        }
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}