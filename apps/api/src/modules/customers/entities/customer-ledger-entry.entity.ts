import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Sale } from '../../sales/entities/sale.entity';

export enum LedgerEntryType {
  SALE_DUE = 'SALE_DUE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Entity('customer_ledger_entries')
@Index('idx_ledger_customer_id', ['customerId'])
@Index('idx_ledger_sale_id', ['saleId'])
@Index('idx_ledger_entry_date', ['entryDate'])
export class CustomerLedgerEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id' })
  customerId: number;

  @ManyToOne(() => Customer, (customer) => customer.ledgerEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'sale_id', type: 'integer', nullable: true })
  saleId: number | null;

  @ManyToOne(() => Sale, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale | null;

  @Column({ name: 'entry_type', type: 'varchar', length: 20 })
  entryType: LedgerEntryType;

  @Column({ name: 'amount_paisa', type: 'bigint' })
  amountPaisa: number;

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
