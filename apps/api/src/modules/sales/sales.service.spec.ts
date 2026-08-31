import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { Sale, SaleStatus } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import {
  FinishedChaddarStock,
  FinishedChaddarStatus,
} from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { PriceCategory } from '../price-categories/entities/price-category.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';

void CustomersService;

describe('SalesService', () => {
  let salesService: SalesService;
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
  let applySaleTransactionMock: jest.Mock;

  function buildStock(overrides: Partial<FinishedChaddarStock> = {}) {
    return {
      id: 10,
      code: 'FCS-2026-00001',
      cuttingBatchId: 100,
      sourceCoilId: 1,
      sizeLabel: '4x8',
      widthMm: 1000,
      thicknessMm: 22,
      color: 'Blue',
      brand: 'ABC',
      piecesProduced: 250,
      totalWeightKg: 2_000,
      remainingPieces: 250,
      remainingWeightKg: 2_000,
      weightPerPieceKg: 8,
      finishedCostPerKgPaisa: 22_105,
      totalProductionCostPaisa: 4_421_000,
      status: FinishedChaddarStatus.AVAILABLE,
      productionDate: new Date('2026-08-20'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as FinishedChaddarStock;
  }

  function buildCoil() {
    return { id: 1, currentWeight: 7_500 };
  }

  beforeEach(async () => {
    savedEntities.length = 0;
    applySaleTransactionMock = jest
      .fn()
      .mockResolvedValue({ balanceAfterPaisa: 0 });

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM sales')) {
          const count = savedEntities.filter((e) =>
            (e as { code?: string }).code?.startsWith('SALE-'),
          ).length;
          return Promise.resolve([{ max_num: count }]);
        }
        return Promise.resolve([{ max_num: 0 }]);
      }),
      manager: {
        findOne: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(
            (_entity: unknown, data: Record<string, unknown>) => ({
              id: savedEntities.length + 1,
              createdAt: new Date(),
              ...data,
            }),
          ),
        save: jest.fn().mockImplementation((entity: unknown) => {
          savedEntities.push(entity as Record<string, unknown>);
          return Promise.resolve(entity);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: getRepositoryToken(Sale),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SaleItem),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
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
          provide: CustomersService,
          useValue: {
            applySaleTransaction: (
              ...args: unknown[]
            ): Promise<{ balanceAfterPaisa: number }> =>
              applySaleTransactionMock(...args) as Promise<{
                balanceAfterPaisa: number;
              }>,
          },
        },
      ],
    }).compile();

    salesService = module.get<SalesService>(SalesService);
    jest.clearAllMocks();
  });

  describe('create sale (cash)', () => {
    const cashItem = {
      finishedStockId: 10,
      piecesSold: 50,
      weightSoldKg: 400,
      sellingRatePaisa: 30_000,
    };
    const baseCashDto = {
      saleDate: '2026-08-22',
      note: 'Walk-in customer',
      items: [cashItem],
    };

    it('should reject when items array is empty', async () => {
      await expect(
        salesService.create({ ...baseCashDto, items: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFound when finished stock does not exist', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      await expect(salesService.create(baseCashDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should reject overselling by pieces', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      await expect(
        salesService.create({
          ...baseCashDto,
          items: [{ ...cashItem, piecesSold: 300, weightSoldKg: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overselling by weight', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      await expect(
        salesService.create({
          ...baseCashDto,
          items: [{ ...cashItem, piecesSold: 10, weightSoldKg: 5_000 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject selling from a SOLD_OUT stock', async () => {
      const stock = buildStock({ status: FinishedChaddarStatus.SOLD_OUT });
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      await expect(salesService.create(baseCashDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject zero or negative pieces', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      await expect(
        salesService.create({
          ...baseCashDto,
          items: [{ ...cashItem, piecesSold: 0 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should auto-derive sold weight from pieces × weight-per-piece', async () => {
      // Stock with 8 KG per piece.
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        ...stock,
        priceCategory: null,
      });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      // 20 pcs * 8 KG = 160 KG. Cash sale @ Rs 300 / KG -> Rs 48,000
      const item = {
        finishedStockId: 10,
        piecesSold: 20,
        sellingRatePaisa: 30_000,
      };
      const total = 160 * 30_000;
      const result = await salesService.create({
        saleDate: '2026-08-22',
        items: [item],
        paidAmountPaisa: total,
      });

      expect(Number(result.items[0].weightSoldKg)).toBe(160);
      expect(Number(result.items[0].lineRevenuePaisa)).toBe(total);
      expect(Number(result.sale.totalAmountPaisa)).toBe(total);
    });

    it('should default selling rate to the stock price-category rate when omitted', async () => {
      const stock = buildStock({
        weightPerPieceKg: 8,
        priceCategoryId: 1,
      });
      // Sequence of findOne calls: 1) stock (with relations), 2) price category, 3) coil
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        ...stock,
        priceCategory: null,
      });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 1,
        code: 'SILVER',
        sellingRatePaisa: 28_000,
      });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      const item = {
        finishedStockId: 10,
        piecesSold: 20,
        // no sellingRatePaisa, no weightSoldKg
      };
      const expectedWeight = 160; // 20 * 8
      const expectedRevenue = expectedWeight * 28_000;
      const result = await salesService.create({
        saleDate: '2026-08-22',
        items: [item],
        paidAmountPaisa: expectedRevenue,
      });

      expect(Number(result.items[0].weightSoldKg)).toBe(expectedWeight);
      expect(Number(result.items[0].sellingRatePaisa)).toBe(28_000);
      expect(Number(result.items[0].lineRevenuePaisa)).toBe(expectedRevenue);
    });

    it('should respect operator-overridden weight and rate', async () => {
      const stock = buildStock({ weightPerPieceKg: 8 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        ...stock,
        priceCategory: null,
      });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      const item = {
        finishedStockId: 10,
        piecesSold: 20,
        weightSoldKg: 200, // override
        sellingRatePaisa: 35_000,
      };
      const total = 200 * 35_000;
      const result = await salesService.create({
        saleDate: '2026-08-22',
        items: [item],
        paidAmountPaisa: total,
      });

      expect(Number(result.items[0].weightSoldKg)).toBe(200);
      expect(Number(result.items[0].sellingRatePaisa)).toBe(35_000);
      expect(Number(result.items[0].lineRevenuePaisa)).toBe(total);
    });

    it('should reject when weight cannot be derived and is not provided', async () => {
      const stock = buildStock({
        weightPerPieceKg: null,
        piecesProduced: 0,
      });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        ...stock,
        priceCategory: null,
      });

      const item = {
        finishedStockId: 10,
        piecesSold: 5,
        // no weight, no wpp available
      };
      await expect(
        salesService.create({
          saleDate: '2026-08-22',
          items: [item],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should never mutate the historical sale item rate snapshot', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      const total = 400 * 30_000;
      const result = await salesService.create({
        ...baseCashDto,
        paidAmountPaisa: total,
      });
      const snapshottedRate = Number(result.items[0].sellingRatePaisa);
      const snapshottedWeight = Number(result.items[0].weightSoldKg);

      // Simulate the price category being changed later.
      const stockAfter = savedEntities.find(
        (e) => (e as { code?: string }).code === 'FCS-2026-00001',
      ) as { weightPerPieceKg: number | null } | undefined;
      if (stockAfter) stockAfter.weightPerPieceKg = 99.999;

      expect(snapshottedRate).toBe(30_000);
      expect(snapshottedWeight).toBe(400);
    });

    it('should reject zero or negative weight', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValue(stock);
      await expect(
        salesService.create({
          ...baseCashDto,
          items: [{ ...cashItem, weightSoldKg: 0 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a cash sale: fully paid, no customer, no ledger', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      const totalRevenue = 400 * 30_000;
      const result = await salesService.create(
        { ...baseCashDto, paidAmountPaisa: totalRevenue },
        'tester',
      );

      expect(result.sale.code).toMatch(/^SALE-\d{4}-00001$/);
      expect(result.sale.status).toBe(SaleStatus.COMPLETED);
      expect(result.sale.customerId).toBeNull();
      expect(Number(result.sale.totalAmountPaisa)).toBe(totalRevenue);
      expect(Number(result.sale.paidAmountPaisa)).toBe(totalRevenue);
      expect(Number(result.sale.dueAmountPaisa)).toBe(0);
      expect(result.sale.paymentStatus).toBe('PAID');

      const stockAfter = savedEntities.find(
        (e) => (e as { code?: string }).code === 'FCS-2026-00001',
      ) as FinishedChaddarStock | undefined;
      expect(stockAfter!.remainingPieces).toBe(200);
      expect(stockAfter!.status).toBe(FinishedChaddarStatus.PARTIALLY_SOLD);

      expect(applySaleTransactionMock).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should reject cash sale where paid amount does not match total', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      await expect(
        salesService.create({
          ...baseCashDto,
          paidAmountPaisa: 1_000_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative paid amount', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      await expect(
        salesService.create({
          ...baseCashDto,
          paidAmountPaisa: -1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark stock SOLD_OUT when full remaining is sold', async () => {
      const stock = buildStock({
        remainingPieces: 100,
        remainingWeightKg: 800,
        weightPerPieceKg: 8,
      });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        ...buildCoil(),
        currentWeight: 0,
      });

      const total = 800 * 30_000;
      const result = await salesService.create({
        ...baseCashDto,
        items: [
          {
            finishedStockId: 10,
            piecesSold: 100,
            weightSoldKg: 800,
            sellingRatePaisa: 30_000,
          },
        ],
        paidAmountPaisa: total,
      });

      const stockAfter = savedEntities.find(
        (e) => (e as { code?: string }).code === 'FCS-2026-00001',
      ) as FinishedChaddarStock | undefined;
      expect(stockAfter!.status).toBe(FinishedChaddarStatus.SOLD_OUT);
      expect(Number(result.sale.totalAmountPaisa)).toBe(total);
    });

    it('should snapshot historical cost', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      const total = 400 * 30_000;
      const result = await salesService.create({
        ...baseCashDto,
        paidAmountPaisa: total,
      });
      const snapshottedCost = Number(result.items[0].finishedCostPerKgPaisa);

      const stockAfter = savedEntities.find(
        (e) => (e as { code?: string }).code === 'FCS-2026-00001',
      ) as { finishedCostPerKgPaisa: number };
      stockAfter.finishedCostPerKgPaisa = 99_999;

      expect(snapshottedCost).toBe(22_105);
    });

    it('should roll back transaction when sale item save fails', async () => {
      const stock = buildStock();
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);

      let saveCount = 0;
      mockQueryRunner.manager.save.mockImplementation((entity: unknown) => {
        saveCount++;
        if (saveCount === 2) {
          return Promise.reject(new Error('Simulated item save failure'));
        }
        savedEntities.push(entity as Record<string, unknown>);
        return Promise.resolve(entity);
      });

      await expect(
        salesService.create({
          ...baseCashDto,
          paidAmountPaisa: 400 * 30_000,
        }),
      ).rejects.toThrow('Simulated item save failure');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('create sale (customer + payment)', () => {
    const baseItem = {
      finishedStockId: 10,
      piecesSold: 50,
      weightSoldKg: 400,
      sellingRatePaisa: 30_000,
    };

    function mockTwoFindOnes(stock: FinishedChaddarStock, coil = buildCoil()) {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(coil);
    }

    it('should create a fully-paid customer sale: PAID, no due, customer balance unchanged', async () => {
      const stock = buildStock();
      mockTwoFindOnes(stock);
      const total = 400 * 30_000;
      const result = await salesService.create(
        {
          customerId: 1,
          saleDate: '2026-08-22',
          items: [baseItem],
          paidAmountPaisa: total,
        },
        'tester',
      );

      expect(result.sale.customerId).toBe(1);
      expect(result.sale.paymentStatus).toBe('PAID');
      expect(Number(result.sale.paidAmountPaisa)).toBe(total);
      expect(Number(result.sale.dueAmountPaisa)).toBe(0);

      expect(applySaleTransactionMock).toHaveBeenCalledWith(
        expect.anything(),
        1,
        result.sale.id,
        expect.any(Date),
        total,
        total,
        null,
        'tester',
      );
    });

    it('should create a partial customer sale: PARTIAL, due recorded, ledger called with full due', async () => {
      const stock = buildStock();
      mockTwoFindOnes(stock);
      const total = 400 * 30_000;
      const paid = 5_000_00; // Rs 5,000
      const due = total - paid;

      const result = await salesService.create({
        customerId: 1,
        saleDate: '2026-08-22',
        items: [baseItem],
        paidAmountPaisa: paid,
      });

      expect(result.sale.paymentStatus).toBe('PARTIAL');
      expect(Number(result.sale.paidAmountPaisa)).toBe(paid);
      expect(Number(result.sale.dueAmountPaisa)).toBe(due);

      expect(applySaleTransactionMock).toHaveBeenCalledWith(
        expect.anything(),
        1,
        result.sale.id,
        expect.any(Date),
        total,
        paid,
        null,
        null,
      );
    });

    it('should create an unpaid customer sale: UNPAID, full amount becomes due', async () => {
      const stock = buildStock();
      mockTwoFindOnes(stock);
      const total = 400 * 30_000;

      const result = await salesService.create({
        customerId: 1,
        saleDate: '2026-08-22',
        items: [baseItem],
        paidAmountPaisa: 0,
      });

      expect(result.sale.paymentStatus).toBe('UNPAID');
      expect(Number(result.sale.paidAmountPaisa)).toBe(0);
      expect(Number(result.sale.dueAmountPaisa)).toBe(total);
    });

    it('should reject overpayment for customer sale', async () => {
      const stock = buildStock();
      mockTwoFindOnes(stock);
      const total = 400 * 30_000;
      const overpaid = total + 100_00;

      await expect(
        salesService.create({
          customerId: 1,
          saleDate: '2026-08-22',
          items: [baseItem],
          paidAmountPaisa: overpaid,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should roll back when customer applySaleTransaction fails', async () => {
      const stock = buildStock();
      mockTwoFindOnes(stock);
      applySaleTransactionMock.mockRejectedValueOnce(
        new Error('Simulated ledger failure'),
      );

      await expect(
        salesService.create({
          customerId: 1,
          saleDate: '2026-08-22',
          items: [baseItem],
          paidAmountPaisa: 0,
        }),
      ).rejects.toThrow('Simulated ledger failure');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('selling rate snapshot is independent of price category', () => {
    const baseItem = {
      finishedStockId: 10,
      piecesSold: 10,
      weightSoldKg: 100,
      sellingRatePaisa: 30_000,
    };

    it('should store the operator-submitted selling rate as the snapshot regardless of priceCategory', async () => {
      const stock = buildStock({
        priceCategoryId: 7,
        priceCategory: {
          id: 7,
          code: 'BRONZE',
          name: 'Bronze',
          sellingRatePaisa: 28_000,
          isActive: true,
        } as never,
      });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      const result = await salesService.create({
        customerId: 1,
        saleDate: '2026-08-22',
        items: [baseItem],
        paidAmountPaisa: 0,
      });

      expect(Number(result.items[0].sellingRatePaisa)).toBe(30_000);
      expect(Number(result.items[0].lineRevenuePaisa)).toBe(100 * 30_000);
    });

    it('should accept sales against Unassigned stock (no priceCategory)', async () => {
      const stock = buildStock({ priceCategoryId: null, priceCategory: null });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(stock);
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(buildCoil());

      const result = await salesService.create({
        customerId: 1,
        saleDate: '2026-08-22',
        items: [baseItem],
        paidAmountPaisa: 0,
      });

      expect(result.sale.customerId).toBe(1);
      expect(Number(result.items[0].sellingRatePaisa)).toBe(30_000);
    });
  });
});
