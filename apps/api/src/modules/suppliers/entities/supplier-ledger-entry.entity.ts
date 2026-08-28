import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Supplier } from './supplier.entity';
import { Purchase } from '../../purchases/entities/purchase.entity';

export enum SupplierLedgerEntryType {
  PURCHASE_DUE = 'PURCHASE_DUE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
}

/**
 * One row per supplier-side financial event.
 *
 * The "balance after this entry" is the running payable: the sum of
 * PURCHASE_DUE entries minus the sum of PAYMENT/ADJUSTMENT entries
 * for that supplier at the moment the entry was written. It is
 * persisted so the ledger view can show the running balance without
 * having to re-walk history for each request.
 *
 * Totals shown in the UI are always derived from this table; the
 * supplier row does not store any duplicated balance field.
 */
@Entity('supplier_ledger_entries')
@Index('idx_supplier_ledger_supplier_id', ['supplierId'])
@Index('idx_supplier_ledger_purchase_id', ['purchaseId'])
@Index('idx_supplier_ledger_entry_date', ['entryDate'])
@Index('idx_supplier_ledger_entry_type', ['entryType'])
export class SupplierLedgerEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @ManyToOne(() => Supplier, (supplier) => supplier.ledgerEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'purchase_id', type: 'integer', nullable: true })
  purchaseId: number | null;

  @ManyToOne(() => Purchase, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase | null;

  @Column({ name: 'entry_type', type: 'varchar', length: 20 })
  entryType: SupplierLedgerEntryType;

  /**
   * Amount in paisa (Rs × 100). Always positive; the direction is
   * implied by `entryType`. `PURCHASE_DUE` increases the payable,
   * `PAYMENT`/`ADJUSTMENT` decrease it.
   */
  @Column({ name: 'amount_paisa', type: 'bigint' })
  amountPaisa: number;

  /**
   * Running payable balance for this supplier after this entry has
   * been applied. Positive = we owe the supplier. Persisted at write
   * time so the ledger view is deterministic.
   */
  @Column({ name: 'balance_after_paisa', type: 'bigint' })
  balanceAfterPaisa: number;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: Date;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
