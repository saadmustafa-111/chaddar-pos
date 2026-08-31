import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
import { PriceCategory } from '../price-categories/entities/price-category.entity';

function makeChain(): {
  select: jest.Mock;
  addSelect: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  leftJoin: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  setParameter: jest.Mock;
  getRawOne: jest.Mock;
  getRawMany: jest.Mock;
  getMany: jest.Mock;
  [key: string]: jest.Mock;
} {
  const chain: Record<string, jest.Mock> = {};
  for (const m of [
    'select',
    'addSelect',
    'leftJoinAndSelect',
    'leftJoin',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'setParameter',
  ]) {
    chain[m] = jest.fn().mockReturnThis();
  }
  chain.getRawOne = jest.fn();
  chain.getRawMany = jest.fn().mockResolvedValue([]);
  chain.getMany = jest.fn().mockResolvedValue([]);
  return chain;
}

class RepoStub {
  chain = makeChain();
  constructor() {}

  setRawOne(value: unknown): this {
    this.chain.getRawOne.mockResolvedValue(value);
    return this;
  }

  setRawMany(values: unknown[]): this {
    this.chain.getRawMany.mockResolvedValue(values);
    return this;
  }

  setMany(values: unknown[]): this {
    this.chain.getMany.mockResolvedValue(values);
    return this;
  }

  createQueryBuilder(): typeof this.chain {
    return this.chain;
  }
}

