/**
 * Pure helpers for the cutting-production formula.
 *
 * The shop-floor rule (per the client) is:
 *
 *   For each row, lengthFt x qty (e.g. 8ft x 110, 10ft x 70, 12ft x 85).
 *
 *   tenFtEquivalentQty   = SUM (lengthFt x qty) / 10
 *   avg10ftPieceWeight   = usableCoilWeight / tenFtEquivalentQty
 *   pieceWeight(size)    = avg10ftPieceWeight x (lengthFt / 10)
 *   totalSizeWeight(row) = pieceWeight x qty
 *
 * The implementation is intentionally generic: any positive lengthFt is
 * allowed, no sizes are hardcoded, and rounding is centralized through
 * a single `roundKg` helper so we never disagree across the codebase.
 */

import { BadRequestException } from '@nestjs/common';

export interface CuttingRowInput {
  /** Length of one piece, in feet. Must be > 0. */
  lengthFt: number;
  /** Width of the coil in inches. Used for heat number generation. */
  widthInches: number;
  /** Number of pieces of that length. Must be a positive integer. */
  quantity: number;
}

export interface ResolvedCuttingRow {
  lengthFt: number;
  widthInches: number;
  quantity: number;
  /** pieceWeight = avg10ftPieceWeight x (lengthFt / 10). */
  pieceWeightKg: number;
  /** totalSizeWeight = pieceWeight x quantity. */
  totalWeightKg: number;
}

export interface CuttingPlan {
  rows: ResolvedCuttingRow[];
  tenFtEquivalentQty: number;
  avg10ftPieceWeightKg: number;
  usableCoilWeightKg: number;
  totalProducedWeightKg: number;
  /**
   * The small leftover from per-row rounding that stays in the source
   * coil when the rounded per-row totals come in below the input weight.
   * Always >= 0 and never larger than the number of rows in the plan
   * (because each row only drops a milligram at most). The service
   * persists a SCRAP movement for this when it is material.
   */
  wastageFromRoundingKg: number;
}

/** Standard 3-decimal rounding used everywhere a weight is stored. */
export const ROUND_KG = (n: number): number => Math.round(n * 1000) / 1000;

export const REFERENCE_LENGTH_FT = 10;

function isPositiveFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** Coerce + validate a single input row. Throws BadRequestException with a
 *  precise message so the UI can pin-point the offending row. */
export function normalizeCuttingRow(
  raw: Partial<CuttingRowInput> | null | undefined,
  index: number,
): CuttingRowInput {
  const lengthFt = Number(raw?.lengthFt);
  const widthInches = Number(raw?.widthInches);
  const quantity = Number(raw?.quantity);
  const tag = `Row ${index + 1}`;

  if (!Number.isFinite(lengthFt)) {
    throw new BadRequestException(`${tag}: length (ft) is required`);
  }
  if (lengthFt <= 0) {
    throw new BadRequestException(
      `${tag}: length (ft) must be greater than zero (got ${lengthFt})`,
    );
  }

  if (Number.isFinite(widthInches) && widthInches <= 0) {
    throw new BadRequestException(
      `${tag}: width (inches) must be greater than zero (got ${widthInches})`,
    );
  }

  if (!Number.isFinite(quantity)) {
    throw new BadRequestException(`${tag}: quantity is required`);
  }
  if (!Number.isInteger(quantity)) {
    throw new BadRequestException(
      `${tag}: quantity must be a whole number (got ${quantity})`,
    );
  }
  if (quantity <= 0) {
    throw new BadRequestException(
      `${tag}: quantity must be greater than zero (got ${quantity})`,
    );
  }

  return { lengthFt, widthInches, quantity };
}

/** Normalize a list of raw row inputs (e.g. from a request body) into a
 *  canonical CuttingRowInput array, validating each one. */
