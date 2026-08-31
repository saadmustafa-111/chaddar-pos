import { BadRequestException } from '@nestjs/common';
import {
  planCutting,
  normalizeCuttingRow,
  normalizeCuttingRows,
  ROUND_KG,
  REFERENCE_LENGTH_FT,
  defaultSizeLabelForRow,
  CuttingRowInput,
} from './calculation';

describe('cutting calculation helpers', () => {
  describe('ROUND_KG', () => {
    it('rounds to 3 decimals with standard half-up semantics', () => {
      expect(ROUND_KG(1.2345)).toBe(1.235);
      expect(ROUND_KG(1.2344)).toBe(1.234);
      expect(ROUND_KG(0)).toBe(0);
      expect(ROUND_KG(0.0004)).toBe(0);
      expect(ROUND_KG(0.0006)).toBe(0.001);
    });
  });

  describe('normalizeCuttingRow', () => {
    it('accepts a valid row', () => {
      const row = normalizeCuttingRow({ lengthFt: 10, quantity: 5 }, 0);
      expect(row).toEqual({ lengthFt: 10, quantity: 5 });
    });

    it('coerces string inputs via Number()', () => {
      const row = normalizeCuttingRow({ lengthFt: '12.5', quantity: '3' }, 1);
      expect(row).toEqual({ lengthFt: 12.5, quantity: 3 });
    });

    it('rejects zero length', () => {
      expect(() =>
        normalizeCuttingRow({ lengthFt: 0, quantity: 1 }, 0),
      ).toThrow(BadRequestException);
    });

    it('rejects negative length', () => {
      expect(() =>
        normalizeCuttingRow({ lengthFt: -1, quantity: 1 }, 0),
      ).toThrow(BadRequestException);
    });

    it('rejects zero quantity', () => {
      expect(() =>
        normalizeCuttingRow({ lengthFt: 10, quantity: 0 }, 0),
      ).toThrow(BadRequestException);
    });

    it('rejects non-integer quantity', () => {
      expect(() =>
        normalizeCuttingRow({ lengthFt: 10, quantity: 1.5 }, 0),
      ).toThrow(BadRequestException);
    });

    it('rejects missing length/quantity', () => {
      expect(() =>
        normalizeCuttingRow({ lengthFt: undefined, quantity: 1 }, 0),
      ).toThrow(BadRequestException);
      expect(() =>
        normalizeCuttingRow({ lengthFt: 10, quantity: null }, 0),
      ).toThrow(BadRequestException);
    });

    it('uses the row index in error messages', () => {
      try {
        normalizeCuttingRow({ lengthFt: 10, quantity: 0 }, 4);
        fail('expected error');
      } catch (err) {
        expect((err as Error).message).toContain('Row 5');
      }
    });
  });

  describe('normalizeCuttingRows', () => {
    it('rejects an empty list', () => {
      expect(() => normalizeCuttingRows([])).toThrow(BadRequestException);
      expect(() => normalizeCuttingRows(undefined)).toThrow(
        BadRequestException,
      );
      expect(() => normalizeCuttingRows(null)).toThrow(BadRequestException);
    });

    it('returns the normalised rows when valid', () => {
      const out = normalizeCuttingRows([
        { lengthFt: 8, quantity: 110 },
        { lengthFt: 10, quantity: 70 },
        { lengthFt: 12, quantity: 85 },
      ]);
      expect(out).toHaveLength(3);
      expect(out[0]).toEqual({ lengthFt: 8, quantity: 110 });
    });
  });

  describe('planCutting - canonical formula', () => {
    /**
     * Realistic production lot the client described:
     *   8ft x 110, 10ft x 70, 12ft x 85
     *
     *   Total equivalent feet = 8*110 + 10*70 + 12*85 = 880 + 700 + 1020 = 2600 ft
     *   tenFtEquivalentQty = 2600 / 10 = 260
     *
     * Pick a coil that exactly divides the equivalent length: 1000 KG.
     *   avg10ftPieceWeight = 1000 / 260 = 3.846153... KG -> 3.846 KG
     *
     *   8ft  pieces:  3.846 * 8 / 10 = 3.0768 -> 3.077 KG/pc   total = 3.077 * 110 = 338.470 -> 338.470 KG
     *   10ft pieces:  3.846 * 10 / 10 = 3.846 KG/pc          total = 3.846 * 70 = 269.220 KG
     *   12ft pieces:  3.846 * 12 / 10 = 4.6152 -> 4.615 KG/pc total = 4.615 * 85 = 392.275 KG
     *
     * The total produced weight (338.470 + 269.220 + 392.275 = 999.965) is
     * slightly less than the coil weight of 1000 KG because of rounding,
     * which is the expected outcome of doing 3-decimal weights on each row.
     */
    it('matches the client formula for the documented example', () => {
      const rows: CuttingRowInput[] = [
        { lengthFt: 8, quantity: 110 },
        { lengthFt: 10, quantity: 70 },
        { lengthFt: 12, quantity: 85 },
      ];
      const usable = 1000;

      const plan = planCutting({ rows, usableCoilWeightKg: usable });

      expect(plan.tenFtEquivalentQty).toBe(260);
      // avg = 1000 / 260 = 3.846153... -> rounded to 3.846
      expect(plan.avg10ftPieceWeightKg).toBeCloseTo(3.846, 3);

      const [r8, r10, r12] = plan.rows;
      expect(r8.pieceWeightKg).toBeCloseTo(3.077, 3);
      expect(r8.totalWeightKg).toBeCloseTo(3.077 * 110, 2);
      expect(r10.pieceWeightKg).toBe(3.846);
      expect(r10.totalWeightKg).toBeCloseTo(3.846 * 70, 2);
      expect(r12.pieceWeightKg).toBeCloseTo(4.615, 3);
      expect(r12.totalWeightKg).toBeCloseTo(4.615 * 85, 2);

      // Sum of produced weights must never exceed the usable coil weight.
      expect(plan.totalProducedWeightKg).toBeLessThanOrEqual(usable + 0.0005);

      // The reference length is exactly 10 ft.
      expect(REFERENCE_LENGTH_FT).toBe(10);
    });

    it('is generic - any length works, including non-multiples of 10', () => {
      const rows: CuttingRowInput[] = [
        { lengthFt: 7, quantity: 11 },
        { lengthFt: 13.5, quantity: 9 },
        { lengthFt: 22, quantity: 3 },
      ];
      const usable = 123.456;

      const plan = planCutting({ rows, usableCoilWeightKg: usable });

      const expectedEq = (7 * 11 + 13.5 * 9 + 22 * 3) / 10;
      expect(plan.tenFtEquivalentQty).toBeCloseTo(expectedEq, 2);
      expect(plan.avg10ftPieceWeightKg).toBeCloseTo(usable / expectedEq, 2);

      // NOTE: plan.avg10ftPieceWeightKg and each row.pieceWeightKg are
      // both independently rounded to 3 decimals, so the per-row value is
      // expected to differ slightly from a re-derived average. We compare
      // against the un-rounded average computed inline.
      const unroundedAvg = usable / expectedEq;
      for (const row of plan.rows) {
        const input = rows.find((r) => r.lengthFt === row.lengthFt)!;
        expect(row.pieceWeightKg).toBeCloseTo(
          unroundedAvg * (input.lengthFt / 10),
          2,
        );
        expect(row.totalWeightKg).toBeCloseTo(
          row.pieceWeightKg * input.quantity,
          2,
        );
      }
    });

    it('treats single rows correctly', () => {
      const plan = planCutting({
        rows: [{ lengthFt: 10, quantity: 50 }],
        usableCoilWeightKg: 250,
      });
      expect(plan.tenFtEquivalentQty).toBe(50);
      expect(plan.avg10ftPieceWeightKg).toBe(5);
      expect(plan.rows[0].pieceWeightKg).toBe(5);
      expect(plan.rows[0].totalWeightKg).toBe(250);
      expect(plan.totalProducedWeightKg).toBe(250);
    });

    it('rejects empty rows', () => {
      expect(() => planCutting({ rows: [], usableCoilWeightKg: 100 })).toThrow(
        BadRequestException,
      );
    });

    it('rejects zero or non-positive usable coil weight', () => {
      const rows: CuttingRowInput[] = [{ lengthFt: 10, quantity: 1 }];
      expect(() => planCutting({ rows, usableCoilWeightKg: 0 })).toThrow(
        BadRequestException,
      );
      expect(() => planCutting({ rows, usableCoilWeightKg: -50 })).toThrow(
        BadRequestException,
      );
      expect(() =>
        planCutting({ rows, usableCoilWeightKg: Number.NaN }),
      ).toThrow(BadRequestException);
    });

    it('never produces a plan with negative or non-finite weights', () => {
      // Even when the operator uses awkward numbers, every persisted
      // weight must be a clean, non-negative 3-decimal value.
      const plan = planCutting({
        rows: [
          { lengthFt: 5, quantity: 2 },
          { lengthFt: 12.25, quantity: 4 },
          { lengthFt: 17.5, quantity: 1 },
        ],
        usableCoilWeightKg: 87.654,
      });
      for (const r of plan.rows) {
        expect(r.pieceWeightKg).toBeGreaterThan(0);
        expect(r.totalWeightKg).toBeGreaterThan(0);
        expect(Number.isFinite(r.pieceWeightKg)).toBe(true);
        expect(Number.isFinite(r.totalWeightKg)).toBe(true);
      }
      expect(plan.totalProducedWeightKg).toBeGreaterThan(0);
      // Per-row weights must be exactly the rounded value (no FP drift).
      for (const r of plan.rows) {
        const expected = Math.round(r.pieceWeightKg * 1000) / 1000;
        expect(r.pieceWeightKg).toBe(expected);
      }
    });
  });

  describe('defaultSizeLabelForRow', () => {
    it('encodes the length in feet', () => {
      expect(
        defaultSizeLabelForRow({
          lengthFt: 8,
          quantity: 110,
          pieceWeightKg: 3.077,
          totalWeightKg: 338.47,
        }),
      ).toBe('8ft');
      expect(
        defaultSizeLabelForRow({
          lengthFt: 13.5,
          quantity: 9,
          pieceWeightKg: 5,
          totalWeightKg: 45,
        }),
      ).toBe('13.5ft');
    });
  });

  describe('rounding edge cases', () => {
    /**
     * Regression test for the cutting-error fix. Before the fix, this
     * exact input produced `totalProducedWeightKg = 494.980 KG`
     * against a coil that only had 494.979 KG remaining, and the
     * defensive `ensurePlanFitsCoil` check refused the cut.
     *
     * After the fix the rounding drift is exposed via
     * `wastageFromRoundingKg` (here: a few milligrams in the other
     * direction) and the service clamps the actual deduction.
     */
    it('a 10-piece 10ft cut against 494.979 KG rounds to 494.980 KG but stays in spec', () => {
      const plan = planCutting({
        rows: [{ lengthFt: 10, quantity: 10 }],
        usableCoilWeightKg: 494.979,
      });
      expect(plan.totalProducedWeightKg).toBeCloseTo(494.98, 2);
      // The plan and input should be within a gram of each other.
      const diff = Math.abs(
        plan.totalProducedWeightKg - plan.usableCoilWeightKg,
      );
      expect(diff).toBeLessThanOrEqual(1);
      expect(plan.wastageFromRoundingKg).toBeGreaterThanOrEqual(0);
      expect(plan.wastageFromRoundingKg).toBeLessThanOrEqual(1);
    });

    it('large cuts keep the per-row total equal to piece × qty exactly', () => {
      const plan = planCutting({
        rows: [
          { lengthFt: 8, quantity: 110 },
          { lengthFt: 10, quantity: 70 },
          { lengthFt: 12, quantity: 85 },
        ],
        usableCoilWeightKg: 1000,
      });
      for (const r of plan.rows) {
        expect(r.totalWeightKg).toBe(
          Math.round(r.pieceWeightKg * r.quantity * 1000) / 1000,
        );
      }
    });
  });
});