describe('InventoryService', () => {
  let service: InventoryService;
  let coilStub: RepoStub;
  let stockStub: RepoStub;

  beforeEach(async () => {
    coilStub = new RepoStub();
    stockStub = new RepoStub();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(Coil),
          useValue: coilStub,
        },
        {
          provide: getRepositoryToken(FinishedChaddarStock),
          useValue: stockStub,
        },
        {
          provide: getRepositoryToken(PriceCategory),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('getSummary', () => {
    it('returns zero totals when no coils or stock exist', async () => {
      coilStub.setRawOne({
        totalCoils: '0',
        activeCoils: '0',
        depletedCoils: '0',
        totalCurrentWeightKg: '0',
        totalWastageWeightKg: '0',
        totalPurchaseAmountPaisa: '0',
      });
      stockStub.setRawOne({
        totalStockRows: '0',
        sellableRows: '0',
        partialRows: '0',
        soldOutRows: '0',
        totalRemainingPieces: '0',
        totalRemainingWeightKg: '0',
        totalFinishedCostValuePaisa: '0',
      });

      const summary = await service.getSummary();
      expect(summary.rawCoils.totalCoils).toBe(0);
      expect(summary.finishedChaddar.totalStockRows).toBe(0);
      expect(summary.finishedChaddar.totalRemainingPieces).toBe(0);
    });

    it('aggregates raw coil weight, finished weight, pieces and cost value', async () => {
      coilStub.setRawOne({
        totalCoils: '3',
        activeCoils: '2',
        depletedCoils: '1',
        totalCurrentWeightKg: '7500',
        totalWastageWeightKg: '200',
        totalPurchaseAmountPaisa: '15000000',
      });
      stockStub.setRawOne({
        totalStockRows: '2',
        sellableRows: '1',
        partialRows: '1',
        soldOutRows: '0',
        totalRemainingPieces: '320',
        totalRemainingWeightKg: '2400',
        totalFinishedCostValuePaisa: '5000000',
      });

      const summary = await service.getSummary();
      expect(summary.rawCoils).toEqual({
        totalCoils: 3,
        activeCoils: 2,
        depletedCoils: 1,
        totalCurrentWeightKg: 7500,
        totalWastageWeightKg: 200,
        totalPurchaseAmountPaisa: 15000000,
        totalRemainingCostValuePaisa: 15000000,
      });
      expect(summary.finishedChaddar).toEqual({
        totalStockRows: 2,
        sellableRows: 1,
        partialRows: 1,
        soldOutRows: 0,
        totalRemainingPieces: 320,
        totalRemainingWeightKg: 2400,
        totalFinishedCostValuePaisa: 5000000,
      });
    });
  });

  describe('listFinishedStock', () => {
    it('returns screen-ready rows with category names resolved and remaining cost computed', async () => {
      const stock: FinishedChaddarStock = {
        id: 10,
        code: 'FCS-2026-00001',
        cuttingBatchId: 1,
        sourceCoilId: 1,
        priceCategoryId: 2,
        priceCategory: {
          id: 2,
          code: 'SILVER',
          name: 'Silver',
          sellingRatePaisa: 28000,
          isActive: true,
        } as never,
        sizeLabel: '4*8',
        widthMm: 1000,
        thicknessMm: 0.5,
        color: 'Blue',
        brand: 'ABC',
        piecesProduced: 100,
        totalWeightKg: 500,
        remainingPieces: 70,
        remainingWeightKg: 350,
        weightPerPieceKg: 5,
        finishedCostPerKgPaisa: 22000,
        totalProductionCostPaisa: 1100000,
        status: FinishedChaddarStatus.PARTIALLY_SOLD,
        productionDate: new Date('2026-08-22'),
      };
      stockStub.setMany([stock]);

      const rows = await service.listFinishedStock({});
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        code: 'FCS-2026-00001',
        sizeLabel: '4*8',
        thicknessMm: 0.5,
        remainingPieces: 70,
        remainingWeightKg: 350,
        weightPerPieceKg: 5,
        finishedCostPerKgPaisa: 22000,
        remainingCostValuePaisa: Math.round(350 * 22000),
        status: FinishedChaddarStatus.PARTIALLY_SOLD,
        priceCategoryName: 'Silver',
        priceCategoryCode: 'SILVER',
      });
    });

    it('returns empty list when nothing matches', async () => {
      stockStub.setMany([]);
      const rows = await service.listFinishedStock({});
      expect(rows).toEqual([]);
    });
  });

  describe('listRawCoils', () => {
    it('returns screen-ready rows from coil repository', async () => {
      const coil: Coil = {
        id: 1,
        code: 'COIL-2026-00001',
        batchNumber: 'B-1',
        purchaseId: 1,
        supplierId: 1,
        supplier: { id: 1, code: 'S-1', name: 'Supplier A' } as never,
        materialFamilyId: null,
        materialFamily: null,
        priceCategoryId: 2,
        priceCategory: {
          id: 2,
          code: 'SILVER',
          name: 'Silver',
        } as never,
        brand: 'ABC',
        color: 'Blue',
        width: 1000,
        thicknessMm: 22,
        grossWeight: 10000,
        purchaseWeight: 10000,
        purchaseRatePaisa: 200000,
        purchaseAmountPaisa: 2000000,
        currentWeight: 7500,
        status: InventoryStatus.IN_PROCESS,
        processingStatus: ProcessingStatus.IN_PROGRESS,
        processingDate: null,
        processingNote: null,
        wastageWeight: 200,
        location: null,
        notes: null,
        createdAt: new Date('2026-08-22'),
        updatedAt: new Date('2026-08-22'),
      };
      coilStub.setMany([coil]);

      const rows = await service.listRawCoils({});
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        code: 'COIL-2026-00001',
        supplierName: 'Supplier A',
        priceCategoryName: 'Silver',
        currentWeight: 7500,
        purchaseWeight: 10000,
        wastageWeight: 200,
        status: InventoryStatus.IN_PROCESS,
      });
    });
  });

  describe('getFinishedStockFacets', () => {
    it('returns unique size labels and thickness values', async () => {
      stockStub.chain.getRawMany
        .mockResolvedValueOnce([{ sizeLabel: '4*8' }, { sizeLabel: '5*10' }])
        .mockResolvedValueOnce([{ thicknessMm: 0.5 }, { thicknessMm: 0.6 }]);

      const facets = await service.getFinishedStockFacets();
      expect(facets.sizeLabels).toEqual(['4*8', '5*10']);
      expect(facets.thicknessMm).toEqual([0.5, 0.6]);
    });
  });
});
