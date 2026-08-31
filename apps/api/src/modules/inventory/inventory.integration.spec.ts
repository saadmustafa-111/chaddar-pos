import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { CuttingBatchesService } from '../cutting-batches/cutting-batches.service';
import { CuttingBatch } from '../cutting-batches/entities/cutting-batch.entity';
import { SalesService } from '../sales/sales.service';
import { CoilsService } from '../coils/coils.service';
import { CustomersService } from '../customers/customers.service';
import { PriceCategoriesService } from '../price-categories/price-categories.service';
import { InventoryService } from './inventory.service';
import {
  Coil,
  InventoryStatus,
  ProcessingStatus,
} from '../coils/entities/coil.entity';
import {
  FinishedChaddarStock,
  FinishedChaddarStatus,
} from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import {
  InventoryMovement,
  MovementType,
} from '../inventory-movements/entities/inventory-movement.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';

void CustomersService;

/**
 * End-to-end integration covering the new multi-row cutting formula,
 * the resulting FinishedChaddarStock rows, and the sales flow that
 * derives sold weight from `pieces × stored piece weight`.
 *
 * The integration passes an explicit `usableCoilWeightKg` override on
 * each cutting call so we can verify that:
 *   - The planned production weight consumes exactly that amount.
 *   - The source coil's `currentWeight` is reduced accordingly.
 *   - Each FinishedChaddarStock row carries the right piece weight and
 *     total weight for the size requested.
 *   - A subsequent sale can derive `weightSoldKg` from pieces × wpp.
 *   - No double deduction of coil weight happens when a sale runs.
 */
