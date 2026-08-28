import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Customer } from './entities/customer.entity';
import {
  CustomerLedgerEntry,
  LedgerEntryType,
} from './entities/customer-ledger-entry.entity';
import { Sale } from '../sales/entities/sale.entity';
import {
  CreateCustomerDto,
  RecordPaymentDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import { AttachmentsService } from '../attachments/attachments.service';
import { AttachmentEntityType } from '../attachments/entities/attachment.entity';

export interface CustomerWithTotals {
  customer: Customer;
  totalSalesPaisa: number;
  totalPaidPaisa: number;
  outstandingPaisa: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerLedgerEntry)
    private readonly ledgerRepository: Repository<CustomerLedgerEntry>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    private readonly dataSource: DataSource,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  private async generateCustomerCode(queryRunner: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
  }): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CUS-${year}-`;

    const result = (await queryRunner.query(
      `SELECT MAX(CAST(SUBSTR(code, LENGTH('${prefix}') + 1) AS INTEGER)) as max_num
       FROM customers
       WHERE code LIKE '${prefix}%'`,
    )) as Array<{ max_num: number | null }>;
    const maxNum = result[0]?.max_num ?? 0;
    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }

  async findAll(search?: string): Promise<Customer[]> {
    const qb = this.customerRepository
      .createQueryBuilder('customer')
      .orderBy('customer.createdAt', 'DESC');

    if (search && search.trim().length > 0) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(customer.name) LIKE :term OR LOWER(COALESCE(customer.phone, "")) LIKE :term OR LOWER(customer.code) LIKE :term)',
        { term },
      );
    }

    return qb.getMany();
  }

  async findAllActive(): Promise<Customer[]> {
    return this.customerRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async getLedger(id: number): Promise<CustomerLedgerEntry[]> {
    await this.findOne(id);
    return this.ledgerRepository.find({
      where: { customerId: id },
      order: { entryDate: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Aggregate the outstanding balance across every active customer
   * with a positive current balance. Used by the dashboard to avoid
   * loading every customer into memory.
   */
  async aggregateOutstandingPaisa(): Promise<number> {
    const row = (await this.customerRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.current_balance_paisa), 0)', 'total')
      .where('c.current_balance_paisa > 0')
      .andWhere('c.is_active = :a', { a: true })
      .getRawOne()) as { total: string | number };
    return Number(row.total ?? 0);
  }

  async getTotals(id: number): Promise<{
    totalSalesPaisa: number;
    totalPaidPaisa: number;
    outstandingPaisa: number;
  }> {
    const customer = await this.findOne(id);

    // Total Purchases must reflect every sale regardless of whether the
    // customer paid in full at the counter - the user-facing "Total
    // Purchases" tile is the lifetime sales volume. Aggregate straight
    // from the sales table so cash, partial and credit sales are all
    // counted.
    const salesRow = await this.saleRepository
      .createQueryBuilder('sale')
      .select('COALESCE(SUM(sale.total_amount_paisa), 0)', 'totalSales')
      .where('sale.customer_id = :customerId', { customerId: id })
      .getRawOne<{ totalSales: string | number }>();
    const totalSales = Number(salesRow?.totalSales ?? 0);

    // Total Paid = lifetime sum of PAYMENT ledger entries. Combined
    // payments + opening-balance payments both feed the PAYMENT
    // bucket so this stays consistent with the running balance.
    const paidRow = (await this.ledgerRepository
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.amount_paisa), 0)', 'totalPaid')
      .where('entry.customer_id = :customerId', { customerId: id })
      .andWhere('entry.entry_type = :type', {
        type: LedgerEntryType.PAYMENT,
      })
      .getRawOne()) as { totalPaid: string | number } | null;
    const totalPaid = Number(paidRow?.totalPaid ?? 0);

    // Outstanding is always derived from the running balance on the
    // customer row - it is the source of truth that every ledger
    // entry persists at write time. Subtracting totalPaid from
    // totalSales would re-derive the same value, but the persisted
    // running balance survives even when ledger entries have been
    // removed for audit / data corrections.
    return {
      totalSalesPaisa: totalSales,
      totalPaidPaisa: totalPaid,
      outstandingPaisa: Number(customer.currentBalancePaisa),
    };
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let code = dto.code?.trim();
      if (!code) {
        code = await this.generateCustomerCode(queryRunner);
      }

      const existing = await queryRunner.manager.findOne(Customer, {
        where: { code },
      });
      if (existing) {
        throw new ConflictException(
          `Customer with code ${code} already exists`,
        );
      }

      const customer = queryRunner.manager.create(Customer, {
        code,
        name: dto.name.trim(),
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        note: dto.note ?? null,
        currentBalancePaisa: 0,
        isActive: true,
      });

      const saved = await queryRunner.manager.save(customer);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    if (dto.name !== undefined) customer.name = dto.name.trim();
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.address !== undefined) customer.address = dto.address;
    if (dto.note !== undefined) customer.note = dto.note;
    if (dto.isActive !== undefined) customer.isActive = dto.isActive;
    return this.customerRepository.save(customer);
  }

  async recordPayment(
    id: number,
    dto: RecordPaymentDto,
    createdBy?: string,
  ): Promise<CustomerLedgerEntry> {
    if (dto.amountPaisa <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const customer = await queryRunner.manager.findOne(Customer, {
        where: { id },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const currentBalance = Number(customer.currentBalancePaisa);
      if (dto.amountPaisa > currentBalance) {
        throw new BadRequestException(
          `Payment amount (${(dto.amountPaisa / 100).toFixed(2)}) exceeds outstanding balance (${(currentBalance / 100).toFixed(2)})`,
        );
      }

      const newBalance = currentBalance - dto.amountPaisa;
      customer.currentBalancePaisa = newBalance;
      await queryRunner.manager.save(customer);

      const entry = queryRunner.manager.create(CustomerLedgerEntry, {
        customerId: customer.id,
        saleId: null,
        entryType: LedgerEntryType.PAYMENT,
        amountPaisa: dto.amountPaisa,
        balanceAfterPaisa: newBalance,
        entryDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        note: dto.note ?? null,
        createdBy: createdBy ?? null,
      });

      const saved = await queryRunner.manager.save(entry);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Internal helper used by SalesService to:
   *  - Lock a customer row
   *  - Apply a sale transaction (SALE_DUE + optional PAYMENT)
   *  - Update customer.currentBalancePaisa atomically
   * Must be invoked inside the caller's transaction.
   */
  async applySaleTransaction(
    queryRunner: {
      manager: {
        findOne: (entity: unknown, opts: unknown) => Promise<unknown>;
        create: (entity: unknown, data: unknown) => unknown;
        save: (entity: unknown) => Promise<unknown>;
      };
    },
    customerId: number,
    saleId: number,
    saleDate: Date,
    totalAmountPaisa: number,
    paidAmountPaisa: number,
    note: string | null,
    createdBy: string | null,
  ): Promise<{ balanceAfterPaisa: number }> {
    const customer = (await queryRunner.manager.findOne(Customer, {
      where: { id: customerId },
    })) as Customer | null;
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const currentBalance = Number(customer.currentBalancePaisa);
    const dueAmountPaisa = totalAmountPaisa - paidAmountPaisa;
    const newBalance = currentBalance + dueAmountPaisa;

    customer.currentBalancePaisa = newBalance;
    await queryRunner.manager.save(customer);

    if (dueAmountPaisa > 0) {
      const dueEntry = queryRunner.manager.create(CustomerLedgerEntry, {
        customerId: customer.id,
        saleId,
        entryType: LedgerEntryType.SALE_DUE,
        amountPaisa: dueAmountPaisa,
        balanceAfterPaisa: newBalance,
        entryDate: saleDate,
        note: note ?? null,
        createdBy: createdBy ?? null,
      });
      await queryRunner.manager.save(dueEntry);
    }

    if (paidAmountPaisa > 0) {
      const balanceAfterPayment = newBalance;
      const paymentEntry = queryRunner.manager.create(CustomerLedgerEntry, {
        customerId: customer.id,
        saleId,
        entryType: LedgerEntryType.PAYMENT,
        amountPaisa: paidAmountPaisa,
        balanceAfterPaisa: balanceAfterPayment,
        entryDate: saleDate,
        note: note ?? null,
        createdBy: createdBy ?? null,
      });
      await queryRunner.manager.save(paymentEntry);
    }

    return { balanceAfterPaisa: newBalance };
  }

  async delete(id: number): Promise<void> {
    const customer = await this.findOne(id);

    const saleCount = await this.saleRepository.count({
      where: { customerId: id },
    });
    if (saleCount > 0) {
      throw new BadRequestException(
        `Cannot delete customer '${customer.name}' because it has ${saleCount} sale(s) on record. Archive it instead to keep history intact.`,
      );
    }

    const ledgerCount = await this.ledgerRepository.count({
      where: { customerId: id },
    });
    if (ledgerCount > 0) {
      throw new BadRequestException(
        `Cannot delete customer '${customer.name}' because it has ${ledgerCount} ledger entry/entries on record. Archive it instead to keep history intact.`,
      );
    }

    const attachments = await this.attachmentsService.findByEntity(
      AttachmentEntityType.CUSTOMER,
      id,
    );
    if (attachments.length > 0) {
      throw new BadRequestException(
        `Cannot delete customer '${customer.name}' because it has ${attachments.length} attached document(s). Delete the documents first.`,
      );
    }

    await this.customerRepository.remove(customer);
  }
}
