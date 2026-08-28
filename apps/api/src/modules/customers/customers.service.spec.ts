import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomersService } from './customers.service';
import { Customer } from './entities/customer.entity';
import {
  CustomerLedgerEntry,
  LedgerEntryType,
} from './entities/customer-ledger-entry.entity';
import { Sale } from '../sales/entities/sale.entity';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('CustomersService', () => {
  let service: CustomersService;
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

  beforeEach(async () => {
    savedEntities.length = 0;

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM customers')) {
          const count = savedEntities.filter((e) =>
            (e as { code?: string }).code?.startsWith('CUS-'),
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
        CustomersService,
        {
          provide: getRepositoryToken(Customer),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CustomerLedgerEntry),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ totalPaid: 0 }),
            }),
          },
        },
        {
          provide: getRepositoryToken(Sale),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ totalSales: 0 }),
            }),
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

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a customer with auto-generated code and zero balance', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      const created = await service.create({ name: 'Acme Co.' });
      expect(created.code).toMatch(/^CUS-\d{4}-00001$/);
      expect(created.name).toBe('Acme Co.');
      expect(Number(created.currentBalancePaisa)).toBe(0);
      expect(created.isActive).toBe(true);
    });

    it('should reject duplicate code', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.create({ name: 'Acme', code: 'CUS-2026-00001' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('record payment', () => {
    it('should reject zero or negative amount', async () => {
      await expect(
        service.recordPayment(1, { amountPaisa: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFound when customer does not exist', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      await expect(
        service.recordPayment(999, { amountPaisa: 1000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject payment exceeding outstanding balance', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        id: 1,
        currentBalancePaisa: 5_000,
      });
      await expect(
        service.recordPayment(1, { amountPaisa: 10_000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record a payment, reduce balance, create ledger PAYMENT entry', async () => {
      const customer = {
        id: 1,
        code: 'CUS-2026-00001',
        name: 'Acme',
        currentBalancePaisa: 50_000,
      } as Customer;
      mockQueryRunner.manager.findOne.mockResolvedValue(customer);

      const entry = await service.recordPayment(1, {
        amountPaisa: 20_000,
        paymentDate: '2026-08-22',
        note: 'Partial payment',
      });

      expect(entry.entryType).toBe(LedgerEntryType.PAYMENT);
      expect(Number(entry.amountPaisa)).toBe(20_000);
      expect(Number(entry.balanceAfterPaisa)).toBe(30_000);
      expect(entry.note).toBe('Partial payment');

      const customerAfter = savedEntities.find(
        (e) => (e as { code?: string }).code === 'CUS-2026-00001',
      ) as Customer | undefined;
      expect(customerAfter!.currentBalancePaisa).toBe(30_000);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should roll back if save fails', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        id: 1,
        currentBalancePaisa: 50_000,
      });

      let saveCount = 0;
      mockQueryRunner.manager.save.mockImplementation((entity: unknown) => {
        saveCount++;
        if (saveCount === 2) {
          return Promise.reject(new Error('Simulated failure'));
        }
        savedEntities.push(entity as Record<string, unknown>);
        return Promise.resolve(entity);
      });

      await expect(
        service.recordPayment(1, { amountPaisa: 10_000 }),
      ).rejects.toThrow('Simulated failure');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('applySaleTransaction (used by SalesService)', () => {
    function makeCustomer(balancePaisa: number) {
      return {
        id: 1,
        code: 'CUS-2026-00001',
        currentBalancePaisa: balancePaisa,
      } as Customer;
    }

    it('should create SALE_DUE entry and increase balance by due amount', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(makeCustomer(10_000));

      const result = await service.applySaleTransaction(
        mockQueryRunner,
        1,
        99,
        new Date('2026-08-22'),
        100_000,
        30_000,
        'sale note',
        'tester',
      );

      expect(result.balanceAfterPaisa).toBe(10_000 + 70_000);

      const dueEntries = savedEntities.filter(
        (e) => (e as { entryType?: string }).entryType === 'SALE_DUE',
      );
      expect(dueEntries.length).toBe(1);
      expect((dueEntries[0] as { amountPaisa: number }).amountPaisa).toBe(
        70_000,
      );
    });

    it('should create both SALE_DUE and PAYMENT entries for partial payment', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(makeCustomer(0));

      const result = await service.applySaleTransaction(
        mockQueryRunner,
        1,
        99,
        new Date('2026-08-22'),
        100_000,
        40_000,
        null,
        null,
      );

      expect(result.balanceAfterPaisa).toBe(60_000);

      const types = savedEntities
        .map((e) => (e as { entryType?: string }).entryType)
        .filter(Boolean);
      expect(types).toContain('SALE_DUE');
      expect(types).toContain('PAYMENT');
    });

    it('should create no PAYMENT entry when paid is zero', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(makeCustomer(0));

      await service.applySaleTransaction(
        mockQueryRunner,
        1,
        99,
        new Date('2026-08-22'),
        100_000,
        0,
        null,
        null,
      );

      const types = savedEntities
        .map((e) => (e as { entryType?: string }).entryType)
        .filter(Boolean);
      expect(types).toEqual(['SALE_DUE']);
    });

    it('should keep balance unchanged for fully-paid customer sale', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(makeCustomer(0));

      const result = await service.applySaleTransaction(
        mockQueryRunner,
        1,
        99,
        new Date('2026-08-22'),
        100_000,
        100_000,
        null,
        null,
      );

      expect(result.balanceAfterPaisa).toBe(0);
    });

    it('should throw NotFound when customer missing in transaction', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      await expect(
        service.applySaleTransaction(
          mockQueryRunner as never,
          999,
          1,
          new Date(),
          100,
          0,
          null,
          null,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTotals (lifetime aggregation)', () => {
    it('returns totalPurchases from the sales table, totalPaid from ledger, and outstanding from the customer row', async () => {
      const customer = { id: 1, currentBalancePaisa: 30_000 } as Customer;
      const customerRepo = (
        service as unknown as {
          customerRepository: { findOne: jest.Mock };
        }
      ).customerRepository;
      customerRepo.findOne = jest.fn().mockResolvedValue(customer);

      const ledgerRepo = (
        service as unknown as {
          ledgerRepository: {
            createQueryBuilder: jest.Mock;
          };
        }
      ).ledgerRepository;
      ledgerRepo.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalPaid: 70_000 }),
      });

      const saleRepo = (
        service as unknown as {
          saleRepository: {
            createQueryBuilder: jest.Mock;
          };
        }
      ).saleRepository;
      saleRepo.createQueryBuilder = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalSales: 100_000 }),
      });

      const totals = await service.getTotals(1);
      expect(totals.totalSalesPaisa).toBe(100_000);
      expect(totals.totalPaidPaisa).toBe(70_000);
      expect(totals.outstandingPaisa).toBe(30_000);
    });
  });
});
