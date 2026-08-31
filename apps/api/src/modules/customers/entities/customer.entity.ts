import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CustomerLedgerEntry } from './customer-ledger-entry.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('customers')
@Index('idx_customers_code', ['code'])
@Index('idx_customers_phone', ['phone'])
@Index('idx_customers_name', ['name'])
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    name: 'current_balance_paisa',
    type: 'bigint',
    default: 0,
  })
  currentBalancePaisa: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CustomerLedgerEntry, (entry) => entry.customer)
  ledgerEntries: CustomerLedgerEntry[];

  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];
}
