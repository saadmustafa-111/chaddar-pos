'use client';

import { useMemo, useState } from 'react';
import {
  Coil,
  ProcessingStatus,
  coilsApi,
  processingStatusLabels,
  UpdateProcessingRequest,
} from '../api/coils';
import {
  formatDate,
  formatWeight,
  parseWeightInput,
} from '../../shared/utils/format';

interface Props {
  coil: Coil;
  totalAdditionalExpensesPaisa: number;
  onChange: (next: Coil) => void;
  /**
   * Drops the outer card chrome so the form can be embedded inside an
   * outer stage card. Default `false`.
   */
  embedded?: boolean;
}

interface FormState {
  processingStatus: ProcessingStatus;
  processingDate: string;
  processingNote: string;
  wastageWeight: string;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return todayIso();
  if (value.length >= 10) return value.slice(0, 10);
  const d = new Date(value);
  if (isNaN(d.getTime())) return todayIso();
  return d.toISOString().split('T')[0];
}

function emptyForm(coil: Coil): FormState {
  return {
    processingStatus: coil.processingStatus ?? 'NOT_STARTED',
    processingDate: toDateInput(coil.processingDate),
    processingNote: coil.processingNote ?? '',
    wastageWeight:
      coil.wastageWeight && Number(coil.wastageWeight) > 0
        ? Number(coil.wastageWeight).toFixed(3).replace(/\.?0+$/, '')
        : '',
  };
}

const processingStatusColors: Record<ProcessingStatus, string> = {
  NOT_STARTED: 'bg-zinc-700/40 text-zinc-300',
  IN_PROGRESS: 'bg-yellow-500/10 text-yellow-400',
  COMPLETED: 'bg-green-500/10 text-green-400',
};

export function ProcessingSection({
  coil,
  totalAdditionalExpensesPaisa,
  onChange,
  embedded = false,
}: Props) {
  return (
    <ProcessingForm
      key={`${coil.id}-${coil.updatedAt}`}
      coil={coil}
      totalAdditionalExpensesPaisa={totalAdditionalExpensesPaisa}
      onChange={onChange}
      embedded={embedded}
    />
  );
}

interface ProcessingFormProps {
  coil: Coil;
  totalAdditionalExpensesPaisa: number;
  onChange: (next: Coil) => void;
  embedded: boolean;
}