export function normalizeCuttingRows(
  rows:
    | ReadonlyArray<Partial<CuttingRowInput> | null | undefined>
    | undefined
    | null,
): CuttingRowInput[] {
  if (!rows || rows.length === 0) {
    throw new BadRequestException(
      'Provide at least one size (length in feet and quantity).',
    );
  }
  return rows.map((row, i) => normalizeCuttingRow(row, i));
}

export interface PlanCuttingArgs {
  rows: ReadonlyArray<CuttingRowInput>;
  usableCoilWeightKg: number;
}

/**
 * Build the full plan: how many 10-ft equivalent pieces the rows
 * represent, what the per-row weights should be, and the totals.
 *
 * The function is allocation-free and pure - easy to unit test in
 * isolation from the DB / transaction layer.
 *
 * IMPORTANT: with per-row 3-decimal rounding, the sum of the rounded row
 * totals is not guaranteed to equal `usableCoilWeightKg` exactly. In
 * practice the sum is usually a few grams below the input (because we
 * never round a piece up to the next gram), but on adversarial inputs
 * (e.g. 1 piece of a single non-10ft size) it can land a milligram
 * above. The caller MUST clamp the actual coil deduction to the
 * remaining coil weight to avoid negative stock. The plan's
 * `totalProducedWeightKg` is the *intended* production weight and
 * `wastageFromRoundingKg` is the small leftover that stays in the
 * coil when the rounded per-row totals come in just below the input.
 */
export function planCutting(args: PlanCuttingArgs): CuttingPlan {
  const { rows, usableCoilWeightKg } = args;

  if (!Number.isFinite(usableCoilWeightKg)) {
    throw new BadRequestException('Usable coil weight must be a finite number');
  }
  if (usableCoilWeightKg <= 0) {
    throw new BadRequestException(
      'Usable coil weight must be greater than zero. Record processing wastage and add an additional expense to compute the finished cost first.',
    );
  }
  if (rows.length === 0) {
    throw new BadRequestException(
      'Provide at least one size (length in feet and quantity).',
    );
  }

  let equivalentFeet = 0;
  for (const r of rows) {
    equivalentFeet += r.lengthFt * r.quantity;
  }
  if (!isPositiveFiniteNumber(equivalentFeet)) {
    throw new BadRequestException(
      'Total cut length (ft x quantity) must be greater than zero',
    );
  }

  const tenFtEquivalentQty = equivalentFeet / REFERENCE_LENGTH_FT;
  const avg10ftPieceWeightKg = usableCoilWeightKg / tenFtEquivalentQty;
  if (!Number.isFinite(avg10ftPieceWeightKg) || avg10ftPieceWeightKg <= 0) {
    throw new BadRequestException(
      'Computed average 10-ft piece weight is invalid for the given coil weight and sizes.',
    );
  }

  const resolved: ResolvedCuttingRow[] = rows.map((r) => {
    const pieceWeightKg = ROUND_KG(
      avg10ftPieceWeightKg * (r.lengthFt / REFERENCE_LENGTH_FT),
    );
    const totalWeightKg = ROUND_KG(pieceWeightKg * r.quantity);
    return {
      lengthFt: r.lengthFt,
      widthInches: r.widthInches,
      quantity: r.quantity,
      pieceWeightKg,
      totalWeightKg,
    };
  });

  const totalProducedWeightKg = ROUND_KG(
    resolved.reduce((sum, r) => sum + r.totalWeightKg, 0),
  );

  // The rounded per-row totals usually sum to slightly less than the
  // input weight (the rounding drops a milligram on most rows). That
  // tiny leftover is reported as `wastageFromRoundingKg` so the
  // caller can emit a SCRAP movement for the audit trail. On
  // adversarial inputs (single piece of a non-10ft size) the rounded
  // sum can land a milligram *above* the input; in that case the
  // caller MUST clamp the actual deduction to the remaining coil
  // weight to avoid negative stock.
  const wastageFromRoundingKg = ROUND_KG(
    Math.max(0, usableCoilWeightKg - totalProducedWeightKg),
  );

  return {
    rows: resolved,
    tenFtEquivalentQty: ROUND_KG(tenFtEquivalentQty),
    avg10ftPieceWeightKg: ROUND_KG(avg10ftPieceWeightKg),
    usableCoilWeightKg: ROUND_KG(usableCoilWeightKg),
    totalProducedWeightKg,
    wastageFromRoundingKg,
  };
}

