'use client';

import { useEffect, useState } from 'react';
import { Coil, coilsApi } from '../../coils/api/coils';
import { planeStockApi, MoveToPlaneRequest } from '../api/plane-stock';
import {
  FormField,
  TextInput,
  TextareaInput,
  PrimaryButton,
  InlineError,
  InlineInfo,
  SummaryTile,
} from '../../ui';
import { formatPaisa, parseRupeeInput, formatWeight } from '../../shared/utils/format';

interface Props {
  open: boolean;
  onClose: () => void;
  coil: Coil;
  onMoved: (next: Coil) => void;
}

/**
 * Lightweight client-side preview of the calculated feet from a KG
 * input. The backend is always the source of truth - we re-derive here
 * only to give the operator instant feedback while they type.
 *
 * Conversion: `feet = weightKg / kgPerFoot`. The kg/foot for this
 * coil is read from the most recent finished-chaddar-stock row when
 * available; otherwise we fall back to a steel-density theoretical
 * estimate that matches the backend implementation in
 * `apps/api/src/modules/cutting-batches/calculation.ts`.
 */
function previewFeet(weightKg: number, coil: Coil): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const historyEntry = coil.lastKgPerFoot;
  if (historyEntry != null && historyEntry > 0) {
    return weightKg / historyEntry;
  }
  const widthMm = coil.width;
  const thicknessMm = coil.thicknessMm;
  if (
    widthMm == null ||
    thicknessMm == null ||
    !Number.isFinite(widthMm) ||
    !Number.isFinite(thicknessMm) ||
    widthMm <= 0 ||
    thicknessMm <= 0
  ) {
    return null;
  }
  const widthCm = widthMm / 10;
  const thicknessCm = thicknessMm / 10;
  const STEEL_DENSITY = 7.85;
  const cmPerFoot = 30.48;
  const kgPerFoot = ((widthCm * thicknessCm) / 1000) * STEEL_DENSITY * cmPerFoot;
  if (!Number.isFinite(kgPerFoot) || kgPerFoot <= 0) return null;
  return weightKg / kgPerFoot;
}

export function MoveToPlaneModal({ open, onClose, coil, onMoved }: Props) {
  const [weightInput, setWeightInput] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setWeightInput('');
      setNote('');
      setError('');
    });
  }, [open]);

  if (!open) return null;

  const available = Number(coil.currentWeight);
  const weightPaisa = weightInput ? parseRupeeInput(weightInput) : 0;
  // The form takes KG (rupee-style input). Convert from paisa-style
  // helper back to KG by dividing by 100.
  const weightKg = weightPaisa / 100;
  const exceedsAvailable = weightKg > available + 0.0005 && available > 0;
  const isZeroOrNegative = !(weightKg > 0);
  const preview = previewFeet(weightKg, coil);
  const kgPerFootLabel =
    coil.lastKgPerFoot != null && coil.lastKgPerFoot > 0
      ? `${coil.lastKgPerFoot.toFixed(3)} KG / ft (from history)`
      : 'theoretical density-based';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isZeroOrNegative) {
      setError('Weight must be greater than zero.');
      return;
    }
    if (exceedsAvailable) {
      setError(
        `Weight (${weightKg.toFixed(3)} KG) exceeds coil available weight (${available.toFixed(3)} KG)`,
      );
      return;
    }
    if (preview == null) {
      setError(
        'Cannot compute feet for this coil. Record a cutting batch first or ensure width and thickness are set.',
      );
      return;
    }

    const payload: MoveToPlaneRequest = {
      weightKg,
      note: note.trim() || undefined,
    };

    setIsSaving(true);
    try {
      const created = await planeStockApi.moveFromCoil(coil.id, payload);
      onMoved({
        ...coil,
        currentWeight: Math.max(0, available - weightKg),
      });
      // Returned plane id useful for callers navigating to detail.
      void created;
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to move weight to plane',
      );
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
        className="bg-[#141A22] border border-zinc-800 rounded-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-base font-semibold text-zinc-100">
            Move to Plane Stock
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Move weight from {coil.code} into the separate Plane Stock
            category. The coil's current weight will be reduced by the
            same amount.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <SummaryTile
            label="Coil available"
            value={formatWeight(available)}
            helper={
              available > 0
                ? `Maximum move: ${formatWeight(available)}`
                : 'Coil is depleted'
            }
            variant={available > 0 ? 'highlight' : 'success'}
          />
          <FormField
            label="Weight to move (KG)"
            required
            error={
              exceedsAvailable
                ? 'Exceeds coil available weight'
                : isZeroOrNegative && weightInput !== ''
                  ? 'Must be > 0'
                  : null
            }
            hint={`Feet calculated using ${kgPerFootLabel}.`}
          >
            <TextInput
              type="number"
              min="0.001"
              step="0.001"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              required
              autoFocus
              disabled={available <= 0}
              invalid={exceedsAvailable}
              placeholder="e.g. 30"
              inputMode="decimal"
            />
          </FormField>
          {preview != null && weightKg > 0 && (
            <div className="rounded-lg bg-[#0D1117] border border-zinc-800 px-4 py-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">
                Calculated Feet
              </div>
              <div className="mt-1 text-base font-semibold text-zinc-100">
                {preview.toFixed(3)} ft
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {weightKg.toFixed(3)} KG → {preview.toFixed(3)} ft
              </div>
            </div>
          )}
          {preview == null && weightKg > 0 && (
            <InlineInfo>
              No kg/foot available for this coil yet. Record a cutting batch
              first, or fill in the coil width and thickness on the
              supplier purchase, to enable automatic feet calculation.
            </InlineInfo>
          )}
          <FormField label="Note (optional)">
            <TextareaInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              disabled={available <= 0}
              placeholder="e.g. Saved for re-cutting next week"
            />
          </FormField>
          <div className="text-xs text-zinc-500 rounded-lg bg-[#0D1117] border border-zinc-800 px-3 py-2">
            Cost valuation uses the coil's current finished cost:{' '}
            <span className="text-zinc-300">
              {formatPaisa(
                coilsApi ? Number(coil.purchaseAmountPaisa) : 0,
              )}
            </span>{' '}
            snapshot.
          </div>
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
              loadingLabel="Moving..."
              disabled={available <= 0}
            >
              Move to Plane
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}