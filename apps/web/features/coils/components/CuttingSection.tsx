'use client';

import { useMemo, useState } from 'react';
import {
  Coil,
  CuttingBatchWithStock,
  cuttingBatchesApi,
  finishedChaddarStatusLabels,
  CreateCuttingBatchRequest,
} from '../api/coils';
import {
  formatPaisa,
  formatWeight,
} from '../../shared/utils/format';
import {
  FormField,
  TextInput,
  PrimaryButton,
  InlineError,
  InlineInfo,
  SectionCard,
  StatusBadge,
  DataTable,
  TBody,
  TR,
  TD,
} from '../../ui';
import {
  CuttingRowInput,
  ResolvedCuttingRow,
  planCutting,
  roundKg,
} from '../utils/cutting-calculation';

interface Props {
  coil: Coil;
  finishedCostPerKgPaisa: number;
  batches: CuttingBatchWithStock[];
  isLoading?: boolean;
  onCreated: (
    next: CuttingBatchWithStock,
    updatedCoil: Coil,
  ) => void;
  /**
   * `compact` drops the embedded title/description and the production
   * history table so the section can be embedded inside an outer stage
   * card without duplicating UI. Default `false` keeps the legacy
   * standalone layout used by older callers.
   */
  mode?: 'full' | 'compact';
}

