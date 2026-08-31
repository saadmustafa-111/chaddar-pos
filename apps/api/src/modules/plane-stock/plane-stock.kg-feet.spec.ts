import {
  CoilSpecForFeet,
  CoilHistoryRow,
  coilKgPerFoot,
  kgToFeet,
  ROUND_KG,
  STEEL_DENSITY_G_PER_CM3,
} from '../cutting-batches/calculation';

describe('coil KG -> Feet helpers', () => {
  describe('STEEL_DENSITY_G_PER_CM3', () => {
    it('is the documented value', () => {
      expect(STEEL_DENSITY_G_PER_CM3).toBe(7.85);
    });
  });

  describe('coilKgPerFoot', () => {
    it('returns null when no spec and no history are available', () => {
      expect(
        coilKgPerFoot({ widthMm: null, thicknessMm: null }, []),
      ).toBeNull();
    });

    it('returns null when history rows are present but all malformed', () => {
      const history: CoilHistoryRow[] = [
        { weightPerPieceKg: null, lengthFt: null },
        { weightPerPieceKg: 0, lengthFt: 10 },
        { weightPerPieceKg: 5, lengthFt: null },
      ];
      expect(
        coilKgPerFoot({ widthMm: null, thicknessMm: null }, history),
      ).toBeNull();
    });

    it('uses the most recent historical row when present', () => {
      const spec: CoilSpecForFeet = { widthMm: 914, thicknessMm: 0.25 };
      const history: CoilHistoryRow[] = [
        // Newest first (descending).
        { weightPerPieceKg: 50, lengthFt: 10 },
        { weightPerPieceKg: 12, lengthFt: 8 },
      ];
      // 50 KG / 10 ft = 5 KG/ft.
      expect(coilKgPerFoot(spec, history)).toBe(5);
    });

    it('falls back to a theoretical calculation from width and thickness', () => {
      // 914 mm wide, 0.25 mm thick, density 7.85 g/cm^3 -> kg/foot.
      const spec: CoilSpecForFeet = { widthMm: 914, thicknessMm: 0.25 };
      const expected = ROUND_KG(
        ((91.4 * 0.025) / 1000) * STEEL_DENSITY_G_PER_CM3 * 30.48,
      );
      expect(coilKgPerFoot(spec, [])).toBeCloseTo(expected, 3);
    });

    it('matches the documented client example for a typical chaddar', () => {
      // Example: 30 KG should be ~61.4 ft -> kgPerFoot ≈ 30/61.4 = 0.4886
      // Theoretical width/thickness that produces ~0.4886 kg/ft:
      //   width = 1000 mm, thickness = 0.2 mm.
      const spec: CoilSpecForFeet = { widthMm: 1000, thicknessMm: 0.2 };
      const kgPerFoot = coilKgPerFoot(spec, []);
      expect(kgPerFoot).not.toBeNull();
      // Just sanity-check it's in the right order of magnitude.
      expect(kgPerFoot!).toBeGreaterThan(0.4);
      expect(kgPerFoot!).toBeLessThan(0.6);
    });
  });

  describe('kgToFeet', () => {
    it('returns null for non-positive weight', () => {
      expect(kgToFeet({ widthMm: 914, thicknessMm: 0.25 }, [], 0)).toBeNull();
      expect(kgToFeet({ widthMm: 914, thicknessMm: 0.25 }, [], -1)).toBeNull();
    });

    it('returns null when no spec can yield a kg/foot', () => {
      expect(kgToFeet({ widthMm: null, thicknessMm: null }, [], 30)).toBeNull();
    });

    it('derives the documented 30 KG -> ~61.4 ft example for a typical chaddar', () => {
      const spec: CoilSpecForFeet = { widthMm: 1000, thicknessMm: 0.2 };
      const feet = kgToFeet(spec, [], 30);
      expect(feet).not.toBeNull();
      expect(feet!).toBeGreaterThan(50);
      expect(feet!).toBeLessThan(70);
    });
  });
});
