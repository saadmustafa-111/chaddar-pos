'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  coilsApi,
  cuttingBatchesApi,
  Coil,
  CuttingBatchWithStock,
  FinishedCostSummary as FinishedCost,
  InventoryMovement,
} from '../../../../../features/coils/api/coils';
import {
  landingExpensesApi,
  LandingExpense,
} from '../../../../../features/landing-expenses/api/landing-expenses';
import { CoilWorkflow } from '../../../../../features/coils/components/CoilWorkflow';

export default function CoilDetailPage() {
  const params = useParams();
  const [coil, setCoil] = useState<Coil | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [expenses, setExpenses] = useState<LandingExpense[]>([]);
  const [finishedCost, setFinishedCost] = useState<FinishedCost | null>(null);
  const [cuttingBatches, setCuttingBatches] = useState<
    CuttingBatchWithStock[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [error, setError] = useState('');

  const loadExpenses = useCallback(async () => {
    if (!params.id) return;
    setIsLoadingExpenses(true);
    try {
      const data = await landingExpensesApi.findByCoil(Number(params.id));
      setExpenses(data);
    } catch {
      setExpenses([]);
    } finally {
      setIsLoadingExpenses(false);
    }
  }, [params.id]);

  const loadFinishedCost = useCallback(async (id: number) => {
    try {
      const data = await coilsApi.getFinishedCost(id);
      setFinishedCost(data);
    } catch {
      setFinishedCost(null);
    }
  }, []);

  const reloadMovements = useCallback(async (id: number) => {
    try {
      const data = await coilsApi.getMovements(id);
      setMovements(data);
    } catch {
      setMovements([]);
    }
  }, []);

  const reloadAll = useCallback(
    async (id: number) => {
      const [refreshed, freshMovements, freshBatches, freshExpenses] =
        await Promise.all([
          coilsApi.findOne(id),
          coilsApi.getMovements(id),
          cuttingBatchesApi.findByCoil(id),
          landingExpensesApi.findByCoil(id),
        ]);
      setCoil(refreshed);
      setMovements(freshMovements);
      setCuttingBatches(freshBatches);
      setExpenses(freshExpenses);
      await loadFinishedCost(id);
    },
    [loadFinishedCost],
  );

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

        const [
          coilData,
          movementsData,
          expensesData,
          finishedCostData,
          cuttingData,
        ] = await Promise.all([
          coilsApi.findOne(id),
          coilsApi.getMovements(id).catch(() => [] as InventoryMovement[]),
          landingExpensesApi
            .findByCoil(id)
            .catch(() => [] as LandingExpense[]),
          coilsApi
            .getFinishedCost(id)
            .catch(() => null as FinishedCost | null),
          cuttingBatchesApi
            .findByCoil(id)
            .catch(() => [] as CuttingBatchWithStock[]),
        ]);

        if (!cancelled) {
          setCoil(coilData);
          setMovements(movementsData);
          setExpenses(expensesData);
          setFinishedCost(finishedCostData);
          setCuttingBatches(cuttingData);
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

  const handleCoilAndCostUpdate = useCallback(
    async (next: Coil) => {
      setCoil(next);
      const id = Number(params.id);
      await Promise.all([reloadMovements(id), loadFinishedCost(id)]);
    },
    [params.id, reloadMovements, loadFinishedCost],
  );

  const handleCuttingCreated = useCallback(
    async (result: CuttingBatchWithStock, optimisticCoil: Coil) => {
      setCuttingBatches((prev) => [result, ...prev]);
      setCoil(optimisticCoil);
      const id = Number(params.id);
      try {
        await reloadAll(id);
      } catch {
        // Optimistic state is acceptable if refresh fails.
      }
    },
    [params.id, reloadAll],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="text-zinc-500 text-sm">Loading coil workflow…</div>
      </div>
    );
  }

  if (error || !coil) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-[#0B0F14] border border-red-500/30 rounded-xl p-6">
          <p className="text-sm text-red-400">{error || 'Coil not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <CoilWorkflow
        coil={coil}
        expenses={expenses}
        isLoadingExpenses={isLoadingExpenses}
        movements={movements}
        finishedCost={finishedCost}
        cuttingBatches={cuttingBatches}
        onReloadExpenses={loadExpenses}
        onReloadCoilAndCost={handleCoilAndCostUpdate}
        onCuttingCreated={handleCuttingCreated}
      />
    </div>
  );
}
