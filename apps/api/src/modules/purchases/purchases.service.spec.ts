import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PurchasesService } from './purchases.service';
import { Purchase } from './entities/purchase.entity';
import { Coil, InventoryStatus } from '../coils/entities/coil.entity';
import {
  InventoryMovement,
  MovementType,
} from '../inventory-movements/entities/inventory-movement.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { BadRequestException } from '@nestjs/common';

describe('PurchasesService', () => {
  let service: PurchasesService;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        {
          provide: getRepositoryToken(Purchase),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Coil),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Supplier),
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
      ],
    }).compile();

    service = module.get<PurchasesService>(PurchasesService);

    jest.clearAllMocks();
  });

  describe('purchase amount calculation', () => {
    it('should calculate purchase amount correctly: 5000 KG × Rs 250 = Rs 1,250,000', () => {
      const weight = 5000;
      const ratePaisa = 250 * 100;
      const expectedAmount = 125000000;

      const result = (
        service as unknown as {
          calculatePurchaseAmount: (w: number, r: number) => number;
        }
      ).calculatePurchaseAmount(weight, ratePaisa);

      expect(result).toBe(expectedAmount);
    });

    it('should calculate purchase amount correctly: 1000 KG × Rs 150.50 = Rs 150,500', () => {
      const weight = 1000;
      const ratePaisa = 150.5 * 100;
      const expectedAmount = 15050000;

      const result = (
        service as unknown as {
          calculatePurchaseAmount: (w: number, r: number) => number;
        }
      ).calculatePurchaseAmount(weight, ratePaisa);

      expect(result).toBe(expectedAmount);
    });

    it('should return 0 for zero weight', () => {
      const weight = 0;
      const ratePaisa = 250 * 100;

      const result = (
        service as unknown as {
          calculatePurchaseAmount: (w: number, r: number) => number;
        }
      ).calculatePurchaseAmount(weight, ratePaisa);

      expect(result).toBe(0);
    });

    it('should return 0 for negative rate', () => {
      const weight = 5000;
      const ratePaisa = -100;

      const result = (
        service as unknown as {
          calculatePurchaseAmount: (w: number, r: number) => number;
        }
      ).calculatePurchaseAmount(weight, ratePaisa);

      expect(result).toBe(0);
    });

    it('should handle decimal weights correctly', () => {
      const weight = 1234.567;
      const ratePaisa = 250 * 100;
      const expectedAmount = Math.round(1234.567 * 25000);

      const result = (
        service as unknown as {
          calculatePurchaseAmount: (w: number, r: number) => number;
        }
      ).calculatePurchaseAmount(weight, ratePaisa);

      expect(result).toBe(expectedAmount);
    });
  });

  describe('create purchase', () => {
    it('should reject purchase when supplier not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      const createDto = {
        supplierId: 999,
        purchaseDate: '2026-01-15',
        coils: [
          {
            width: 1000,
            grossWeight: 5100,
            purchaseWeight: 5000,
            purchaseRatePaisa: 25000,
          },
        ],
      };

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});

describe('Coil Entity', () => {
  describe('InventoryStatus enum', () => {
    it('should have correct status values', () => {
      expect(InventoryStatus.RAW).toBe('RAW');
      expect(InventoryStatus.IN_PROCESS).toBe('IN_PROCESS');
      expect(InventoryStatus.FINISHED).toBe('FINISHED');
      expect(InventoryStatus.DEPLETED).toBe('DEPLETED');
    });
  });
});

describe('InventoryMovement Entity', () => {
  describe('MovementType enum', () => {
    it('should have PURCHASE_RECEIPT as first movement type', () => {
      expect(MovementType.PURCHASE_RECEIPT).toBe('PURCHASE_RECEIPT');
    });

    it('should include all expected movement types', () => {
      expect(MovementType.PROCESSING_INPUT).toBe('PROCESSING_INPUT');
      expect(MovementType.PROCESSING_OUTPUT).toBe('PROCESSING_OUTPUT');
      expect(MovementType.CUTTING_CONSUMPTION).toBe('CUTTING_CONSUMPTION');
      expect(MovementType.SHEET_PRODUCTION).toBe('SHEET_PRODUCTION');
      expect(MovementType.SCRAP).toBe('SCRAP');
      expect(MovementType.SALE).toBe('SALE');
      expect(MovementType.ADJUSTMENT).toBe('ADJUSTMENT');
      expect(MovementType.RETURN).toBe('RETURN');
    });
  });
});