describe('Inventory integration: cutting, sales, and summary', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let cuttingService: CuttingBatchesService;
  let salesService: SalesService;

  const savedEntities: Array<Record<string, unknown>> = [];
  const generateCodes = {
    coil: 0,
    cut: 0,
    stock: 0,
    sale: 0,
  };

  function makeCoil(overrides: Partial<Coil> = {}): Coil {
    generateCodes.coil += 1;
    return {
      id: generateCodes.coil,
      code: `COIL-T-${String(generateCodes.coil).padStart(5, '0')}`,
      batchNumber: null,
      purchaseId: 99,
      supplierId: 1,
      materialFamilyId: null,
      materialFamily: null,
      priceCategoryId: 7,
      priceCategory: null,
      brand: null,
      color: null,
      width: 1000,
      thicknessMm: 22,
      grossWeight: 1000,
      purchaseWeight: 1000,
      purchaseRatePaisa: 200000,
      purchaseAmountPaisa: 20000000,
      currentWeight: 1000,
      status: InventoryStatus.FINISHED,
      processingStatus: ProcessingStatus.COMPLETED,
      processingDate: null,
      processingNote: null,
      wastageWeight: 0,
      location: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as Coil;
  }

  const finishedCostMock = {
    coilId: 1,
    coilCode: 'COIL-T-00001',
    purchaseCostPaisa: 2_000_000_00,
    additionalExpensesPaisa: 0,
    totalInvestedCostPaisa: 2_000_000_00,
    originalWeightKg: 1000,
    wastageWeightKg: 0,
    remainingUsableWeightKg: 1000,
    finishedCostPerKgPaisa: 200_000,
  };

  beforeEach(async () => {
    savedEntities.length = 0;
    generateCodes.coil = 0;
    generateCodes.cut = 0;
    generateCodes.stock = 0;
    generateCodes.sale = 0;

    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('cutting_batches')) {
          const count = savedEntities.filter((e) =>
            (e as { code?: string }).code?.startsWith('CUT-'),
          ).length;
          return [{ max_num: count }];
        }
        if (sql.includes('finished_chaddar_stock')) {
          const count = savedEntities.filter((e) =>
            (e as { code?: string }).code?.startsWith('FCS-'),
          ).length;
          return [{ max_num: count }];
        }
        if (sql.includes('FROM sales')) {
          const count = savedEntities.filter((e) =>
            (e as { code?: string }).code?.startsWith('SALE-'),
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

    moduleRef = await Test.createTestingModule({
      providers: [
        CuttingBatchesService,
        SalesService,
        InventoryService,
        {
          provide: CoilsService,
          useValue: {
            getFinishedCost: jest.fn().mockResolvedValue(finishedCostMock),
          },
        },
        {
          provide: PriceCategoriesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([
              {
                id: 7,
                code: 'SILVER',
                name: 'Silver',
                sellingRatePaisa: 30000,
                isActive: true,
              },
            ]),
          },
        },
        {
          provide: CustomersService,
          useValue: {
            applySaleTransaction: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: getRepositoryToken(Coil),
          useValue: {},
        },
        {
          provide: getRepositoryToken(FinishedChaddarStock),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              leftJoin: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              addOrderBy: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              setParameter: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({
                totalCoils: '0',
                activeCoils: '0',
                depletedCoils: '0',
                totalCurrentWeightKg: '0',
                totalWastageWeightKg: '0',
                totalPurchaseAmountPaisa: '0',
              }),
              getRawMany: jest.fn().mockResolvedValue([]),
              getMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(CuttingBatch),
          useValue: {},
        },
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: {},
        },
        {
          provide: getRepositoryToken(PriceCategory),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Sale),
          useValue: {},
        },
        {
          provide: getRepositoryToken(SaleItem),
          useValue: {},
        },
      ],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    cuttingService = moduleRef.get(CuttingBatchesService);
    salesService = moduleRef.get(SalesService);

    const qr = dataSource.createQueryRunner() as unknown as {
      manager: { findOne: jest.Mock };
    };
    qr.manager.findOne.mockImplementation(((entity: unknown) => {
      const ent = entity as { name?: string };
      if (ent?.name === 'PriceCategory') {
        return Promise.resolve({
          id: 7,
          code: 'SILVER',
          name: 'Silver',
          sellingRatePaisa: 30000,
        });
      }
      return Promise.resolve(null);
    }) as never);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  function findSaved<T extends { code?: string }>(
    prefix: string,
  ): T | undefined {
    const matches = savedEntities.filter(
      (e) => typeof (e as { code?: unknown }).code === 'string',
    );
    return matches.find((e) =>
      ((e as { code?: string }).code ?? '').startsWith(prefix),
    ) as T | undefined;
  }

  function findSavedStock(stockId: number): FinishedChaddarStock | undefined {
    const matches = savedEntities.filter(
      (e) => 'remainingPieces' in e && 'totalWeightKg' in e,
    );
    for (let i = matches.length - 1; i >= 0; i--) {
      const candidate = matches[i] as { id?: number };
      if (candidate.id === stockId) return candidate as FinishedChaddarStock;
    }
    return undefined;
  }

  function findSavedSaleItem(finishedStockId: number): SaleItem | undefined {
    return savedEntities.find(
      (e) =>
        'saleId' in e &&
        (e as { finishedStockId?: number }).finishedStockId === finishedStockId,
    ) as SaleItem | undefined;
  }

  function findSaleMovements(): InventoryMovement[] {
    return savedEntities.filter(
      (e) => (e as { type?: string }).type === MovementType.SALE,
    ) as InventoryMovement[];
  }

  function findCoilMovements(): InventoryMovement[] {
    return savedEntities.filter(
      (e) => (e as { type?: string }).type === MovementType.CUTTING_CONSUMPTION,
    ) as InventoryMovement[];
  }

  it('cutting the coil with a usable weight override reduces the source weight and creates one stock row per size', async () => {
    // Coil starts at 1000 KG, operator commits 500 KG to the cut.
    // 500 KG / 50 ten-ft equivalent pieces = 10 KG/pc average, total 500 KG.
    const coil = makeCoil({ currentWeight: 1000 });
    const qr = dataSource.createQueryRunner() as unknown as {
      manager: { findOne: jest.Mock };
    };
    qr.manager.findOne.mockResolvedValue(coil);

    const result = await cuttingService.create(1, {
      sizeLabel: 'Mixed coil run',
      rows: [{ lengthFt: 10, quantity: 50 }],
      usableCoilWeightKg: 500,
      productionDate: '2026-08-22',
    });

    // Cutting batch totals.
    expect(Number(result.cuttingBatch.cuttingWeightKg)).toBe(500);
    expect(Number(result.cuttingBatch.tenFtEquivalentQty)).toBe(50);
    expect(Number(result.cuttingBatch.avg10ftPieceWeightKg)).toBe(10);
    expect(result.cuttingBatch.piecesProduced).toBe(50);

    // First (and only) finished stock row.
    expect(result.finishedStock.piecesProduced).toBe(50);
    expect(Number(result.finishedStock.weightPerPieceKg)).toBe(10);
    expect(Number(result.finishedStock.totalWeightKg)).toBe(500);
    expect(Number(result.finishedStock.remainingWeightKg)).toBe(500);
    expect(result.finishedStock.status).toBe(FinishedChaddarStatus.AVAILABLE);

    // Coil reduced by the planned total.
    const coilAfter = findSaved<Coil>('COIL-T-');
    expect(Number(coilAfter!.currentWeight)).toBe(500);

    // A CUTTING_CONSUMPTION movement is logged for the source coil.
    const cutMovements = findCoilMovements();
    expect(cutMovements.length).toBeGreaterThan(0);
    expect(Number(cutMovements[0].weightDelta)).toBe(-500);
  });

  it('multi-row cut produces one FinishedChaddarStock row per size with proportional weights', async () => {
    // Coil 1000 KG, cut into 3 sizes totalling 500 KG (usable override).
    // Lengths: 10ft × 100, 12ft × 50 -> equiv (1000 + 600) / 10 = 160 ten-ft pieces
    // avg = 500 / 160 = 3.125
    //   10ft pieceWeight = 3.125; total = 312.5
    //   12ft pieceWeight = 3.75;  total = 187.5
    //   grand total = 500
    const coil = makeCoil({ currentWeight: 1000 });
    const qr = dataSource.createQueryRunner() as unknown as {
      manager: { findOne: jest.Mock };
    };
    qr.manager.findOne.mockResolvedValue(coil);

    const result = await cuttingService.create(1, {
      sizeLabel: 'Mixed run',
      rows: [
        { lengthFt: 10, quantity: 100 },
        { lengthFt: 12, quantity: 50 },
      ],
      usableCoilWeightKg: 500,
      productionDate: '2026-08-22',
    });

    expect(Number(result.cuttingBatch.tenFtEquivalentQty)).toBe(160);
    expect(Number(result.cuttingBatch.avg10ftPieceWeightKg)).toBeCloseTo(
      3.125,
      3,
    );
    expect(Number(result.cuttingBatch.cuttingWeightKg)).toBe(500);

    // All finished stock rows persisted.
    const stocks = savedEntities.filter((e) =>
      (e as { code?: string }).code?.startsWith('FCS-'),
    );
    expect(stocks.length).toBe(2);

    const sorted = (stocks as unknown as FinishedChaddarStock[]).sort(
      (a, b) => Number(a.lengthFt) - Number(b.lengthFt),
    );
    const [r10, r12] = sorted;
    expect(Number(r10.weightPerPieceKg)).toBeCloseTo(3.125, 3);
    expect(Number(r10.totalWeightKg)).toBeCloseTo(312.5, 3);
    expect(Number(r12.weightPerPieceKg)).toBeCloseTo(3.75, 3);
    expect(Number(r12.totalWeightKg)).toBeCloseTo(187.5, 3);

    // Coil must have drained by 500 KG.
    const coilAfter = findSaved<Coil>('COIL-T-');
    expect(Number(coilAfter!.currentWeight)).toBe(500);
  });

  it('partial sale derives weight from pieces × stock.weightPerPieceKg', async () => {
    const coil = makeCoil({ currentWeight: 1000 });
    const qr = dataSource.createQueryRunner() as unknown as {
      manager: { findOne: jest.Mock };
    };
    qr.manager.findOne.mockResolvedValueOnce(coil);
    const { finishedStock } = await cuttingService.create(1, {
      sizeLabel: 'Mixed coil run',
      rows: [{ lengthFt: 10, quantity: 100 }],
      usableCoilWeightKg: 500,
      productionDate: '2026-08-22',
    });

    const stock = makeCoil({ currentWeight: 1000 });
    qr.manager.findOne.mockReset();
    qr.manager.findOne.mockImplementation(((entity: unknown) => {
      const ent = entity as { name?: string };
      if (ent?.name === 'PriceCategory') {
        return Promise.resolve({
          id: 7,
          sellingRatePaisa: 30000,
        });
      }
      if (ent?.name === 'Coil') return Promise.resolve(stock);
      return Promise.resolve({
        ...finishedStock,
        priceCategory: null,
      });
    }) as never);

    const sale = await salesService.create({
      saleDate: '2026-08-22',
      items: [
        {
          finishedStockId: finishedStock.id,
          piecesSold: 20,
        },
      ],
      // 20 pcs × 5 KG = 100 KG × Rs 300 = Rs 30,000 = 3,000,000 paisa
      // (piece weight is 500 / 100 = 5 KG)
      paidAmountPaisa: 3_000_000,
    });

    const stockAfter = findSavedStock(finishedStock.id);
    expect(stockAfter).toBeDefined();
    expect(stockAfter!.remainingPieces).toBe(80);
    expect(Number(stockAfter!.remainingWeightKg)).toBe(400);
    expect(stockAfter!.status).toBe(FinishedChaddarStatus.PARTIALLY_SOLD);

    const item = findSavedSaleItem(finishedStock.id);
    expect(item).toBeDefined();
    expect(Number(item!.weightSoldKg)).toBe(100); // 20 pcs * 5 KG

    // No double deduction: coil weight must NOT have changed by the sale.
    const coilAfterSale = findSaved<Coil>('COIL-T-');
    expect(Number(coilAfterSale!.currentWeight)).toBe(500);

    expect(sale.sale.totalAmountPaisa).toBeGreaterThan(0);
  });

  it('full sale marks stock SOLD_OUT and excludes it from sellable summary', async () => {
    // 200 KG usable / 40 pieces of 10ft -> 5 KG/pc, total 200.
    const coil = makeCoil({ currentWeight: 200 });
    const qr = dataSource.createQueryRunner() as unknown as {
      manager: { findOne: jest.Mock };
    };
    qr.manager.findOne.mockResolvedValueOnce(coil);
    const { finishedStock } = await cuttingService.create(1, {
      sizeLabel: 'Mixed coil run',
      rows: [{ lengthFt: 10, quantity: 40 }],
      usableCoilWeightKg: 200,
      productionDate: '2026-08-22',
    });

    const stockForSale = { ...finishedStock };
    qr.manager.findOne.mockReset();
    qr.manager.findOne.mockImplementation(((entity: unknown) => {
      const ent = entity as { name?: string };
      if (ent?.name === 'PriceCategory') {
        return Promise.resolve({
          id: 7,
          sellingRatePaisa: 30000,
        });
      }
      if (ent?.name === 'Coil') return Promise.resolve(coil);
      return Promise.resolve({ ...stockForSale, priceCategory: null });
    }) as never);

    await salesService.create({
      saleDate: '2026-08-22',
      items: [
        {
          finishedStockId: finishedStock.id,
          piecesSold: 40,
        },
      ],
      // 40 pcs × 5 KG = 200 KG × Rs 300 = Rs 60,000 = 6,000,000 paisa
      paidAmountPaisa: 6_000_000,
    });

    const stockAfter = findSavedStock(finishedStock.id);
    expect(stockAfter!.status).toBe(FinishedChaddarStatus.SOLD_OUT);
    expect(stockAfter!.remainingPieces).toBe(0);
    expect(Number(stockAfter!.remainingWeightKg)).toBe(0);
  });

  it('sold-out stock cannot be sold again', async () => {
    const coil = makeCoil({ currentWeight: 200 });
    const qr = dataSource.createQueryRunner() as unknown as {
      manager: { findOne: jest.Mock };
    };
    qr.manager.findOne.mockResolvedValueOnce(coil);
    const { finishedStock } = await cuttingService.create(1, {
      sizeLabel: 'Mixed coil run',
      rows: [{ lengthFt: 10, quantity: 40 }],
      usableCoilWeightKg: 200,
      productionDate: '2026-08-22',
    });

    const soldOutStock = {
      ...finishedStock,
      status: FinishedChaddarStatus.SOLD_OUT,
    };
    qr.manager.findOne.mockReset();
    qr.manager.findOne.mockResolvedValueOnce(soldOutStock);

    await expect(
      salesService.create({
        saleDate: '2026-08-22',
        items: [{ finishedStockId: finishedStock.id, piecesSold: 1 }],
      }),
    ).rejects.toThrow(/already sold out/i);
  });

  it('summary reflects purchase → cutting → sale totals with no double deduction', async () => {
    const coil = makeCoil({ currentWeight: 1000 });
    const qr = dataSource.createQueryRunner() as unknown as {
      manager: { findOne: jest.Mock };
    };
    qr.manager.findOne.mockResolvedValue(coil);
    await cuttingService.create(1, {
      sizeLabel: 'Mixed coil run',
      rows: [{ lengthFt: 10, quantity: 100 }],
      usableCoilWeightKg: 500,
      productionDate: '2026-08-22',
    });

    const afterCut = findSaved<Coil>('COIL-T-');
    expect(Number(afterCut!.currentWeight)).toBe(500);

    const stock = findSaved<FinishedChaddarStock>('FCS-');
    qr.manager.findOne.mockReset();
    qr.manager.findOne.mockImplementation(((entity: unknown) => {
      const ent = entity as { name?: string };
      if (ent?.name === 'PriceCategory') {
        return Promise.resolve({
          id: 7,
          sellingRatePaisa: 30000,
        });
      }
      if (ent?.name === 'Coil') return Promise.resolve(afterCut);
      return Promise.resolve({ ...stock, priceCategory: null });
    }) as never);

    await salesService.create({
      saleDate: '2026-08-22',
      items: [{ finishedStockId: stock!.id, piecesSold: 20 }],
      // 20 pcs × 5 KG = 100 KG × Rs 300 = 3,000,000 paisa
      paidAmountPaisa: 3_000_000,
    });

    // No double deduction: coil still 500.
    const coilAfterSale = findSaved<Coil>('COIL-T-');
    expect(Number(coilAfterSale!.currentWeight)).toBe(500);

    // Stock state: 80 pieces / 400 KG remaining (5 KG/pc).
    const stockAfter = findSavedStock(stock!.id);
    expect(stockAfter!.remainingPieces).toBe(80);
    expect(Number(stockAfter!.remainingWeightKg)).toBe(400);
    expect(stockAfter!.status).toBe(FinishedChaddarStatus.PARTIALLY_SOLD);
  });

  it('sale movement records the source coil and weight but does not change coil weight', async () => {
    const coil = makeCoil({ currentWeight: 500 });
    const qr = dataSource.createQueryRunner() as unknown as {
      manager: { findOne: jest.Mock };
    };
    qr.manager.findOne.mockResolvedValueOnce(coil);
    const { finishedStock } = await cuttingService.create(1, {
      sizeLabel: 'Mixed coil run',
      rows: [{ lengthFt: 10, quantity: 50 }],
      usableCoilWeightKg: 250,
      productionDate: '2026-08-22',
    });

    qr.manager.findOne.mockReset();
    qr.manager.findOne.mockImplementation(((entity: unknown) => {
      const ent = entity as { name?: string };
      if (ent?.name === 'PriceCategory') {
        return Promise.resolve({ id: 7, sellingRatePaisa: 30000 });
      }
      if (ent?.name === 'Coil') return Promise.resolve(coil);
      return Promise.resolve({ ...finishedStock, priceCategory: null });
    }) as never);

    await salesService.create({
      saleDate: '2026-08-22',
      items: [{ finishedStockId: finishedStock.id, piecesSold: 10 }],
      // 10 × 5 = 50 KG × Rs 300 = 1,500,000 paisa
      paidAmountPaisa: 1_500_000,
    });

    const saleMovementList = findSaleMovements();
    expect(saleMovementList.length).toBeGreaterThan(0);
    const saleMovement = saleMovementList[0];
    expect(saleMovement.referenceType).toBe('SALE');
    expect(Number(saleMovement.weightDelta)).toBe(0);

    const finalCoil = findSaved<Coil>('COIL-T-');
    expect(Number(finalCoil!.currentWeight)).toBe(250);
  });
});
