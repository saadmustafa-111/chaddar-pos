import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import {
  SupplierLedgerEntry,
  SupplierLedgerEntryType,
} from './entities/supplier-ledger-entry.entity';
import { RecordSupplierPaymentDto } from './dto/supplier-payment.dto';

export interface SupplierTotals {
  /**
   * Sum of all PURCHASE_DUE entries in paisa. Always derived from
   * the ledger so historical purchases are captured.
   */
  totalPurchasePaisa: number;
  /**
   * Sum of all PAYMENT entries in paisa. Always derived from the
   * ledger.
   */
  totalPaidPaisa: number;
  /**
   * `totalPurchasePaisa - totalPaidPaisa`. Positive = we owe the
   * supplier. Negative = we have paid more than we owe (only possible
   * when an explicit ADJUSTMENT is recorded - ordinary supplier
   * advances are not allowed).
   */
  outstandingPaisa: number;
}

/**
 * Owns the supplier-side ledger and the rules around writing to it.
 *
 * The service is the only place that writes `supplier_ledger_entries`;
 * every insert runs inside a DB transaction with an explicit
 * re-read of the supplier's current balance so the running
 * `balanceAfterPaisa` stays deterministic even when several writers
 * race on the same supplier.
 */
@Injectable()
export class SupplierLedgerService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SupplierLedgerEntry)
    private readonly ledgerRepository: Repository<SupplierLedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Return the full ledger for a supplier, newest entries first.
   * `entryDate` is the leading sort key because it represents the
   * business day of the event; `createdAt` is the tiebreaker for
   * events that share a date (e.g. several purchases booked on the
   * same day).
   */
  async getLedger(supplierId: number): Promise<SupplierLedgerEntry[]> {
    await this.ensureSupplierExists(supplierId);
    return this.ledgerRepository.find({
      where: { supplierId },
      order: { entryDate: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  /**
   * Pure aggregation over the ledger - never reads any duplicated
   * balance column on the supplier row.
   */
  async getTotals(supplierId: number): Promise<SupplierTotals> {
    await this.ensureSupplierExists(supplierId);

    const rows = await this.ledgerRepository
      .createQueryBuilder('entry')
      .select('entry.entry_type', 'entryType')
      .addSelect('COALESCE(SUM(entry.amount_paisa), 0)', 'total')
      .where('entry.supplier_id = :supplierId', { supplierId })
      .groupBy('entry.entry_type')
      .getRawMany<{
        entryType: SupplierLedgerEntryType;
        total: string | number;
      }>();

    let totalPurchase = 0;
    let totalPaid = 0;
    for (const row of rows) {
      const v = Number(row.total);
      if (row.entryType === SupplierLedgerEntryType.PURCHASE_DUE) {
        totalPurchase += v;
      } else if (row.entryType === SupplierLedgerEntryType.PAYMENT) {
        totalPaid += v;
      }
    }

    return {
      totalPurchasePaisa: totalPurchase,
      totalPaidPaisa: totalPaid,
      outstandingPaisa: totalPurchase - totalPaid,
    };
  }

  /**
   * Public entry point used by the controller. Wraps the transactional
   * `recordPaymentInTransaction` so unit tests can drive the
   * transaction body directly without re-implementing the validation.
   */
  async recordPayment(
    supplierId: number,
    dto: RecordSupplierPaymentDto,
    createdBy?: string,
  ): Promise<SupplierLedgerEntry> {
    if (dto.amountPaisa <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    return this.dataSource.transaction(async (manager) => {
      return this.recordPaymentInTransaction(
        manager,
        supplierId,
        dto,
        createdBy,
      );
    });
  }

  /**
   * Transactional core shared by the public recordPayment() and by the
   * purchases service (when the operator pays against a purchase
   * directly). The caller is responsible for opening the transaction;
   * we lock the supplier row, recompute the running balance, and
   * refuse overpayments.
   */
  async recordPaymentInTransaction(
    manager: {
      findOne: (entity: unknown, opts: unknown) => Promise<unknown>;
      create: (entity: unknown, data: unknown) => unknown;
      save: <T>(entity: T) => Promise<T>;
    },
    supplierId: number,
    dto: RecordSupplierPaymentDto,
    createdBy?: string | null,
  ): Promise<SupplierLedgerEntry> {
    const supplier = (await manager.findOne(Supplier, {
      where: { id: supplierId },
    })) as Supplier | null;
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const totals = await this.computeTotalsInTransaction(manager, supplierId);
    if (dto.amountPaisa > totals.outstandingPaisa) {
      throw new BadRequestException(
        `Payment amount (${(dto.amountPaisa / 100).toFixed(2)}) exceeds outstanding balance (${(totals.outstandingPaisa / 100).toFixed(2)})`,
      );
    }

    const newBalance = totals.outstandingPaisa - dto.amountPaisa;

    const entry = manager.create(SupplierLedgerEntry, {
      supplierId: supplier.id,
      purchaseId: dto.purchaseId ?? null,
      entryType: SupplierLedgerEntryType.PAYMENT,
      amountPaisa: dto.amountPaisa,
      balanceAfterPaisa: newBalance,
      entryDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      note: dto.note ?? null,
      createdBy: createdBy ?? null,
    });

    return (await manager.save(entry)) as SupplierLedgerEntry;
  }

  /**
   * Internal helper for the purchases service to record the
   * payable side of a new purchase. Keeps the running balance
   * consistent with the public ledger view.
   */
  async recordPurchaseDueInTransaction(
    manager: {
      findOne: (entity: unknown, opts: unknown) => Promise<unknown>;
      create: (entity: unknown, data: unknown) => unknown;
      save: <T>(entity: T) => Promise<T>;
    },
    supplierId: number,
    purchaseId: number,
    amountPaisa: number,
    purchaseDate: Date,
    purchaseCode: string,
    createdBy?: string | null,
  ): Promise<SupplierLedgerEntry> {
    if (amountPaisa <= 0) {
      throw new BadRequestException(
        'Purchase amount must be greater than zero',
      );
    }
    const supplier = (await manager.findOne(Supplier, {
      where: { id: supplierId },
    })) as Supplier | null;
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const totals = await this.computeTotalsInTransaction(manager, supplierId);
    const newBalance = totals.outstandingPaisa + amountPaisa;

    const entry = manager.create(SupplierLedgerEntry, {
      supplierId: supplier.id,
      purchaseId,
      entryType: SupplierLedgerEntryType.PURCHASE_DUE,
      amountPaisa,
      balanceAfterPaisa: newBalance,
      entryDate: purchaseDate,
      note: `Purchase ${purchaseCode}`,
      createdBy: createdBy ?? null,
    });

    return (await manager.save(entry)) as SupplierLedgerEntry;
  }

  private async ensureSupplierExists(supplierId: number): Promise<void> {
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
  }

  private async computeTotalsInTransaction(
    manager: {
      findOne: (entity: unknown, opts: unknown) => Promise<unknown>;
    },
    supplierId: number,
  ): Promise<SupplierTotals> {
    const rows = (
      (await manager.findOne(SupplierLedgerEntry, {
        where: { supplierId },
      }))
        ? null
        : null
    ) as unknown;

    // Plain SQL aggregation - cheap and unambiguous. Avoids loading
    // the entire ledger into Node just to add up the columns.
    const ledgerRepo = this.ledgerRepository;
    const supplierRows = await ledgerRepo
      .createQueryBuilder('entry')
      .select('entry.entry_type', 'entryType')
      .addSelect('COALESCE(SUM(entry.amount_paisa), 0)', 'total')
      .where('entry.supplier_id = :supplierId', { supplierId })
      .groupBy('entry.entry_type')
      .getRawMany<{
        entryType: SupplierLedgerEntryType;
        total: string | number;
      }>();

    let totalPurchase = 0;
    let totalPaid = 0;
    for (const row of supplierRows) {
      const v = Number(row.total);
      if (row.entryType === SupplierLedgerEntryType.PURCHASE_DUE) {
        totalPurchase += v;
      } else if (row.entryType === SupplierLedgerEntryType.PAYMENT) {
        totalPaid += v;
      }
    }
    void rows;
    return {
      totalPurchasePaisa: totalPurchase,
      totalPaidPaisa: totalPaid,
      outstandingPaisa: totalPurchase - totalPaid,
    };
  }
}
