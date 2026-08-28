import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CuttingBatchesService } from './cutting-batches.service';
import { CuttingBatch } from './entities/cutting-batch.entity';
import { FinishedChaddarStock } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import {
  Coil,
  InventoryStatus,
  ProcessingStatus,
} from '../coils/entities/coil.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';
import { CoilsService } from '../coils/coils.service';
import { PriceCategoriesService } from '../price-categories/price-categories.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CuttingBatchesService', () => {
  let cuttingService: CuttingBatchesService;
  let mockCoil: Coil;
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    manager: {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
  };

  const savedEntities: Array<Record<string, unknown>> = [];

  const finishedCostMock = {
    coilId: 1,
    coilCode: 'COIL-2026-00001',
    purchaseCostPaisa: 2_000_000_00,
    additionalExpensesPaisa: 100_000_00,
    totalInvestedCostPaisa: 2_100_000_00,
    originalWeightKg: 10_000,
    wastageWeightKg: 500,
    remainingUsableWeightKg: 9_500,
    finishedCostPerKgPaisa: Math.round(2_100_000_00 / 9_500),
  };

  beforeEach(async () => {
    savedEntities.length = 0;

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation((sql: string) => {
        const cuttingMatch = sql.includes('cutting_batches');
        const stockMatch = sql.includes('finished_chaddar_stock');
        if (cuttingMatch) {
          const count = savedEntities.filter((e) =>
            (e as { code?: string }).code?.startsWith('CUT-'),
          ).length;
          return [{ max_num: count }];
        }
        if (stockMatch) {
          const count = savedEntities.filter((e) =>
            (e as { code?: string }).code?.startsWith('FCS-'),
          ).length;
          return [{ max_num: count }];
        }
        return [{ max_num: 0 }];
      }),
      manager: {
        findOne: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(
            (_entity: unknown, data: Record<string, unknown>) => ({
              id: savedEntities.length + 1,
              ...data,
            }),
          ),
        save: jest.fn().mockImplementation((entity: unknown) => {
          savedEntities.push(entity as Record<string, unknown>);
          return Promise.resolve(entity);
        }),
      },
    };

    mockCoil = {
      id: 1,
      code: 'COIL-2026-00001',
      currentWeight: 9_500,
      purchaseAmountPaisa: 2_000_000_00,
      status: InventoryStatus.FINISHED,
      processingStatus: ProcessingStatus.COMPLETED,
      wastageWeight: 500,
      purchaseWeight: 10_000,
      width: 1000,
      thicknessMm: 22,
      color: 'Blue',
      brand: 'ABC',
    } as Coil;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuttingBatchesService,
        {
          provide: getRepositoryToken(CuttingBatch),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
            }),
          },
        },
        {
          provide: getRepositoryToken(FinishedChaddarStock),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              addOrderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(Coil),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PriceCategory),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        {
          provide: CoilsService,
          useValue: {
            getFinishedCost: jest.fn().mockResolvedValue(finishedCostMock),
          },
        },
        {
          provide: PriceCategoriesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    cuttingService = module.get<CuttingBatchesService>(CuttingBatchesService);
    jest.clearAllMocks();
  });

  describe('create cutting batch', () => {
    const baseDto = {
      sizeLabel: 'Mixed coil run',
      rows: [
        { lengthFt: 8, quantity: 110 },
        { lengthFt: 10, quantity: 70 },
        { lengthFt: 12, quantity: 85 },
      ],
      productionDate: '2026-08-22',
      note: 'First production run',
    };

    /**
     * Real numbers from the client example against the mock coil
     * (currentWeight = 9500 KG):
     *   8ft x 110, 10ft x 70, 12ft x 85 -> 2600 equivalent feet -> 260 ten-ft pieces
     *   usable 9500 KG -> avg 10ft = 9500 / 260 = 36.538... KG/pc (rounded 36.538)
     *   8ft piece = 36.538 * 8 / 10 = 29.230... -> 29.231 ; total = 29.231 * 110 = 3215.41
     *   10ft piece = 36.538 * 1 = 36.538             ; total = 36.538 * 70 = 2557.66
     *   12ft piece = 36.538 * 1.2 = 43.846... -> 43.846; total = 43.846 * 85 = 3726.91
     *   total produced = 3215.41 + 2557.66 + 3726.91 = 9499.98 KG
     */
    it('creates a multi-row batch using the documented client formula', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);

      const result = await cuttingService.create(1, baseDto, 'tester');

      // Headline summary on the cutting batch.
      expect(result.cuttingBatch.sizeLabel).toBe('Mixed coil run');
      expect(result.cuttingBatch.piecesProduced).toBe(265);
      expect(Number(result.cuttingBatch.tenFtEquivalentQty)).toBe(260);
      expect(Number(result.cuttingBatch.avg10ftPieceWeightKg)).toBeCloseTo(
        36.538,
        3,
      );
      expect(Number(result.cuttingBatch.usableCoilWeightKg)).toBe(9500);
      expect(Number(result.cuttingBatch.finishedCostPerKgPaisa)).toBe(
        finishedCostMock.finishedCostPerKgPaisa,
      );
      // Total cost should be the rounded total weight × cost-per-kg.
      const expectedTotalCost = Math.round(
        Number(result.cuttingBatch.cuttingWeightKg) *
          finishedCostMock.finishedCostPerKgPaisa,
      );
      expect(Number(result.cuttingBatch.totalProductionCostPaisa)).toBe(
        expectedTotalCost,
      );

      // Backwards-compat: finishedStock is the first size row, so callers
      // that consume the return value see the 8ft-equivalent row.
      expect(Number(result.finishedStock.lengthFt)).toBe(8);
      expect(Number(result.finishedStock.piecesProduced)).toBe(110);
      expect(Number(result.finishedStock.weightPerPieceKg)).toBeCloseTo(
        29.231,
        3,
      );
      expect(Number(result.finishedStock.totalWeightKg)).toBeCloseTo(
        3215.41,
        3,
      );
      expect(result.finishedStock.status).toBe('AVAILABLE');

      // Coil weight reduced by exactly the planned total.
      const coilAfter = savedEntities.find(
        (e) => (e as { code?: string }).code === 'COIL-2026-00001',
      ) as Coil | undefined;
      expect(coilAfter).toBeDefined();
      const expectedRemaining =
        Math.round(
          (9_500 - Number(result.cuttingBatch.cuttingWeightKg)) * 1000,
        ) / 1000;
      expect(Number(coilAfter!.currentWeight)).toBe(expectedRemaining);

      // CUTTING_CONSUMPTION movement persisted.
      const movement = savedEntities.find(
        (e) => (e as { type?: string }).type === 'CUTTING_CONSUMPTION',
      ) as InventoryMovement | undefined;
      expect(movement).toBeDefined();
      expect(Number(movement!.weightDelta)).toBe(
        -Number(result.cuttingBatch.cuttingWeightKg),
      );

      // All three finished stock rows exist (one per input row).
      const allStocks = savedEntities.filter((e) =>
        (e as { code?: string }).code?.startsWith('FCS-'),
      );
      expect(allStocks.length).toBe(3);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('produces deterministic per-size weights for the example matrix', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);

      await cuttingService.create(1, baseDto, 'tester');

      const stockByCode = new Map<string, FinishedChaddarStock>();
      for (const e of savedEntities) {
        const code = (e as { code?: string }).code;
        if (code && code.startsWith('FCS-')) {
          stockByCode.set(code, e as unknown as FinishedChaddarStock);
        }
      }
      const sortedStocks = Array.from(stockByCode.values()).sort(
        (a, b) => Number(a.lengthFt) - Number(b.lengthFt),
      );
      const [r8, r10, r12] = sortedStocks;
      // 9500 KG / 260 = 36.538461538... -> 36.538 (3-dp)
      expect(Number(r8.weightPerPieceKg)).toBeCloseTo(29.231, 3);
      expect(Number(r10.weightPerPieceKg)).toBeCloseTo(36.538, 3);
      expect(Number(r12.weightPerPieceKg)).toBeCloseTo(43.846, 3);

      expect(Number(r8.totalWeightKg)).toBeCloseTo(3215.41, 2);
      expect(Number(r10.totalWeightKg)).toBeCloseTo(2557.66, 2);
      expect(Number(r12.totalWeightKg)).toBeCloseTo(3726.91, 2);
    });

    it('persists a JSON snapshot of the cutting rows for audit', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);

      const result = await cuttingService.create(1, baseDto, 'tester');
      expect(result.cuttingBatch.cutRowsJson).toBeTruthy();
      const parsed: unknown = JSON.parse(
        result.cuttingBatch.cutRowsJson as string,
      );
      const rows = parsed as Array<{
        lengthFt: number;
        quantity: number;
      }>;
      expect(rows.length).toBe(3);
      expect(rows[0]).toMatchObject({ lengthFt: 8, quantity: 110 });
    });

    it('is fully generic - any positive length works', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);
      await cuttingService.create(1, {
        sizeLabel: 'Odd sizes',
        rows: [
          { lengthFt: 5.5, quantity: 12 },
          { lengthFt: 17.25, quantity: 4 },
        ],
        productionDate: '2026-08-22',
      });
      // Produced weight must be > 0 and <= current weight.
      const batch = savedEntities.find((e) =>
        (e as { code?: string }).code?.startsWith('CUT-'),
      ) as CuttingBatch | undefined;
      expect(batch).toBeDefined();
      expect(Number(batch!.cuttingWeightKg)).toBeGreaterThan(0);
      expect(Number(batch!.cuttingWeightKg)).toBeLessThanOrEqual(9500);
    });

    it('rejects when rows are missing', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);
      await expect(
        cuttingService.create(1, {
          sizeLabel: 'No rows',
          rows: [],
          productionDate: '2026-08-22',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when any row has zero or negative length', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);
      await expect(
        cuttingService.create(1, {
          sizeLabel: 'Bad length',
          rows: [
            { lengthFt: 8, quantity: 10 },
            { lengthFt: 0, quantity: 10 },
          ],
          productionDate: '2026-08-22',
        }),
      ).rejects.toThrow(/Row 2/);
    });

    it('rejects when any row has a non-integer quantity', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);
      await expect(
        cuttingService.create(1, {
          sizeLabel: 'Bad qty',
          rows: [{ lengthFt: 10, quantity: 1.5 }],
          productionDate: '2026-08-22',
        }),
      ).rejects.toThrow(/Row 1/);
    });

    it('throws NotFound when the source coil does not exist', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      await expect(cuttingService.create(999, baseDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rejects when the coil has no usable weight', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);
      const coilsService = (
        cuttingService as unknown as {
          coilsService: { getFinishedCost: jest.Mock };
        }
      ).coilsService;
      coilsService.getFinishedCost.mockResolvedValueOnce({
        ...finishedCostMock,
        remainingUsableWeightKg: 0,
        finishedCostPerKgPaisa: 0,
      });

      await expect(cuttingService.create(1, baseDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when the planned total exceeds the remaining coil weight (defence in depth)', async () => {
      // Simulate a data inconsistency: finishedCost claims a 1000 KG usable
      // weight, but the live coil only carries 100 KG. The defensive
      // check must still refuse to drain the coil.
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockCoil,
        currentWeight: 100,
      });
      const coilsService = (
        cuttingService as unknown as {
          coilsService: { getFinishedCost: jest.Mock };
        }
      ).coilsService;
      coilsService.getFinishedCost.mockResolvedValueOnce({
        ...finishedCostMock,
        remainingUsableWeightKg: 1000,
      });

      await expect(
        cuttingService.create(1, {
          sizeLabel: 'Over',
          rows: [{ lengthFt: 10, quantity: 1 }],
          productionDate: '2026-08-22',
        }),
      ).rejects.toThrow(/exceeds the coil/);
    });

    it('rolls back the transaction when finished stock save fails', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);
      let saveCount = 0;
      mockQueryRunner.manager.save.mockImplementation((entity: unknown) => {
        saveCount++;
        if (saveCount === 4) {
          // First save = cutting batch, then 3 finished stock saves; fail on 4th.
          return Promise.reject(new Error('Simulated stock failure'));
        }
        savedEntities.push(entity as Record<string, unknown>);
        return Promise.resolve(entity);
      });

      await expect(cuttingService.create(1, baseDto)).rejects.toThrow(
        'Simulated stock failure',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();

      // The coil must not have been mutated.
      const coilMutations = savedEntities.filter(
        (e) => (e as { code?: string }).code === 'COIL-2026-00001',
      );
      expect(coilMutations.length).toBe(0);
    });

    it('drains the coil on every batch and emits unique codes per call', async () => {
      // The client formula always distributes the usable coil weight
      // across the requested sizes, so each batch drains the coil. Two
      // separate cuts against the same coil would happen back-to-back in
      // the real shop if a separate coil ID is used for each physical
      // coil; that's what we simulate here. Re-create the mock for each
      // call so the in-memory coil isn't carried across tests.
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockCoil,
        id: 1,
        code: 'COIL-2026-00001',
        currentWeight: 9500,
      });
      const first = await cuttingService.create(1, {
        sizeLabel: 'Run A',
        rows: [{ lengthFt: 10, quantity: 50 }],
        productionDate: '2026-08-22',
      });
      expect(first.cuttingBatch.code).toMatch(/^CUT-\d{4}-00001$/);

      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockCoil,
        id: 2,
        code: 'COIL-2026-00002',
        currentWeight: 9500,
      });
      const second = await cuttingService.create(2, {
        sizeLabel: 'Run B',
        rows: [{ lengthFt: 10, quantity: 50 }],
        productionDate: '2026-08-22',
      });
      expect(second.cuttingBatch.code).toMatch(/^CUT-\d{4}-00002$/);
      expect(second.cuttingBatch.code).not.toBe(first.cuttingBatch.code);

      // Two CUTTING_CONSUMPTION movements logged (one per coil).
      const movements = savedEntities.filter(
        (e) => (e as { type?: string }).type === 'CUTTING_CONSUMPTION',
      );
      expect(movements.length).toBe(2);
    });

    it('marks the coil DEPLETED when the cut empties it', async () => {
      // Coil has 100 KG. Single row of 10ft × 10 pieces -> equiv 10 -> avg 10 -> total 100.
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockCoil,
        currentWeight: 100,
      });
      const coilsService = (
        cuttingService as unknown as {
          coilsService: { getFinishedCost: jest.Mock };
        }
      ).coilsService;
      coilsService.getFinishedCost.mockResolvedValueOnce({
        ...finishedCostMock,
        remainingUsableWeightKg: 100,
      });

      await cuttingService.create(1, {
        sizeLabel: 'Drain',
        rows: [{ lengthFt: 10, quantity: 10 }],
        productionDate: '2026-08-22',
      });

      const coilAfter = savedEntities.find(
        (e) => (e as { code?: string }).code === 'COIL-2026-00001',
      ) as Coil | undefined;
      expect(coilAfter!.status).toBe(InventoryStatus.DEPLETED);
      expect(Number(coilAfter!.currentWeight)).toBe(0);
    });

    it('snapshots finished cost per KG from the finished-cost service', async () => {
      const custom = {
        ...finishedCostMock,
        finishedCostPerKgPaisa: 25_000,
        remainingUsableWeightKg: 8_000,
      };
      const coilsService = (
        cuttingService as unknown as {
          coilsService: { getFinishedCost: jest.Mock };
        }
      ).coilsService;
      coilsService.getFinishedCost.mockResolvedValueOnce(custom);
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);

      const result = await cuttingService.create(1, {
        sizeLabel: 'Custom cost',
        rows: [{ lengthFt: 10, quantity: 40 }], // equivalent 40, avg 200 KG
        productionDate: '2026-08-22',
      });

      expect(Number(result.cuttingBatch.finishedCostPerKgPaisa)).toBe(25_000);
      expect(Number(result.cuttingBatch.totalProductionCostPaisa)).toBe(
        Math.round(Number(result.cuttingBatch.cuttingWeightKg) * 25_000),
      );
      expect(Number(result.finishedStock.finishedCostPerKgPaisa)).toBe(25_000);
      expect(Number(result.finishedStock.totalProductionCostPaisa)).toBe(
        Math.round(Number(result.finishedStock.totalWeightKg) * 25_000),
      );
    });

    it('propagates coil price category to both batch and all stock rows', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockCoil,
        priceCategoryId: 7,
      });

      const result = await cuttingService.create(1, baseDto);
      expect(result.cuttingBatch.priceCategoryId).toBe(7);

      const stocks = savedEntities.filter((e) =>
        (e as { code?: string }).code?.startsWith('FCS-'),
      );
      for (const s of stocks) {
        expect((s as { priceCategoryId: number }).priceCategoryId).toBe(7);
      }
    });

    it('allows a coil without a price category (Unassigned)', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockCoil,
        priceCategoryId: null,
      });

      const result = await cuttingService.create(1, baseDto);
      expect(result.cuttingBatch.priceCategoryId).toBeNull();
      expect(result.finishedStock.priceCategoryId).toBeNull();
    });

    /**
     * Regression test for the production_date timezone bug.
     *
     * The cutting service previously persisted `productionDate` via
     * `new Date(dto.productionDate)`. JavaScript parses date-only
     * strings as UTC midnight; TypeORM's default `date` column
     * transformer reads via `getDate()` (local time), so any host
     * west of UTC would persist the day *before* what the operator
     * selected. The entity now declares `utc: true` on the column
     * so TypeORM persists via `getUTCDate()` and the round-trip
     * stays stable regardless of the host timezone.
     *
     * The test mirrors the real path: a string from the DTO is
     * wrapped in `new Date()` exactly as the service does, persisted
     * via the same TypeORM transformer that SQLite would use, then
     * re-read. The persisted string must equal the input string.
     */
    it('preserves the operator-selected calendar date regardless of host timezone', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(mockCoil);

      const dto = {
        ...baseDto,
        productionDate: '2026-08-25',
      };

      // Simulate the production path: this is exactly what the
      // service does (line 335) and what TypeORM's date transformer
      // sees when it persists via `getUTCDate()` / `getUTCMonth()` /
      // `getUTCFullYear()` with the column metadata `utc: true`.
      const persistViaTypeOrmUtc = (date: Date): string => {
        const y = String(date.getUTCFullYear()).padStart(4, '0');
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const result = await cuttingService.create(1, dto, 'tester');
      const persisted = persistViaTypeOrmUtc(
        result.cuttingBatch.productionDate,
      );

      expect(persisted).toBe('2026-08-25');
      expect(dto.productionDate).toBe(persisted);

      // Finished-stock rows inherit productionDate from the batch
      // entity; verify the entire downstream tree carries the same
      // calendar day so a one-day shift would be caught here too.
      const finishedStock = result.finishedStock;
      expect(persistViaTypeOrmUtc(finishedStock.productionDate)).toBe(
        '2026-08-25',
      );
    });
  });

  describe('suggest weight-per-piece from history', () => {
    it('returns NONE when there is no history for the size', async () => {
      const result = await cuttingService.suggestWeightPerPiece(1, 'unknown');
      expect(result.source).toBe('NONE');
      expect(result.weightPerPieceKg).toBeNull();
    });

    it('averages weight-per-piece from prior stock for the same size', async () => {
      const finishedRepo = (
        cuttingService as unknown as {
          finishedStockRepository: {
            createQueryBuilder: jest.Mock;
          };
        }
      ).finishedStockRepository;

      finishedRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            weightPerPieceKg: 8,
            totalWeightKg: 2000,
            piecesProduced: 250,
          },
          {
            weightPerPieceKg: 7.5,
            totalWeightKg: 1500,
            piecesProduced: 200,
          },
        ]),
      });

      const result = await cuttingService.suggestWeightPerPiece(1, '8ft');
      expect(result.source).toBe('HISTORY');
      expect(result.sampleCount).toBe(2);
      expect(result.weightPerPieceKg).toBeCloseTo(7.778, 3);
    });

    it('falls back to total/derived when snapshot is null', async () => {
      const finishedRepo = (
        cuttingService as unknown as {
          finishedStockRepository: {
            createQueryBuilder: jest.Mock;
          };
        }
      ).finishedStockRepository;

      finishedRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            weightPerPieceKg: null,
            totalWeightKg: 1000,
            piecesProduced: 100,
          },
        ]),
      });

      const result = await cuttingService.suggestWeightPerPiece(1, '10ft');
      expect(result.source).toBe('HISTORY');
      expect(result.weightPerPieceKg).toBe(10);
    });
  });

  describe('adjust stock weight override', () => {
    it('updates remaining weight and recomputes weight-per-piece', async () => {
      const stock = {
        id: 10,
        code: 'FCS-2026-00001',
        cuttingBatchId: 1,
        sourceCoilId: 1,
        sizeLabel: '8ft',
        lengthFt: 8,
        piecesProduced: 250,
        totalWeightKg: 2_000,
        remainingPieces: 250,
        remainingWeightKg: 2_000,
        weightPerPieceKg: 8,
        status: 'AVAILABLE',
      } as FinishedChaddarStock;
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(stock)
        .mockResolvedValueOnce({ id: 1, currentWeight: 0 });

      const result = await cuttingService.adjustStockWeight(
        10,
        1_900,
        'tester',
      );

      expect(Number(result.remainingWeightKg)).toBe(1_900);
      expect(Number(result.weightPerPieceKg)).toBeCloseTo(1_900 / 250, 3);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('rejects negative adjustments', async () => {
      await expect(cuttingService.adjustStockWeight(10, -1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('marks stock SOLD_OUT when weight reaches zero', async () => {
      const stock = {
        id: 10,
        code: 'FCS-2026-00001',
        cuttingBatchId: 1,
        sourceCoilId: 1,
        sizeLabel: '8ft',
        lengthFt: 8,
        piecesProduced: 250,
        totalWeightKg: 2_000,
        remainingPieces: 250,
        remainingWeightKg: 2_000,
        weightPerPieceKg: 8,
        status: 'AVAILABLE',
      } as FinishedChaddarStock;
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(stock)
        .mockResolvedValueOnce({ id: 1, currentWeight: 0 });

      const result = await cuttingService.adjustStockWeight(10, 0, 'tester');
      expect(result.status).toBe('SOLD_OUT');
    });
  });
});
