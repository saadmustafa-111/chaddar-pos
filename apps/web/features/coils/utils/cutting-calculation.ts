/**
 * Pure helpers for the cutting-production formula. Must stay in lockstep
 * with `apps/api/src/modules/cutting-batches/calculation.ts` so the live
 * form preview always matches the server-computed batch.
 *
 * Rules:
 *
 *   tenFtEquivalentQty   = SUM (lengthFt x qty) / 10
 *   avg10ftPieceWeight   = usableCoilWeight / tenFtEquivalentQty
 *   pieceWeight(size)    = avg10ftPieceWeight x (lengthFt / 10)
 *   totalSizeWeight(row) = pieceWeight x qty
 *
 * Implementation is intentionally generic and accepts any positive
 * lengthFt (no hardcoded 8/10/12).
 */

export interface CuttingRowInput {
  lengthFt: number;
  quantity: number;
}

export interface ResolvedCuttingRow {
  lengthFt: number;
  quantity: number;
  pieceWeightKg: number;
  totalWeightKg: number;
}

export interface CuttingPlan {
  rows: ResolvedCuttingRow[];
  tenFtEquivalentQty: number;
  avg10ftPieceWeightKg: number;
  usableCoilWeightKg: number;
  totalProducedWeightKg: number;
}

export const REFERENCE_LENGTH_FT = 10;

/** Standard 3-decimal rounding used everywhere a weight is stored. */
export const roundKg = (n: number): number => Math.round(n * 1000) / 1000;

export interface PlanCuttingArgs {
  rows: ReadonlyArray<CuttingRowInput>;
  usableCoilWeightKg: number;
}

/**
 * Returns a plan or, when the inputs are insufficient (no rows, empty
 * coil weight, etc.), `null`. The cutting form uses the absence of a
 * plan to show a placeholder preview and avoid dividing by zero.
 */
export function planCutting(
  args: PlanCuttingArgs,
): CuttingPlan | null {
  const { rows, usableCoilWeightKg } = args;

  if (!Number.isFinite(usableCoilWeightKg) || usableCoilWeightKg <= 0) {
    return null;
  }
  if (!rows || rows.length === 0) {
    return null;
  }

  let equivalentFeet = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.lengthFt) ||
      r.lengthFt <= 0 ||
      !Number.isInteger(r.quantity) ||
      r.quantity <= 0
    ) {
      return null;
    }
    equivalentFeet += r.lengthFt * r.quantity;
  }
  if (!Number.isFinite(equivalentFeet) || equivalentFeet <= 0) {
    return null;
  }

  const tenFtEquivalentQty = equivalentFeet / REFERENCE_LENGTH_FT;
  const avg10ftPieceWeightKg = usableCoilWeightKg / tenFtEquivalentQty;
  if (
    !Number.isFinite(avg10ftPieceWeightKg) ||
    avg10ftPieceWeightKg <= 0
  ) {
    return null;
  }

  const resolved: ResolvedCuttingRow[] = rows.map((r) => {
    const pieceWeightKg = roundKg(
      avg10ftPieceWeightKg * (r.lengthFt / REFERENCE_LENGTH_FT),
    );
    const totalWeightKg = roundKg(pieceWeightKg * r.quantity);
    return {
      lengthFt: r.lengthFt,
      quantity: r.quantity,
      pieceWeightKg,
      totalWeightKg,
    };
  });

  const totalProducedWeightKg = roundKg(
    resolved.reduce((sum, r) => sum + r.totalWeightKg, 0),
  );

  return {
    rows: resolved,
    tenFtEquivalentQty: roundKg(tenFtEquivalentQty),
    avg10ftPieceWeightKg: roundKg(avg10ftPieceWeightKg),
    usableCoilWeightKg: roundKg(usableCoilWeightKg),
    totalProducedWeightKg,
  };
}
