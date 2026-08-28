'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coil,
  CuttingBatchWithStock,
  FinishedCostSummary,
} from '../api/coils';
import { LandingExpense } from '../../landing-expenses/api/landing-expenses';
import { InventoryMovement } from '../api/coils';
import { PlaneStockRow, planeStockApi } from '../../plane-stock/api/plane-stock';
import { MoveToPlaneModal } from '../../plane-stock/components/MoveToPlaneModal';
import { CoilSummaryHeader } from './workflow/CoilSummaryHeader';
import { LifecycleStepper, StageDefinition } from './workflow/LifecycleStepper';
import { StageShell } from './workflow/StageShell';
import { StageSummary } from './workflow/StageSummary';
import { StagePreview } from './workflow/StagePreview';
import { PrimaryButton } from '../../ui';
import { AdditionalExpensesSection } from '../../landing-expenses/components/AdditionalExpensesSection';
import { ProcessingSection } from './ProcessingSection';
import { CuttingSection } from './CuttingSection';
import { formatDate, formatPaisa, formatWeight } from '../../shared/utils/format';

export const STAGE_KEYS = [
  'purchase',
  'expenses',
  'processing',
  'finished-cost',
  'cutting',
  'plane',
  'finished-stock',
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

interface Props {
  coil: Coil;
  expenses: LandingExpense[];
  isLoadingExpenses: boolean;
  movements: InventoryMovement[];
  finishedCost: FinishedCostSummary | null;
  cuttingBatches: CuttingBatchWithStock[];
  onReloadExpenses: () => void;
  onReloadCoilAndCost: (next: Coil) => Promise<void>;
  onCuttingCreated: (
    result: CuttingBatchWithStock,
    optimisticCoil: Coil,
  ) => void;
}

function computeCurrentStageKey(
  coil: Coil,
  expenseCount: number,
  finishedCostReady: boolean,
  hasCutting: boolean,
): StageKey {
  const hasWastage = Number(coil.wastageWeight ?? 0) > 0;
  const processingComplete = coil.processingStatus === 'COMPLETED';

  // Walk forward: pick the first stage the operator still needs to act on.
  if (expenseCount === 0) return 'expenses';
  if (!hasWastage) return 'processing';
  if (processingComplete && !finishedCostReady) return 'finished-cost';
  if (!hasCutting) return 'cutting';
  return 'finished-stock';
}

export function CoilWorkflow({
  coil,
  expenses,
  isLoadingExpenses,
  movements,
  finishedCost,
  cuttingBatches,
  onReloadExpenses,
  onReloadCoilAndCost,
  onCuttingCreated,
}: Props) {
  const totalAdditionalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amountPaisa), 0),
    [expenses],
  );
  const finishedCostReady =
    finishedCost !== null &&
    finishedCost.remainingUsableWeightKg > 0 &&
    finishedCost.totalInvestedCostPaisa > 0;

  const [planeEntries, setPlaneEntries] = useState<PlaneStockRow[]>([]);
  const [isPlaneLoading, setIsPlaneLoading] = useState(true);
  const [showPlaneModal, setShowPlaneModal] = useState(false);

  const loadPlane = useCallback(async () => {
    setIsPlaneLoading(true);
    try {
      const list = await planeStockApi.findByCoil(coil.id);
      setPlaneEntries(list);
    } catch {
      setPlaneEntries([]);
    } finally {
      setIsPlaneLoading(false);
    }
  }, [coil.id]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsPlaneLoading(true);
    });
    (async () => {
      try {
        const list = await planeStockApi.findByCoil(coil.id);
        if (cancelled) return;
        setPlaneEntries(list);
      } catch {
        if (cancelled) return;
        setPlaneEntries([]);
      } finally {
        if (!cancelled) setIsPlaneLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coil.id]);

  const cuttingConsumedKg = useMemo(
    () =>
      cuttingBatches.reduce(
        (sum, b) => sum + Number(b.cuttingBatch.cuttingWeightKg),
        0,
      ),
    [cuttingBatches],
  );

  const planeWeightKg = useMemo(
    () => planeEntries.reduce((sum, p) => sum + Number(p.weightKg), 0),
    [planeEntries],
  );

  const planeFeet = useMemo(
    () => planeEntries.reduce((sum, p) => sum + Number(p.calculatedFeet), 0),
    [planeEntries],
  );

  const wastageKg = Number(coil.wastageWeight ?? 0);
  const currentKg = Number(coil.currentWeight);

  const handlePlaneMoved = useCallback(
    (next: Coil) => {
      onReloadCoilAndCost(next);
      // Optimistically refresh the plane list; the reload will replace
      // it with the canonical set when the new coil data lands.
      loadPlane();
    },
    [onReloadCoilAndCost, loadPlane],
  );

  // One ref per stage so we don't fight React 19's stricter
  // useRef/immutability semantics (a single object holding all refs was
  // flagged as "mutating a value used by another effect").
  const purchaseRef = useRef<HTMLDivElement | null>(null);
  const expensesRef = useRef<HTMLDivElement | null>(null);
  const processingRef = useRef<HTMLDivElement | null>(null);
  const finishedCostRef = useRef<HTMLDivElement | null>(null);
  const cuttingRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);
  const finishedStockRef = useRef<HTMLDivElement | null>(null);

  const stageRefs: Record<
    StageKey,
    React.MutableRefObject<HTMLDivElement | null>
  > = {
    purchase: purchaseRef,
    expenses: expensesRef,
    processing: processingRef,
    'finished-cost': finishedCostRef,
    cutting: cuttingRef,
    plane: planeRef,
    'finished-stock': finishedStockRef,
  };

  const stages: StageDefinition[] = useMemo(
    () => [
      {
        key: 'purchase',
        label: 'Purchase',
        description: 'Coil received from supplier.',
      },
      {
        key: 'expenses',
        label: 'Expenses',
        description: 'Add landing / processing costs.',
      },
      {
        key: 'processing',
        label: 'Processing',
        description: 'Log processing status and wastage.',
      },
      {
        key: 'finished-cost',
        label: 'Finished Cost',
        description: 'Review cost per usable KG.',
      },
{
        key: 'cutting',
        label: 'Cutting',
        description: 'Cut into finished chaddar sizes.',
      },
      {
        key: 'plane',
        label: 'Plane',
        description: 'Set aside some coil weight for later.',
      },
      {
        key: 'finished-stock',
        label: 'Finished Stock',
        description: 'Sell to customers.',
      },
    ],
    [],
  );