interface DraftRow {
  uid: string;
  lengthFt: string;
  quantity: string;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function newUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyRow(lengthFt: string = ''): DraftRow {
  return { uid: newUid(), lengthFt, quantity: '' };
}

const finishedChaddarStatusColors = {
  AVAILABLE: 'green',
  PARTIALLY_SOLD: 'yellow',
  SOLD_OUT: 'zinc',
  CANCELLED: 'red',
} as const;

/**
 * Parse the strings the operator typed into typed values, returning null
 * for any row that has invalid data. Length must be > 0; quantity must
 * be a positive integer.
 */
function parseRows(rows: DraftRow[]): CuttingRowInput[] | null {
  const parsed: CuttingRowInput[] = [];
  for (const r of rows) {
    const lengthFt = parseFloat(r.lengthFt);
    const quantity = parseInt(r.quantity, 10);
    if (!Number.isFinite(lengthFt) || lengthFt <= 0) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;
    parsed.push({ lengthFt, quantity });
  }
  return parsed;
}

export function CuttingSection({
  coil,
  finishedCostPerKgPaisa,
  batches,
  isLoading,
  onCreated,
  mode = 'full',
}: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() => [emptyRow('10')]);
  const [productionDate, setProductionDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const availableWeight = Number(coil.currentWeight);
  const finishedCostReady = finishedCostPerKgPaisa > 0;

  const parsedRows = useMemo(() => parseRows(rows), [rows]);
  const plan = useMemo(() => {
    if (!parsedRows || !Number.isFinite(availableWeight) || availableWeight <= 0) {
      return null;
    }
    return planCutting({
      rows: parsedRows,
      usableCoilWeightKg: availableWeight,
    });
  }, [parsedRows, availableWeight]);

  const validRowCount = parsedRows ? parsedRows.length : 0;
  const hasAnyInput = rows.some(
    (r) => r.lengthFt.trim() !== '' || r.quantity.trim() !== '',
  );
  const validationMessage = (() => {
    if (!finishedCostReady) return null;
    if (!hasAnyInput) return null;
    if (!parsedRows) {
      return 'Each row needs a length (> 0 ft) and a positive whole-number quantity.';
    }
    if (!plan) {
      return 'Cannot plan the cut. Check that the coil still has usable weight.';
    }
    return null;
  })();

  const handleAddRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const handleRemoveRow = (uid: string) => {
    setRows((prev) =>
      prev.length === 1 ? prev : prev.filter((r) => r.uid !== uid),
    );
  };

  const handleResetAll = () => {
    setRows([emptyRow('10')]);
    setProductionDate(todayIso());
    setNote('');
    setSizeLabel('');
    setError('');
  };

  const handleRowChange = (
    uid: string,
    field: 'lengthFt' | 'quantity',
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, [field]: value } : r)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!finishedCostReady) {
      setError(
        'Finished cost is not available. Add processing wastage and at least one additional expense first.',
      );
      return;
    }
    if (!parsedRows || parsedRows.length === 0) {
      setError('Add at least one size row (length in feet + quantity).');
      return;
    }
    if (!plan) {
      setError('Cannot plan the cut with the given rows.');
      return;
    }

    const payload: CreateCuttingBatchRequest = {
      sizeLabel: sizeLabel.trim() || 'Mixed coil run',
      rows: parsedRows,
      productionDate,
      note: note.trim() || undefined,
    };

    setIsSaving(true);
    try {
      const result = await cuttingBatchesApi.create(coil.id, payload);
      const expectedRemaining = roundKg(
        Math.max(0, availableWeight - plan.totalProducedWeightKg),
      );
      onCreated(result, {
        ...coil,
        currentWeight: expectedRemaining,
      });
      handleResetAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to record cutting batch',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard
      title={
        mode === 'compact'
          ? undefined
          : 'Cutting & Finished Chaddar Production'
      }
      description={
        mode === 'compact'
          ? undefined
          : 'Pick the coil, type length + quantity for each size, then cut. Weights and cost are calculated for you.'
      }
      padded={mode === 'full'}
    >
      <form
        onSubmit={handleSubmit}
        className={
          mode === 'compact'
            ? 'p-0'
            : 'p-6 border-b border-zinc-800'
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-[#0D1117] px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Selected coil
                </div>
                <div className="text-sm text-zinc-100 font-medium">
                  {coil.code}
                  {coil.brand ? ` · ${coil.brand}` : ''}
                  {coil.color ? ` · ${coil.color}` : ''}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  Width {formatWeight(Number(coil.width)).replace(' KG', ' mm')}
                  {coil.thicknessMm != null
                    ? ` · Thickness ${Number(coil.thicknessMm).toFixed(3)} mm`
                    : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Available
                </div>
                <div className="text-base font-semibold text-zinc-100">
                  {formatWeight(availableWeight)}
                </div>
                <div className="text-xs text-zinc-500">
                  @ {formatPaisa(finishedCostPerKgPaisa)} / KG
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-300 uppercase tracking-wide">
                Piece sizes to cut
              </span>
              <button
                type="button"
                onClick={handleAddRow}
                disabled={isSaving}
                className="text-xs text-yellow-400 hover:text-yellow-300 underline decoration-dotted underline-offset-2 disabled:opacity-50"
              >
                + Add another size
              </button>
            </div>

            <div className="space-y-2">
              {rows.map((row, index) => {
                const lengthInvalid =
                  row.lengthFt.trim() !== '' &&
                  (Number.isNaN(parseFloat(row.lengthFt)) ||
                    parseFloat(row.lengthFt) <= 0);
                const quantityInvalid =
                  row.quantity.trim() !== '' &&
                  (!Number.isInteger(parseInt(row.quantity, 10)) ||
                    parseInt(row.quantity, 10) <= 0);
                return (
                  <div
                    key={row.uid}
                    className="grid grid-cols-12 gap-3 items-end bg-[#0D1117] border border-zinc-800 rounded-lg px-4 py-3"
                  >
                    <FormField
                      label={index === 0 ? 'Length (ft)' : undefined}
                      className="col-span-3"
                      error={
                        lengthInvalid
                          ? 'Must be > 0'
                          : null
                      }
                    >
                      <TextInput
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={row.lengthFt}
                        onChange={(e) =>
                          handleRowChange(
                            row.uid,
                            'lengthFt',
                            e.target.value,
                          )
                        }
                        disabled={isSaving}
                        invalid={lengthInvalid}
                        placeholder="e.g. 10"
                        inputMode="decimal"
                      />
                    </FormField>
                    <FormField
                      label={index === 0 ? 'Quantity (pieces)' : undefined}
                      className="col-span-4"
                      error={
                        quantityInvalid
                          ? 'Whole number, > 0'
                          : null
                      }
                    >
                      <TextInput
                        type="number"
                        min="1"
                        step="1"
                        value={row.quantity}
                        onChange={(e) =>
                          handleRowChange(
                            row.uid,
                            'quantity',
                            e.target.value,
                          )
                        }
                        disabled={isSaving}
                        invalid={quantityInvalid}
                        placeholder="e.g. 100"
                        inputMode="numeric"
                      />
                    </FormField>
                    <FormField
                      label={index === 0 ? 'Per piece' : undefined}
                      className="col-span-2"
                      hint="auto"
                    >
                      <div className="text-sm text-zinc-100 font-mono py-2">
                        {formatPreviewRow(plan, index, 'pieceWeightKg')}
                      </div>
                    </FormField>
                    <FormField
                      label={index === 0 ? 'Total weight' : undefined}
                      className="col-span-2"
                      hint="auto"
                    >
                      <div className="text-sm text-zinc-100 font-mono py-2">
                        {formatPreviewRow(plan, index, 'totalWeightKg')}
                      </div>
                    </FormField>
                    <div className="col-span-1 flex justify-end">
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.uid)}
                          disabled={isSaving}
                          className="text-zinc-500 hover:text-red-400 text-sm px-2 py-1 disabled:opacity-30"
                          title="Remove this size"
                        >
                          ×
                        </button>
                      ) : (
                        <span className="text-zinc-600 text-sm px-2 py-1">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <FormField
              label="Production date"
              required
              className="md:col-span-3"
            >
              <TextInput
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                required
                disabled={isSaving}
              />
            </FormField>
            <FormField
              label="Batch label (optional)"
              hint="Shown on Production History. Defaults to 'Mixed coil run'."
              className="md:col-span-4"
            >
              <TextInput
                value={sizeLabel}
                onChange={(e) => setSizeLabel(e.target.value)}
                maxLength={100}
                disabled={isSaving}
                placeholder="e.g. Job #1432"
              />
            </FormField>
            <FormField
              label="Note (optional)"
              className="md:col-span-5"
            >
              <TextInput
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                disabled={isSaving}
                placeholder="Anything to remember about this run"
              />
            </FormField>
          </div>
        </div>

        <ProductionSummary
          plan={plan}
          availableWeight={availableWeight}
          finishedCostPerKgPaisa={finishedCostPerKgPaisa}
          rowCount={validRowCount}
        />

        {!finishedCostReady && (
          <div className="mt-4">
            <InlineInfo>
              Finished cost is not yet calculated. Record processing/wastage
              and add at least one additional expense first.
            </InlineInfo>
          </div>
        )}

        {validationMessage && (
          <div className="mt-3">
            <InlineError message={validationMessage} />
          </div>
        )}

        {error && (
          <div className="mt-3">
            <InlineError message={error} />
          </div>
        )}

        <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
          <button
            type="button"
            onClick={handleResetAll}
            disabled={isSaving}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline decoration-dotted underline-offset-2 disabled:opacity-50"
          >
            Reset form
          </button>
          <PrimaryButton
            type="submit"
            disabled={
              isSaving ||
              !finishedCostReady ||
              !plan ||
              validRowCount === 0
            }
            isLoading={isSaving}
            loadingLabel="Cutting..."
          >
            Cut pieces
          </PrimaryButton>
        </div>
      </form>

      {mode === 'compact' ? null : (
      <div className="px-2 md:px-6 py-4">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3 px-2 md:px-2">
          Production History
        </h3>
        {isLoading ? (
          <div className="text-sm text-zinc-500 px-4 py-6 text-center">
            Loading cutting batches...
          </div>
        ) : batches.length === 0 ? (
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
                  d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
                />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No cutting batches yet.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Use the form above to record your first production run.
            </p>
          </div>
        ) : (
          <DataTable
            headers={[
              { label: 'Batch' },
              { label: 'Sizes cut' },
              { label: 'Pieces', align: 'right' },
              { label: 'Weight Used', align: 'right' },
              { label: 'Cost / KG', align: 'right' },
              { label: 'Total Cost', align: 'right' },
              { label: 'Date' },
              { label: 'Status' },
            ]}
          >
            <TBody>
              {batches.map(({ cuttingBatch, finishedStock }) => {
                const rowsSummary =
                  parseBatchRows(cuttingBatch.cutRowsJson);
                return (
                  <TR key={cuttingBatch.id}>
                    <TD>
                      <div className="text-sm font-medium text-zinc-100">
                        {cuttingBatch.code}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        First stock: {finishedStock.code}
                      </div>
                    </TD>
                    <TD>
                      <div className="text-sm text-zinc-100">
                        {formatBatchSizes(rowsSummary)}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Headline: {cuttingBatch.sizeLabel}
                      </div>
                    </TD>
                    <TD align="right">
                      <div className="text-sm font-medium text-zinc-100">
                        {cuttingBatch.piecesProduced}
                      </div>
                    </TD>
                    <TD align="right">
                      <div className="text-sm font-medium text-zinc-100">
                        {formatWeight(
                          Number(cuttingBatch.cuttingWeightKg),
                        )}
                      </div>
                      {cuttingBatch.avg10ftPieceWeightKg != null && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          avg 10ft:{' '}
                          {formatWeight(
                            Number(cuttingBatch.avg10ftPieceWeightKg),
                          )}
                        </div>
                      )}
                    </TD>
                    <TD
                      align="right"
                      className="text-sm text-zinc-300"
                    >
                      {formatPaisa(
                        Number(cuttingBatch.finishedCostPerKgPaisa),
                      )}
                    </TD>
                    <TD
                      align="right"
                      className="text-sm text-zinc-100"
                    >
                      {formatPaisa(
                        Number(cuttingBatch.totalProductionCostPaisa),
                      )}
                    </TD>
                    <TD className="text-sm text-zinc-400">
                      {new Date(
                        cuttingBatch.productionDate,
                      ).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TD>
                    <TD>
                      <StatusBadge
                        variant={
                          finishedChaddarStatusColors[finishedStock.status]
                        }
                      >
                        {finishedChaddarStatusLabels[finishedStock.status]}
                      </StatusBadge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </DataTable>
        )}
      </div>
      )}
    </SectionCard>
  );
}

interface ProductionSummaryProps {
  plan: ReturnType<typeof planCutting>;
  availableWeight: number;
  finishedCostPerKgPaisa: number;
  rowCount: number;
}

function ProductionSummary({
  plan,
  availableWeight,
  finishedCostPerKgPaisa,
  rowCount,
}: ProductionSummaryProps) {
  if (!plan) return null;

  const produced = plan.totalProducedWeightKg;
  const consumed = Math.min(produced, availableWeight);
  const remainingAfter = Math.max(0, availableWeight - consumed);
  const roundingLeft = Math.max(0, availableWeight - produced);
  const costPaisa = Math.round(consumed * finishedCostPerKgPaisa);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryTile
          label="Equivalent 10-ft pieces"
          value={formatNumber(plan.tenFtEquivalentQty)}
          helper={`${rowCount} size${rowCount === 1 ? '' : 's'}`}
        />
        <SummaryTile
          label="Avg 10-ft weight"
          value={formatWeight(plan.avg10ftPieceWeightKg)}
          helper="computed"
        />
        <SummaryTile
          label="Will consume"
          value={formatWeight(consumed)}
          helper={
            finishedCostPerKgPaisa > 0
              ? formatPaisa(costPaisa)
              : 'cost pending'
          }
        />
        <SummaryTile
          label="Remaining after"
          value={formatWeight(remainingAfter)}
          helper={
            remainingAfter <= 0.0005
              ? 'Coil will be depleted'
              : roundingLeft > 0
                ? `+${formatWeight(roundingLeft)} rounding scrap`
                : 'After this cut'
          }
          variant={remainingAfter <= 0.0005 ? 'highlight' : 'default'}
        />
        <SummaryTile
          label="Pieces produced"
          value={formatNumber(
            plan.rows.reduce((sum, r) => sum + r.quantity, 0),
          )}
          helper="across all sizes"
        />
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  helper,
  variant = 'default',
}: {
  label: string;
  value: string;
  helper?: string;
  variant?: 'default' | 'highlight';
}) {
  const bg =
    variant === 'highlight'
      ? 'bg-yellow-500/10 border border-yellow-500/30'
      : 'bg-[#0D1117] border border-zinc-800';
  return (
    <div className={`rounded-lg px-4 py-3 ${bg}`}>
      <div className="text-xs text-zinc-500 uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`mt-1 text-base font-semibold ${
          variant === 'highlight' ? 'text-yellow-300' : 'text-zinc-100'
        }`}
      >
        {value}
      </div>
      {helper && (
        <div className="text-xs text-zinc-500 mt-0.5">{helper}</div>
      )}
    </div>
  );
}

function formatPreviewRow(
  plan: ReturnType<typeof planCutting>,
  index: number,
  field: 'pieceWeightKg' | 'totalWeightKg',
): string {
  const row = plan?.rows[index];
  if (!row) return '—';
  const v = row[field];
  return `${formatWeight(v)}`;
}

function formatBatchSizes(
  rows: ResolvedCuttingRow[] | null,
): string {
  if (!rows || rows.length === 0) return '—';
  return rows
    .map(
      (r) =>
        `${r.lengthFt}ft × ${r.quantity}pc (${formatWeight(r.totalWeightKg)})`,
    )
    .join(' · ');
}

function parseBatchRows(
  json: string | null,
): ResolvedCuttingRow[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as ResolvedCuttingRow[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', {
    maximumFractionDigits: 3,
  });
}