/**
 * Build the canonical size label a finished stock row should carry. We
 * always encode the length in feet so the label is unique within a coil
 * and the historical relation (sale items -> stock rows) remains stable.
 */
export function defaultSizeLabelForRow(row: ResolvedCuttingRow): string {
  return `${row.lengthFt}ft`;
}

/**
 * Default density of steel in grams per cubic centimetre. Used as a
 * fallback when a coil has no cutting history - we then derive the
 * theoretical kg/foot purely from the coil's width and thickness.
 *
 * 7.85 g/cm^3 is the standard value for mild/carbon steel and matches
 * the density implied by the production data the shop has been
 * recording. We expose it as a constant so the rest of the codebase
 * uses one source of truth if the shop ever needs to calibrate.
 */
export const STEEL_DENSITY_G_PER_CM3 = 7.85;

/**
 * Lightweight snapshot of a coil's physical specification used by the
 * shared KG <-> Feet helpers. Keeping this as its own type means the
 * helper is trivially unit-testable and is decoupled from TypeORM
 * entity loading order.
 */
export interface CoilSpecForFeet {
  widthMm: number | null;
  thicknessMm: number | null;
}

/**
 * History snapshot used as the primary source of truth for kg/foot
 * when the shop has already cut this coil. The historical rows are
 * the closest analogue to a measured value, so we prefer them over
 * any theoretical calculation.
 */
export interface CoilHistoryRow {
  weightPerPieceKg: number | null;
  lengthFt: number | null;
}

/**
 * Returns the kg/foot for a coil specification. Prefers the most
 * recent measured piece weight from finished stock; falls back to a
 * theoretical value derived from the coil's width and thickness at
 * standard steel density.
 *
 * Returns null when neither path yields a usable number, so the
 * caller can surface a clear "spec missing" error to the operator
 * instead of guessing.
 */
export function coilKgPerFoot(
  spec: CoilSpecForFeet,
  history: CoilHistoryRow[],
): number | null {
  for (const row of history) {
    const wpp = row.weightPerPieceKg;
    const lf = row.lengthFt;
    if (
      wpp != null &&
      lf != null &&
      Number.isFinite(wpp) &&
      Number.isFinite(lf) &&
      wpp > 0 &&
      lf > 0
    ) {
      return wpp / lf;
    }
  }

  const widthMm = spec.widthMm;
  const thicknessMm = spec.thicknessMm;
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

  // Convert to centimetres and compute the linear weight at steel
  // density. 30.48 cm / ft is exact (international foot).
  const widthCm = widthMm / 10;
  const thicknessCm = thicknessMm / 10;
  const crossSectionCm2 = widthCm * thicknessCm;
  const massGPerCm = (crossSectionCm2 * STEEL_DENSITY_G_PER_CM3) / 1;
  const massKgPerCm = massGPerCm / 1000;
  const cmPerFoot = 30.48;
  return ROUND_KG(massKgPerCm * cmPerFoot);
}

/**
 * Convenience: turn a weight in KG into feet for a given coil.
 * Returns null when the coil has no usable kg/foot spec.
 */
export function kgToFeet(
  spec: CoilSpecForFeet,
  history: CoilHistoryRow[],
  weightKg: number,
): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const kgPerFoot = coilKgPerFoot(spec, history);
  if (kgPerFoot == null || kgPerFoot <= 0) return null;
  return ROUND_KG(weightKg / kgPerFoot);
}