function ProcessingForm({
  coil,
  totalAdditionalExpensesPaisa,
  onChange,
  embedded,
}: ProcessingFormProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(coil));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const availableWeight = Number(coil.currentWeight) + Number(coil.wastageWeight ?? 0);
  const wastageValue = useMemo(() => parseWeightInput(form.wastageWeight), [
    form.wastageWeight,
  ]);

  const remainingUsable = useMemo(() => {
    const value = availableWeight - wastageValue;
    return value < 0 ? 0 : value;
  }, [availableWeight, wastageValue]);

  const wastageValidation = useMemo(() => {
    if (!form.wastageWeight) return null;
    const v = parseWeightInput(form.wastageWeight);
    if (v < 0) return 'Wastage cannot be negative';
    if (v > availableWeight)
      return `Wastage cannot exceed available coil weight (${formatWeight(availableWeight)})`;
    return null;
  }, [form.wastageWeight, availableWeight]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const wastagePaisaNum =
      form.wastageWeight && form.wastageWeight.trim() !== ''
        ? parseWeightInput(form.wastageWeight)
        : 0;

    if (wastagePaisaNum < 0) {
      setError('Wastage cannot be negative');
      return;
    }
    if (wastagePaisaNum > availableWeight) {
      setError(
        `Wastage cannot exceed available coil weight (${formatWeight(availableWeight)})`,
      );
      return;
    }

    const payload: UpdateProcessingRequest = {
      processingStatus: form.processingStatus,
      processingDate: form.processingDate,
      processingNote: form.processingNote.trim() || undefined,
      wastageWeight: wastagePaisaNum,
    };

    setIsSaving(true);
    try {
      const updated = await coilsApi.updateProcessing(coil.id, payload);
      onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save processing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setForm(emptyForm(coil));
    setError('');
  };

  const totalInvestedPaisa = Number(coil.purchaseAmountPaisa) + totalAdditionalExpensesPaisa;
  const previewFinishedCostPerKgPaisa =
    remainingUsable > 0 ? Math.round(totalInvestedPaisa / remainingUsable) : 0;

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
              Processing &amp; Wastage
            </h2>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-xl">
              Record the physical processing of this coil and any scrap / loss.
              Monetary costs (paint, chemicals, labour, machine etc.) are kept in
              the Additional Expenses section.
            </p>
          </div>
          <div className="md:text-right shrink-0">
            <div className="text-xs text-zinc-500 uppercase tracking-wide">
              Current Processing Status
            </div>
            <div className="mt-1">
              <span
                className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                  processingStatusColors[coil.processingStatus]
                }`}
              >
                {processingStatusLabels[coil.processingStatus]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 border-b border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Processing Status <span className="text-red-400">*</span>
            </label>
            <select
              value={form.processingStatus}
              onChange={(e) =>
                setForm({
                  ...form,
                  processingStatus: e.target.value as ProcessingStatus,
                })
              }
              required
              disabled={isSaving}
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-60"
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Processing Date
            </label>
            <input
              type="date"
              value={form.processingDate}
              onChange={(e) =>
                setForm({ ...form, processingDate: e.target.value })
              }
              disabled={isSaving}
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Note
            </label>
            <input
              type="text"
              value={form.processingNote}
              onChange={(e) =>
                setForm({ ...form, processingNote: e.target.value })
              }
              maxLength={500}
              disabled={isSaving}
              placeholder="Optional processing notes"
              className="w-full bg-[#0D1117] border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-600 placeholder:text-zinc-600 disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Available Coil Weight (KG)
            </label>
            <div className="bg-[#0D1117] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-300 flex items-center justify-between">
              <span className="font-medium">{formatWeight(availableWeight)}</span>
              <span className="text-xs text-zinc-500">auto</span>
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">
              Source: current coil balance, plus any previously recorded wastage.
            </p>
          </div>

          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">
              Wastage / Scrap Weight (KG)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.wastageWeight}
              onChange={(e) =>
                setForm({ ...form, wastageWeight: e.target.value })
              }
              disabled={isSaving}
              placeholder="0.000"
              className={`w-full bg-[#0D1117] border rounded-lg px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 placeholder:text-zinc-600 disabled:opacity-60 ${
                wastageValidation
                  ? 'border-red-500/50 focus:ring-red-500/40'
                  : 'border-zinc-700 focus:ring-zinc-600'
              }`}
            />
            <p className="text-xs text-zinc-600 mt-1.5">
              Maximum allowed: {formatWeight(availableWeight)}
            </p>
            {wastageValidation && (
              <p className="text-xs text-red-400 mt-1">{wastageValidation}</p>
            )}
          </div>

          <div className="md:col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
              <div className="bg-[#0D1117] border border-zinc-800 rounded-lg px-4 py-3">
                <div className="text-xs text-zinc-500">Available Weight</div>
                <div className="mt-1 text-sm font-medium text-zinc-100">
                  {formatWeight(availableWeight)}
                </div>
              </div>
              <div className="bg-[#0D1117] border border-zinc-800 rounded-lg px-4 py-3">
                <div className="text-xs text-zinc-500">− Wastage</div>
                <div className="mt-1 text-sm font-medium text-zinc-100">
                  {formatWeight(wastageValue)}
                </div>
              </div>
              <div className="bg-zinc-800/70 border border-zinc-700 rounded-lg px-4 py-3">
                <div className="text-xs text-zinc-300">Remaining Usable Weight</div>
                <div className="mt-1 text-base font-semibold text-zinc-100">
                  {formatWeight(remainingUsable)}
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              Preview finished cost (after save): Rs{' '}
              <span className="text-zinc-300 font-medium">
                {(previewFinishedCostPerKgPaisa / 100).toFixed(2)}
              </span>{' '}
              / KG
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isSaving || wastageValidation !== null}
            className="bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {isSaving ? (
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
                Saving...
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save Processing
              </>
            )}
          </button>
        </div>
      </form>

      <div className="px-6 py-4 text-xs text-zinc-500">
        <span className="text-zinc-400 font-medium">Tip:</span> when you save a
        non-zero wastage, the system will create a scrap inventory movement and
        reduce the coil balance. Edit again to correct.
      </div>

      {coil.processingDate && (
        <div className="px-6 pb-4 -mt-2 text-xs text-zinc-500">
          Last saved on {formatDate(coil.processingDate)}.
        </div>
      )}
    </div>
  );
}