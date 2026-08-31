import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SaleItem } from './sale-item.entity';
import { Customer } from '../../customers/entities/customer.entity';

export enum SaleStatus {
  COMPLETED = 'COMPLETED',
}

export enum SalePaymentStatus {
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
  UNPAID = 'UNPAID',
}

@Entity('sales')
@Index('idx_sales_code', ['code'])
@Index('idx_sales_sale_date', ['saleDate'])
@Index('idx_sales_customer_id', ['customerId'])
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ name: 'customer_id', type: 'integer', nullable: true })
  customerId: number | null;

  @ManyToOne(() => Customer, (customer) => customer.sales, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'sale_date', type: 'date' })
  saleDate: Date;

  @Column({ name: 'total_amount_paisa', type: 'bigint', default: 0 })
  totalAmountPaisa: number;

  @Column({ name: 'total_cost_paisa', type: 'bigint', default: 0 })
  totalCostPaisa: number;

  @Column({ name: 'gross_profit_paisa', type: 'bigint', default: 0 })
  grossProfitPaisa: number;

  @Column({ name: 'paid_amount_paisa', type: 'bigint', default: 0 })
  paidAmountPaisa: number;

  @Column({ name: 'due_amount_paisa', type: 'bigint', default: 0 })
  dueAmountPaisa: number;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    length: 20,
    default: SalePaymentStatus.UNPAID,
  })
  paymentStatus: SalePaymentStatus;

  @Column({ type: 'varchar', length: 20, default: SaleStatus.COMPLETED })
  status: SaleStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  /**
   * Optional client-generated UUID used to deduplicate accidental
   * double-clicks on the "Complete Sale" button. Two POSTs that
   * share the same key within a short window return the existing
   * sale rather than creating a duplicate that would re-debit
   * finished stock and re-create a customer ledger entry.
   */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 64,
    nullable: true,
    unique: true,
  })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: false })
  items: SaleItem[];
}