const inferredCurrent = useMemo<StageKey>(
    () =>
      computeCurrentStageKey(
        coil,
        expenses.length,
        finishedCostReady,
        cuttingBatches.length > 0,
      ),
    [coil, expenses.length, finishedCostReady, cuttingBatches.length],
  );

  // The operator can click any stage to revisit it; that's stored as a
  // "pinned" override. When `pinnedKey` is null we follow the inferred
  // current automatically as the coil progresses.
  const [pinnedKey, setPinnedKey] = useState<StageKey | null>(null);

  // If the operator records progress in a stage they're not currently
  // pinned on, the stepper should auto-follow the inferred current.
  const inferredIndex = STAGE_KEYS.indexOf(inferredCurrent);
  const pinnedIndex = pinnedKey ? STAGE_KEYS.indexOf(pinnedKey) : -1;
  if (pinnedKey && inferredIndex > pinnedIndex) {
    // The user has moved past their pinned stage; resume auto-follow.
    setPinnedKey(null);
  }
  const activeKey: StageKey = pinnedKey ?? inferredCurrent;

// Tracks which completed stage has been opened in detail mode. By
  // default every completed stage is collapsed (compact).
  const [expandedKey, setExpandedKey] = useState<StageKey | null>(null);

  const scrollToStage = useCallback(
    (key: StageKey) => {
      setPinnedKey(key);
      setExpandedKey(key);
      requestAnimationFrame(() => {
        stageRefs[key].current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
    // stageRefs is a stable local — defined once per component
    // instance, not recreated on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Inline the ref lookup so we don't create a new const that the
  // effect depends on. (stageRefs is a stable local.)
  useEffect(() => {
    stageRefs[activeKey].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const completedKeys: StageKey[] = useMemo(() => {
    const done: StageKey[] = ['purchase'];
    if (expenses.length > 0) done.push('expenses');
    if (Number(coil.wastageWeight) > 0) done.push('processing');
    if (finishedCostReady) done.push('finished-cost');
    if (cuttingBatches.length > 0) done.push('cutting');
    return done;
  }, [
    expenses.length,
    coil.wastageWeight,
    finishedCostReady,
    cuttingBatches.length,
  ]);

  const handleStepperSelect = useCallback(
    (key: string) => {
      const stageKey = key as StageKey;
      scrollToStage(stageKey);
    },
    [scrollToStage],
  );

  const handleCoilUpdate = useCallback(
    async (next: Coil) => {
      await onReloadCoilAndCost(next);
    },
    [onReloadCoilAndCost],
  );

  const handleCuttingCreated = useCallback(
    (result: CuttingBatchWithStock, optimisticCoil: Coil) => {
      onCuttingCreated(result, optimisticCoil);
      // After recording a batch we treat finished-stock as the active
      // stage so the operator can see what was just produced.
      setTimeout(
        () => scrollToStage('finished-stock'),
        250,
      );
    },
    [onCuttingCreated, scrollToStage],
  );

  const purchaseSummary = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <SummaryStat label="Coil #" value={coil.code} />
      <SummaryStat
        label="Supplier"
        value={coil.supplier?.name ?? '—'}
        muted={!coil.supplier}
      />
      <SummaryStat
        label="Purchase Cost"
        value={formatPaisa(Number(coil.purchaseAmountPaisa))}
      />
      <SummaryStat
        label="Purchase Date"
        value={formatDate(coil.purchase?.purchaseDate ?? coil.createdAt)}
      />
    </div>
  );

  const finishedCostStats = finishedCost ? (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <SummaryStat
        label="Total Invested"
        value={formatPaisa(finishedCost.totalInvestedCostPaisa)}
      />
      <SummaryStat
        label="Usable Weight"
        value={formatWeight(finishedCost.remainingUsableWeightKg)}
      />
      <SummaryStat
        label="Cost / KG"
        value={formatPaisa(finishedCost.finishedCostPerKgPaisa)}
        highlight
      />
      <SummaryStat
        label="Original − Wastage"
        value={`${formatWeight(
          finishedCost.originalWeightKg,
        )} − ${formatWeight(finishedCost.wastageWeightKg)}`}
      />
    </div>
  ) : null;

  const cuttingReady = finishedCostReady;
  const coilUsable =
    finishedCost?.remainingUsableWeightKg ?? Number(coil.currentWeight);

  return (
    <div className="space-y-6">
<CoilSummaryHeader
        coil={coil}
        totalAdditionalExpensesPaisa={totalAdditionalExpenses}
        isLoadingExpenses={isLoadingExpenses}
        breakdown={{
          usedInCuttingKg: cuttingConsumedKg,
          movedToPlaneKg: planeWeightKg,
          wastageKg,
        }}
        onMoveToPlane={
          Number(coil.currentWeight) > 0.0005
            ? () => setShowPlaneModal(true)
            : undefined
        }
      />

      <MoveToPlaneModal
        open={showPlaneModal}
        onClose={() => setShowPlaneModal(false)}
        coil={coil}
        onMoved={handlePlaneMoved}
      />

      <LifecycleStepper
        stages={stages}
        currentKey={activeKey}
        completedKeys={completedKeys}
        onSelect={handleStepperSelect}
      />

      {/* ───────────────────── Purchase (always completed) ───────────────────── */}
      <div
        ref={(el) => {
          purchaseRef.current = el;
        }}
      >
        <StageSummary
          stepNumber="Step 1"
          title="Purchase completed"
          description="Coil was received and booked at the supplier rate."
          values={purchaseSummary}
          primaryAction={
            <span className="text-xs text-green-400 font-medium">
              <PurchaseMovementsHint movements={movements} />
            </span>
          }
        />
      </div>

      {/* ───────────────────── Expenses ───────────────────── */}
      <div
        ref={(el) => {
          expensesRef.current = el;
        }}
      >
        {expenses.length === 0 ? (
          <StageShell
            stepNumber="Step 2"
            title="Add additional expenses"
            description="Land the coil in your books: transport, handling, manufacturing, labour, machine cost, etc."
            badge={
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Your turn
              </span>
            }
            values={
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <SummaryStat
                  label="Purchase Cost"
                  value={formatPaisa(Number(coil.purchaseAmountPaisa))}
                />
                <SummaryStat
                  label="Additional So Far"
                  value={formatPaisa(0)}
                  muted
                />
                <SummaryStat
                  label="Current Coil Cost"
                  value={formatPaisa(Number(coil.purchaseAmountPaisa))}
                  highlight
                />
              </div>
            }
            helper="Record at least one expense so the cost-per-KG can be calculated later."
          >
            <AdditionalExpensesSection
              coilId={coil.id}
              expenses={expenses}
              purchaseAmountPaisa={Number(coil.purchaseAmountPaisa)}
              isLoading={isLoadingExpenses}
              onChange={onReloadExpenses}
              embedded
            />
          </StageShell>
        ) : (
          <StageSummary
            stepNumber="Step 2"
            title="Expenses recorded"
            description={`${expenses.length} expense${
              expenses.length === 1 ? '' : 's'
            } captured against this coil.`}
            values={
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <SummaryStat
                  label="Total Additional"
                  value={formatPaisa(totalAdditionalExpenses)}
                />
                <SummaryStat
                  label="Current Coil Cost"
                  value={formatPaisa(
                    Number(coil.purchaseAmountPaisa) +
                      totalAdditionalExpenses,
                  )}
                  highlight
                />
                <SummaryStat
                  label="Items"
                  value={`${expenses.length} expense${
                    expenses.length === 1 ? '' : 's'
                  }`}
                />
              </div>
            }
            editable
            isOpen={expandedKey === 'expenses'}
            onToggle={() =>
              setExpandedKey((prev) =>
                prev === 'expenses' ? null : 'expenses',
              )
            }
            onEdit={() => scrollToStage('expenses')}
            primaryAction={
              <button
                type="button"
                onClick={() => scrollToStage('expenses')}
                className="text-xs text-zinc-100 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Manage
              </button>
            }
          >
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0D1117] border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider font-medium text-zinc-500">
                      Expense
                    </th>
                    <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider font-medium text-zinc-500">
                      Date
                    </th>
                    <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wider font-medium text-zinc-500">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="border-b border-zinc-800/60 last:border-b-0"
                    >
                      <td className="px-4 py-2.5 text-sm text-zinc-100">
                        {expense.description || expense.type}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-zinc-400">
                        {formatDate(expense.expenseDate)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium text-zinc-100">
                        {formatPaisa(Number(expense.amountPaisa))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StageSummary>
        )}
      </div>

      {/* ───────────────────── Processing ───────────────────── */}
      <div
        ref={(el) => {
          processingRef.current = el;
        }}
      >
        {Number(coil.wastageWeight) > 0 ? (
          <StageSummary
            stepNumber="Step 3"
            title="Processing logged"
            description={`Status: ${coil.processingStatus.replace('_', ' ').toLowerCase()}${
              coil.processingDate ? ` · ${formatDate(coil.processingDate)}` : ''
            }`}
            values={
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SummaryStat
                  label="Wastage"
                  value={formatWeight(Number(coil.wastageWeight))}
                />
                <SummaryStat
                  label="Current Weight"
                  value={formatWeight(Number(coil.currentWeight))}
                  highlight
                />
                <SummaryStat
                  label="Status"
                  value={coil.processingStatus.replace('_', ' ')}
                />
                <SummaryStat
                  label="Last Saved"
                  value={
                    coil.processingDate
                      ? formatDate(coil.processingDate)
                      : '—'
                  }
                />
              </div>
            }
            editable
            isOpen={expandedKey === 'processing'}
            onToggle={() =>
              setExpandedKey((prev) =>
                prev === 'processing' ? null : 'processing',
              )
            }
            onEdit={() => scrollToStage('processing')}
            primaryAction={
              <button
                type="button"
                onClick={() => scrollToStage('processing')}
                className="text-xs text-zinc-100 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Edit
              </button>
            }
          >
            <ProcessingSection
              coil={coil}
              totalAdditionalExpensesPaisa={totalAdditionalExpenses}
              onChange={handleCoilUpdate}
              embedded
            />
          </StageSummary>
        ) : (
          <StageShell
            stepNumber="Step 3"
            title="Record processing & wastage"
            description="Mark the coil as in-progress and enter the wastage to compute the usable weight."
            badge={
              expenses.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-500 ring-1 ring-zinc-700">
                  Locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  Your turn
                </span>
              )
            }
            values={
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <SummaryStat
                  label="Current Coil Weight"
                  value={formatWeight(Number(coil.currentWeight))}
                />
                <SummaryStat
                  label="Wastage"
                  value={formatWeight(0)}
                  muted
                />
                <SummaryStat
                  label="Usable (after)"
                  value={formatWeight(Number(coil.currentWeight))}
                  highlight
                />
              </div>
            }
            helper={
              expenses.length === 0
                ? 'Complete the Expenses step first.'
                : 'Saving the form will create a SCRAP movement and reduce the coil balance.'
            }
          >
            {expenses.length === 0 ? (
              <StepLockHint>
                Add at least one expense first — finished cost needs it.
              </StepLockHint>
            ) : (
              <ProcessingSection
                coil={coil}
                totalAdditionalExpensesPaisa={totalAdditionalExpenses}
                onChange={handleCoilUpdate}
                embedded
              />
            )}
          </StageShell>
        )}
      </div>

      {/* ───────────────────── Finished Cost (read-only summary) ───────────────────── */}
      <div
        ref={(el) => {
          finishedCostRef.current = el;
        }}
      >
        {finishedCostReady && finishedCost ? (
          <StageShell
            stepNumber="Step 4"
            title="Finished cost is ready"
            description="Computed automatically from your invested cost and the remaining usable weight."
            badge={
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 ring-1 ring-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Ready
              </span>
            }
            values={finishedCostStats}
            helper="This snapshot is used for cutting cost allocation and POS pricing."
          >
            <div className="rounded-lg bg-[#0D1117] border border-zinc-800 p-4 text-sm text-zinc-400 leading-relaxed">
              <p>
                <span className="text-zinc-200 font-medium">
                  {formatPaisa(finishedCost.finishedCostPerKgPaisa)} / KG
                </span>{' '}
                — derived from{' '}
                <span className="text-zinc-200">
                  {formatPaisa(finishedCost.totalInvestedCostPaisa)}
                </span>{' '}
                invested over{' '}
                <span className="text-zinc-200">
                  {formatWeight(finishedCost.remainingUsableWeightKg)}
                </span>{' '}
                of usable weight.
              </p>
              <p className="mt-3 text-xs text-zinc-500">
                To recalculate, edit the processing wastage or add another
                expense.
              </p>
            </div>
          </StageShell>
        ) : (
          <StagePreview
            stepNumber="Step 4"
            title="Finished cost"
            preview="The cost per usable KG is computed automatically once processing wastage is recorded."
            expectations={[
              'Invested cost ÷ remaining usable weight',
              'Used to snapshot production cost on each cutting batch',
              'Updates whenever you add an expense or change wastage',
            ]}
            helper="Complete processing & wastage to unlock this step."
          />
        )}
      </div>

      {/* ───────────────────── Cutting ───────────────────── */}
      <div
        ref={(el) => {
          cuttingRef.current = el;
        }}
      >
        {cuttingReady ? (
          <StageShell
            stepNumber="Step 5"
            title="Cut into chaddar sizes"
            description="For each size enter length (feet) and quantity — the system derives the average weight, per-piece weight and reduces the coil atomically."
            badge={
              cuttingBatches.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 ring-1 ring-green-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  In production
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  Your turn
                </span>
              )
            }
            values={
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SummaryStat
                  label="Coil Usable"
                  value={formatWeight(coilUsable)}
                />
                <SummaryStat
                  label="Cost / KG"
                  value={formatPaisa(finishedCost!.finishedCostPerKgPaisa)}
                />
                <SummaryStat
                  label="Batches Recorded"
                  value={String(cuttingBatches.length)}
                />
                <SummaryStat
                  label="Last Production"
                  value={
                    cuttingBatches[0]
                      ? formatDate(
                          cuttingBatches[0].cuttingBatch.productionDate,
                        )
                      : '—'
                  }
                />
              </div>
            }
            helper="Recording a batch consumes the full usable weight across the requested sizes."
          >
            <CuttingSection
              coil={coil}
              finishedCostPerKgPaisa={finishedCost!.finishedCostPerKgPaisa}
              batches={cuttingBatches}
              onCreated={handleCuttingCreated}
              mode="compact"
            />
          </StageShell>
        ) : (
          <StagePreview
            stepNumber="Step 5"
            title="Cutting & finished chaddar"
            preview="Once finished cost is computed, this is where production happens."
            expectations={[
              'Enter length (ft) + quantity for each size',
              'Average 10-ft weight is computed automatically',
              'Each size becomes its own sellable stock row',
            ]}
            helper="Complete processed + cost first."
          />
        )}
      </div>

{/* ───────────────────── Plane from this coil ───────────────────── */}
      <div
        ref={(el) => {
          planeRef.current = el;
        }}
      >
        {planeEntries.length > 0 ? (
          <StageSummary
            stepNumber="Step 5b"
            title="Plane from this coil"
            description={`${planeEntries.length} plane entr${
              planeEntries.length === 1 ? 'y' : 'ies'
            } on file - ${planeWeightKg.toFixed(3)} KG / ${planeFeet.toFixed(3)} ft.`}
            values={
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SummaryStat
                  label="Plane Weight"
                  value={formatWeight(planeWeightKg)}
                />
                <SummaryStat
                  label="Plane Feet"
                  value={`${planeFeet.toFixed(3)} ft`}
                />
                <SummaryStat
                  label="Entries"
                  value={String(planeEntries.length)}
                />
                <SummaryStat
                  label="Coil Remaining"
                  value={formatWeight(Number(coil.currentWeight))}
                />
              </div>
            }
            editable
            isOpen={expandedKey === 'plane'}
            onToggle={() =>
              setExpandedKey((prev) => (prev === 'plane' ? null : 'plane'))
            }
            onEdit={() => scrollToStage('plane')}
            primaryAction={
              <PrimaryButton
                type="button"
                onClick={() => scrollToStage('plane')}
              >
                View plane history
              </PrimaryButton>
            }
          >
            <div className="space-y-3">
              {planeEntries.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#0D1117] border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      PLANE-{String(p.id).padStart(5, '0')}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {p.note || 'Plane transfer'}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {formatDate(p.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-zinc-100">
                      {formatWeight(Number(p.weightKg))}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {p.calculatedFeet.toFixed(3)} ft
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </StageSummary>
        ) : isPlaneLoading ? (
          <StageSummary
            stepNumber="Step 5b"
            title="Loading plane entries"
            description=""
            values={
              <div className="text-sm text-zinc-500 px-4 py-2">
                Checking plane history for this coil...
              </div>
            }
          />
        ) : null}
      </div>

      {/* ───────────────────── Finished Stock ───────────────────── */}
      <div
        ref={(el) => {
          finishedStockRef.current = el;
        }}
      >
        {cuttingBatches.length > 0 ? (
          <StageSummary
            stepNumber="Step 6"
            title="Finished stock is sellable"
            description={`${cuttingBatches.length} batch${
              cuttingBatches.length === 1 ? '' : 'es'
            } on file.`}
            values={
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SummaryStat
                  label="Batches"
                  value={String(cuttingBatches.length)}
                />
                <SummaryStat
                  label="Coil Remaining"
                  value={formatWeight(Number(coil.currentWeight))}
                />
                <SummaryStat
                  label="Cost / KG"
                  value={formatPaisa(
                    Number(
                      cuttingBatches[0]?.cuttingBatch
                        .finishedCostPerKgPaisa ?? 0,
                    ),
                  )}
                />
                <SummaryStat
                  label="Latest Batch"
                  value={formatDate(
                    cuttingBatches[0].cuttingBatch.productionDate,
                  )}
                />
              </div>
            }
            editable
            isOpen={expandedKey === 'finished-stock'}
            onToggle={() =>
              setExpandedKey((prev) =>
                prev === 'finished-stock' ? null : 'finished-stock',
              )
            }
            onEdit={() => scrollToStage('cutting')}
            primaryAction={
              <PrimaryButton
                type="button"
                onClick={() => scrollToStage('finished-stock')}
              >
                View production history
              </PrimaryButton>
            }
          >
            <div className="space-y-3">
              {cuttingBatches.map(({ cuttingBatch, finishedStock }) => (
                <div
                  key={cuttingBatch.id}
                  className="bg-[#0D1117] border border-zinc-800 rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      {cuttingBatch.code}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {cuttingBatch.sizeLabel} ·{' '}
                      {formatDate(cuttingBatch.productionDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-zinc-100">
                      {formatWeight(Number(cuttingBatch.cuttingWeightKg))}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {finishedStock.remainingPieces} of{' '}
                      {finishedStock.piecesProduced} pieces left
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </StageSummary>
        ) : (
          <StagePreview
            stepNumber="Step 6"
            title="Sell from finished stock"
            preview="After at least one cutting batch, stock rows appear here and become available for POS sales."
            expectations={[
              'Per-size finished stock rows',
              'Live remaining pieces / weight',
              'One-click hand-off to the Sales screen',
            ]}
            helper="Record at least one cutting batch to unlock this step."
          />
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  muted = false,
  highlight = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2.5 border ${
        highlight
          ? 'bg-zinc-800/70 border-zinc-700'
          : 'bg-[#0D1117] border-zinc-800'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-1 text-sm ${
          muted
            ? 'text-zinc-500'
            : highlight
              ? 'text-base font-semibold text-zinc-100'
              : 'font-medium text-zinc-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StepLockHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-[#10141A] px-5 py-6 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}

function PurchaseMovementsHint({
  movements,
}: {
  movements: InventoryMovement[];
}) {
  const receipt = movements.find(
    (m) => m.type === 'PURCHASE_RECEIPT',
  );
  if (!receipt) return <span className="text-zinc-500">Booked</span>;
  return (
    <span className="text-zinc-500 inline-flex items-center gap-1.5">
      <svg
        className="w-3.5 h-3.5"
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
      Received
    </span>
  );
}

